import { ArrowLeft, PencilLine, Share2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import BoardTable from '../components/BoardTable'
import { usePulseWorkspace } from '../context/PulseWorkspaceContext'

function resolveBoardColumns(boardColumns, columnPreferences) {
  const mergedColumns = boardColumns.map((column, index) => {
    const preferences = columnPreferences[column.key] || {}

    return {
      ...column,
      hidden: preferences.hidden ?? column.hidden ?? false,
      minWidth: preferences.minWidth ?? column.minWidth,
      position: preferences.position ?? column.position ?? index + 1,
    }
  })

  return mergedColumns.sort((left, right) => (left.position || 0) - (right.position || 0))
}

function sanitizeSharedColumns(currentColumns, nextColumns) {
  return nextColumns.map((column, index) => {
    const currentColumn = currentColumns.find((entry) => entry.key === column.key)

    return {
      ...currentColumn,
      id: currentColumn?.id || column.id,
      key: column.key,
      label: column.label,
      type: column.type,
      position: currentColumn?.position ?? index + 1,
      minWidth: currentColumn?.minWidth ?? column.minWidth ?? 170,
    }
  })
}

function BoardWorkspacePage() {
  const navigate = useNavigate()
  const { boardSlug } = useParams()
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState('view')
  const [editPageForm, setEditPageForm] = useState({ name: '', description: '' })
  const [showEditPageModal, setShowEditPageModal] = useState(false)
  const [showSharingModal, setShowSharingModal] = useState(false)
  const {
    boards,
    currentUser,
    deleteBoard,
    getBoardPermission,
    getBoardViewPreferences,
    removeBoardShare,
    settings,
    shareBoard,
    updateBoard,
    updateBoardViewPreferences,
    workspaceUsers,
  } = usePulseWorkspace()
  const board = useMemo(() => boards.find((entry) => entry.slug === boardSlug) || null, [boardSlug, boards])
  const boardPermission = board ? getBoardPermission(board) : null
  const canEditBoard = boardPermission === 'owner' || boardPermission === 'edit'
  const canManageSharing = boardPermission === 'owner'
  const boardViewPreferences = board ? getBoardViewPreferences(board.id, board) : null
  const resolvedColumns = useMemo(
    () => (board ? resolveBoardColumns(board.columns, boardViewPreferences?.columnPreferences || {}) : []),
    [board, boardViewPreferences],
  )
  const availableUsers = workspaceUsers.filter(
    (user) =>
      user.disabled !== true &&
      user.email !== currentUser?.email &&
      !board?.sharedWith.some((entry) => entry.email === user.email),
  )

  useEffect(() => {
    if (!board) return
    setEditPageForm({
      name: board.name || '',
      description: board.description || '',
    })
  }, [board])

  if (!board && boards.length > 0) {
    return <Navigate to="/app/boards" replace />
  }

  if (!board) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Board not found</h1>
        <p className="text-sm text-slate-600">The requested workspace page does not exist anymore.</p>
        <Link
          to="/app/boards"
          className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to boards
        </Link>
      </section>
    )
  }

  function handleBoardChange(nextBoard) {
    const nextColumns = sanitizeSharedColumns(board.columns, nextBoard.columns)
    updateBoard(board.id, { ...board, columns: nextColumns, items: nextBoard.items }).catch((error) => {
      console.error('Failed to update board data.', error)
    })
  }

  async function handleDeleteBoard() {
    const shouldDelete = window.confirm(`Delete "${board.name}" and remove its page?`)
    if (!shouldDelete || !canManageSharing) return
    await deleteBoard(board.id)
    navigate('/app/boards', { replace: true })
  }

  async function handleShareSubmit(event) {
    event.preventDefault()
    if (!shareEmail) return
    await shareBoard(board.id, shareEmail, sharePermission)
    setShareEmail('')
    setSharePermission('view')
  }

  async function handleEditPageSubmit(event) {
    event.preventDefault()
    const nextBoard = await updateBoard(board.id, {
      name: editPageForm.name,
      description: editPageForm.description,
    })

    if (!nextBoard) return

    setShowEditPageModal(false)
    if (nextBoard.slug !== board.slug) {
      navigate(`/app/boards/${nextBoard.slug}`, { replace: true })
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <Link
            to="/app/boards"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
          >
            <ArrowLeft size={16} />
            All boards
          </Link>
          <div>
            <h1 className="break-words text-3xl font-semibold tracking-tight text-slate-900">{board.name}</h1>
          </div>
        </div>

        {canManageSharing && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              onClick={() => setShowSharingModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Share2 size={15} />
              Sharing
            </button>
            <button
              type="button"
              onClick={() => setShowEditPageModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <PencilLine size={15} />
              Edit page
            </button>
            <button
              type="button"
              onClick={handleDeleteBoard}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 size={15} />
              Delete page
            </button>
          </div>
        )}
      </div>
      <BoardTable
        key={board.id}
        columns={resolvedColumns}
        rows={board.items}
        loading={false}
        error={null}
        readOnly={!canEditBoard}
        initialViewMode={boardViewPreferences?.preferredView || board.preferredView || settings.defaultBoardView}
        initialGroupByKey={boardViewPreferences?.groupByKey}
        initialGroupedSectionCollapsedByField={boardViewPreferences?.groupedSectionCollapsedByField || {}}
        initialGanttGroupByKey={boardViewPreferences?.ganttGroupByKey || ''}
        initialGanttStartKey={boardViewPreferences?.ganttStartKey || ''}
        initialGanttEndKey={boardViewPreferences?.ganttEndKey || ''}
        initialKanbanGroupKey={boardViewPreferences?.kanbanGroupBy || board.kanbanGroupBy}
        initialKanbanPrimaryField={boardViewPreferences?.kanbanPrimaryField || 'name'}
        initialKanbanCardFields={boardViewPreferences?.kanbanCardFields || board.kanbanCardFields}
        initialKanbanCollapsedLaneIdsByField={boardViewPreferences?.kanbanCollapsedLaneIdsByField || {}}
        initialKanbanLaneSortDirectionByField={boardViewPreferences?.kanbanLaneSortDirectionByField || {}}
        initialTextSize={boardViewPreferences?.textSize || 'medium'}
        onDataChange={handleBoardChange}
        onViewConfigChange={(updates) => {
          updateBoardViewPreferences(board.id, updates).catch((error) => {
            console.error('Failed to save board view preferences.', error)
          })
        }}
      />

      {showSharingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:max-h-[calc(100vh-2rem)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Share2 size={16} className="text-slate-500" />
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Sharing</p>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Manage access</h2>
                <p className="text-sm text-slate-600">
                  Share this board with another user and choose whether they can only view it or also edit it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSharingModal(false)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Owner: {board.ownerEmail}
              </span>
            </div>

            {canManageSharing ? (
              <form className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={handleShareSubmit}>
                <label className="w-full flex-1 space-y-1 sm:min-w-[240px]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">User</span>
                  <select
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    value={shareEmail}
                    onChange={(event) => setShareEmail(event.target.value)}
                  >
                    <option value="">Select a user</option>
                    {availableUsers.map((user) => (
                      <option key={user.email} value={user.email}>
                        {user.name} · {user.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="w-full space-y-1 sm:w-[180px]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Permission</span>
                  <select
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    value={sharePermission}
                    onChange={(event) => setSharePermission(event.target.value)}
                  >
                    <option value="view">View</option>
                    <option value="edit">Edit</option>
                  </select>
                </label>

                <button
                  type="submit"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: 'var(--pulse-accent)' }}
                >
                  Share board
                </button>
              </form>
            ) : (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Only the board owner can manage sharing. Your current access is <span className="font-semibold">{boardPermission}</span>.
              </div>
            )}

            <div className="mt-5">
              {board.sharedWith.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  This board is not shared with anyone yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-[1.25rem] border border-slate-200">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          User
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Email
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Permission
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.sharedWith.map((entry) => {
                        const sharedUser = workspaceUsers.find((user) => user.email === entry.email)

                        return (
                          <tr key={entry.email} className="bg-white">
                            <td className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900">
                              {sharedUser?.name || entry.email}
                            </td>
                            <td className="border-b border-slate-200 px-4 py-3 text-slate-600">{entry.email}</td>
                            <td className="border-b border-slate-200 px-4 py-3">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                {entry.permission}
                              </span>
                            </td>
                            <td className="border-b border-slate-200 px-4 py-3 text-right">
                              {canManageSharing && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const shouldRemove = window.confirm(`Remove access for "${entry.email}"?`)
                                    if (!shouldRemove) return
                                  removeBoardShare(board.id, entry.email).catch((error) => {
                                    console.error('Failed to remove board sharing.', error)
                                  })
                                }}
                                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showEditPageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:max-h-[calc(100vh-2rem)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <PencilLine size={16} className="text-slate-500" />
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Edit page</p>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Update board details</h2>
                <p className="text-sm text-slate-600">
                  Adjust the page name and summary without changing the board data itself.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditPageModal(false)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleEditPageSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-900">Page name</span>
                <input
                  autoFocus
                  value={editPageForm.name}
                  onChange={(event) => setEditPageForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none ring-2 ring-transparent transition focus:border-slate-300 focus:ring-slate-200"
                  placeholder="Operations tracker, hiring pipeline, logistics board..."
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-900">Description</span>
                <textarea
                  rows={4}
                  value={editPageForm.description}
                  onChange={(event) =>
                    setEditPageForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none ring-2 ring-transparent transition focus:border-slate-300 focus:ring-slate-200"
                  placeholder="Short summary for what this board tracks and how the team should use it."
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current mode</p>
                  <p className="mt-1 text-sm text-slate-700">
                    Table workspace
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</p>
                  <p className="mt-1 text-sm text-slate-700">{board.ownerEmail}</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditPageModal(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: 'var(--pulse-accent)' }}
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default BoardWorkspacePage
