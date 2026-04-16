import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function isAuthUserMissing(error: { message?: string } | null | undefined) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('user not found') || message.includes('not found')
}

async function rollbackProvisionedUser(supabaseAdmin: ReturnType<typeof createClient>, userId: string) {
  const cleanupOps = await Promise.all([
    supabaseAdmin.from('pulse_user_preferences').delete().eq('user_id', userId),
    supabaseAdmin.from('pulse_profiles').delete().eq('id', userId),
  ])

  const cleanupError = cleanupOps.find((operation) => operation.error)?.error
  if (cleanupError) {
    return cleanupError.message
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authDeleteError && !isAuthUserMissing(authDeleteError)) {
    return authDeleteError.message
  }

  return ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header.' }, 401)
    }

    const supabaseCaller = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user: callerUser },
      error: callerUserError,
    } = await supabaseCaller.auth.getUser(token)

    if (callerUserError || !callerUser) {
      return jsonResponse({ error: 'Invalid user session.' }, 401)
    }

    const { data: callerProfile, error: callerProfileError } = await supabaseCaller
      .from('pulse_profiles')
      .select('id, workspace_id, role')
      .eq('id', callerUser.id)
      .single()

    if (callerProfileError || !callerProfile || callerProfile.role !== 'admin') {
      return jsonResponse({ error: 'Only admins can manage workspace users.' }, 403)
    }

    const body = await req.json()
    const mode = String(body?.mode || 'create')
    const name = String(body?.name || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()
    const role = String(body?.role || 'member').trim().toLowerCase()
    const password = String(body?.password || '').trim()
    const targetUserId = String(body?.userId || '').trim()

    if (['block', 'unblock', 'delete'].includes(mode)) {
      if (!targetUserId) {
        return jsonResponse({ error: 'A target user is required.' }, 400)
      }

      if (targetUserId === callerUser.id) {
        return jsonResponse({ error: `You cannot ${mode} your own admin account.` }, 400)
      }

      const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
        .from('pulse_profiles')
        .select('id, email, workspace_id, disabled')
        .eq('id', targetUserId)
        .single()

      if (targetProfileError || !targetProfile || targetProfile.workspace_id !== callerProfile.workspace_id) {
        return jsonResponse({ error: 'User not found in this workspace.' }, 404)
      }

      if (mode === 'delete') {
        const { data: ownedBoards, error: ownedBoardsError } = await supabaseAdmin
          .from('pulse_boards')
          .select('id, name')
          .eq('workspace_id', callerProfile.workspace_id)
          .eq('owner_user_id', targetUserId)
          .is('delete_after', null)

        if (ownedBoardsError) {
          return jsonResponse({ error: ownedBoardsError.message }, 400)
        }

        if (ownedBoards && ownedBoards.length > 0) {
          return jsonResponse({ error: 'Delete or transfer the user-owned boards before deleting this profile.' }, 400)
        }

        const { error: authDisableError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          ban_duration: '876000h',
        })

        if (authDisableError && !isAuthUserMissing(authDisableError)) {
          return jsonResponse({ error: authDisableError.message }, 400)
        }

        const { error: cleanupError } = await supabaseAdmin.rpc('pulse_delete_workspace_user', {
          target_user_id: targetUserId,
          target_workspace_id: callerProfile.workspace_id,
        })

        if (cleanupError) {
          return jsonResponse(
            {
              error: 'Authentication was blocked, but workspace cleanup failed. The delete can be retried safely.',
              details: cleanupError.message,
            },
            500,
          )
        }

        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)

        if (authDeleteError && !isAuthUserMissing(authDeleteError)) {
          return jsonResponse(
            {
              error: 'Workspace cleanup completed, but removing the authentication record failed. The delete can be retried safely.',
              details: authDeleteError.message,
            },
            500,
          )
        }

        const { error: profileDeleteError } = await supabaseAdmin
          .from('pulse_profiles')
          .delete()
          .eq('id', targetUserId)
          .eq('workspace_id', callerProfile.workspace_id)

        if (profileDeleteError) {
          return jsonResponse(
            {
              error: 'Authentication record was removed, but the workspace profile could not be deleted. The delete can be retried safely.',
              details: profileDeleteError.message,
            },
            500,
          )
        }

        return jsonResponse({
          success: true,
          mode,
          email: targetProfile.email,
          userId: targetUserId,
          deleted: true,
        })
      }

      const shouldDisable = mode === 'block'
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        ban_duration: shouldDisable ? '876000h' : 'none',
      })

      if (authError) {
        return jsonResponse({ error: authError.message }, 400)
      }

      const { error: profileError } = await supabaseAdmin
        .from('pulse_profiles')
        .update({ disabled: shouldDisable })
        .eq('id', targetUserId)

      if (profileError) {
        return jsonResponse({ error: profileError.message }, 400)
      }

      return jsonResponse({
        success: true,
        mode,
        email: targetProfile.email,
        userId: targetUserId,
        disabled: shouldDisable,
      })
    }

    const normalizedMode = mode === 'invite' ? 'invite' : 'create'

    if (!name || !email) {
      return jsonResponse({ error: 'Name and email are required.' }, 400)
    }

    if (!['admin', 'manager', 'analyst', 'member'].includes(role)) {
      return jsonResponse({ error: 'Invalid role.' }, 400)
    }

    if (normalizedMode === 'create' && password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters.' }, 400)
    }

    let resolvedUserId: string | null = null
    let provisionedAuthUser = false

    if (normalizedMode === 'create') {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
        },
      })

      if (error) {
        return jsonResponse({ error: error.message }, 400)
      }

      resolvedUserId = data.user?.id ?? null
      provisionedAuthUser = true
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: name,
        },
      })

      if (error) {
        return jsonResponse({ error: error.message }, 400)
      }

      resolvedUserId = data.user?.id ?? null
      provisionedAuthUser = true
    }

    if (!resolvedUserId) {
      const { data: invitedUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) {
        return jsonResponse({ error: listError.message }, 400)
      }
      resolvedUserId = invitedUsers.users.find((entry) => entry.email?.toLowerCase() === email)?.id ?? null
    }

    if (!resolvedUserId) {
      return jsonResponse({ error: 'Unable to resolve the target user.' }, 500)
    }

    const { error: profileError } = await supabaseAdmin.from('pulse_profiles').upsert({
      id: resolvedUserId,
      workspace_id: callerProfile.workspace_id,
      email,
      name,
      role,
      disabled: false,
      must_change_password: normalizedMode === 'create',
    })

    if (profileError) {
      if (provisionedAuthUser) {
        const rollbackError = await rollbackProvisionedUser(supabaseAdmin, resolvedUserId)
        if (rollbackError) {
          return jsonResponse(
            {
              error: 'Workspace provisioning failed and auth rollback also failed. Manual cleanup is required.',
              details: profileError.message,
              rollbackDetails: rollbackError,
            },
            500,
          )
        }
      }

      return jsonResponse({ error: profileError.message }, 400)
    }

    const { error: preferencesError } = await supabaseAdmin.from('pulse_user_preferences').upsert({
      user_id: resolvedUserId,
      settings: {
        timezone: 'America/Mexico_City',
        locale: 'en-US',
        defaultBoardView: 'table',
        boardViews: {},
        notificationsEnabled: true,
        dashboardRefreshSeconds: 30,
        homePage: 'dashboard',
        density: 'comfortable',
        themeAccent: 'blue',
        sidebarCollapsed: false,
      },
    })

    if (preferencesError) {
      if (provisionedAuthUser) {
        const rollbackError = await rollbackProvisionedUser(supabaseAdmin, resolvedUserId)
        if (rollbackError) {
          return jsonResponse(
            {
              error: 'Workspace provisioning failed and auth rollback also failed. Manual cleanup is required.',
              details: preferencesError.message,
              rollbackDetails: rollbackError,
            },
            500,
          )
        }
      }

      return jsonResponse({ error: preferencesError.message }, 400)
    }

    return jsonResponse({
      success: true,
      mode: normalizedMode,
      email,
      role,
      userId: resolvedUserId,
      disabled: false,
    })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})
