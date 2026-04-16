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

    const body = await req.json()
    const nextName = String(body?.name || '').trim()
    const nextEmail = String(body?.email || '').trim().toLowerCase()

    if (!nextName || !nextEmail) {
      return jsonResponse({ error: 'Name and email are required.' }, 400)
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('pulse_profiles')
      .select('id, name, email')
      .eq('id', callerUser.id)
      .single()

    if (profileError || !profile) {
      return jsonResponse({ error: 'Profile not found.' }, 404)
    }

    if (profile.name === nextName && profile.email === nextEmail) {
      return jsonResponse({
        success: true,
        profile: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
        },
      })
    }

    const { error: updateProfileError } = await supabaseAdmin
      .from('pulse_profiles')
      .update({
        name: nextName,
        email: nextEmail,
      })
      .eq('id', callerUser.id)

    if (updateProfileError) {
      return jsonResponse({ error: updateProfileError.message }, 400)
    }

    const { error: authError } = await supabaseCaller.auth.updateUser({
      email: nextEmail !== callerUser.email ? nextEmail : undefined,
      data: {
        full_name: nextName,
      },
    })

    if (authError) {
      const { error: rollbackError } = await supabaseAdmin
        .from('pulse_profiles')
        .update({
          name: profile.name,
          email: profile.email,
        })
        .eq('id', callerUser.id)

      if (rollbackError) {
        return jsonResponse(
          {
            error: 'Auth update failed after profile changes, and profile rollback also failed. Manual repair is required.',
            details: authError.message,
            rollbackDetails: rollbackError.message,
          },
          500,
        )
      }

      return jsonResponse({ error: authError.message }, 400)
    }

    return jsonResponse({
      success: true,
      profile: {
        id: callerUser.id,
        name: nextName,
        email: nextEmail,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return jsonResponse({ error: message }, 500)
  }
})
