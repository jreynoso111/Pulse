import { Bell, LogOut, PanelLeftClose, PanelLeftOpen, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { usePulseWorkspace } from '../context/PulseWorkspaceContext'

function formatNotificationTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function getNotificationGroupKey(notification) {
  const metaKey = notification.type === 'board-share-request'
    ? `${notification.meta?.boardId || ''}:${notification.meta?.permission || ''}:${notification.meta?.accepted === true ? 'accepted' : 'pending'}`
    : ''

  return [
    notification.type,
    notification.title,
    notification.description,
    notification.link,
    metaKey,
  ].join('::')
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const navigate = useNavigate()
  const {
    acceptBoardShare,
    currentUser,
    deleteNotification,
    notifications,
    rejectBoardShare,
    shellData,
    logout,
    markAllNotificationsRead,
    markNotificationRead,
    unreadNotificationsCount,
    updateUserPreferences,
  } = usePulseWorkspace()
  const groupedNotifications = useMemo(() => {
    const groups = notifications.reduce((accumulator, notification) => {
      const key = getNotificationGroupKey(notification)
      if (!accumulator[key]) {
        accumulator[key] = {
          key,
          notifications: [],
          latest: notification,
        }
      }

      accumulator[key].notifications.push(notification)
      if (new Date(notification.createdAt).getTime() > new Date(accumulator[key].latest.createdAt).getTime()) {
        accumulator[key].latest = notification
      }
      return accumulator
    }, {})

    return Object.values(groups)
      .map((group) => ({
        ...group,
        count: group.notifications.length,
        unreadCount: group.notifications.filter((notification) => !notification.read).length,
      }))
      .sort((left, right) => new Date(right.latest.createdAt).getTime() - new Date(left.latest.createdAt).getTime())
  }, [notifications])

  useEffect(() => {
    setCollapsed(Boolean(currentUser?.preferences?.sidebarCollapsed))
  }, [currentUser?.preferences?.sidebarCollapsed])

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  async function handleNotificationClick(notification) {
    await markNotificationRead(notification.id)
    setShowNotifications(false)
    navigate(notification.link)
  }

  async function handleAcceptBoardShare(notificationId) {
    await acceptBoardShare(notificationId)
    setShowNotifications(false)
    navigate('/app/boards')
  }

  async function handleDeleteNotification(event, notificationId) {
    event.stopPropagation()
    await deleteNotification(notificationId)
  }

  async function handleNotificationGroupClick(group) {
    await Promise.all(
      group.notifications
        .filter((notification) => !notification.read)
        .map((notification) => markNotificationRead(notification.id)),
    )
    setShowNotifications(false)
    navigate(group.latest.link)
  }

  async function handleDeleteNotificationGroup(event, group) {
    event.stopPropagation()
    await Promise.all(group.notifications.map((notification) => deleteNotification(notification.id)))
  }

  async function handleRejectBoardShare(notificationId) {
    await rejectBoardShare(notificationId)
    setShowNotifications(false)
  }

  function handleSidebarToggle() {
    if (window.innerWidth < 768) {
      setMobileNavOpen(true)
      return
    }

    setCollapsed((state) => {
      const nextCollapsed = !state
      updateUserPreferences({ sidebarCollapsed: nextCollapsed }).catch((error) => {
        console.error('Failed to save sidebar preference.', error)
      })
      return nextCollapsed
    })
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar collapsed={collapsed} mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur sm:px-4 xl:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-soft transition hover:text-slate-700"
                onClick={handleSidebarToggle}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>

              <div className="flex min-w-0 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-soft sm:max-w-xl">
                <Search size={16} className="text-slate-400" />
                <input
                  className="w-full min-w-0 border-none bg-transparent text-sm text-slate-700 outline-none"
                  placeholder={`Search in ${shellData.workspaceName}...`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <div className="hidden min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-soft lg:flex">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--pulse-accent)' }}
                >
                  {String(currentUser?.name || currentUser?.email || 'P')
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{currentUser?.name || 'Pulse user'}</p>
                  <p className="truncate text-xs text-slate-500">{currentUser?.email || ''}</p>
                </div>
              </div>
              <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications((current) => !current)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-soft transition hover:text-slate-700"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell size={18} />
                {shellData.notificationsEnabled && unreadNotificationsCount > 0 && (
                  <span
                    className="absolute right-1.5 top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ backgroundColor: 'var(--pulse-accent)' }}
                  >
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-12 z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:w-[360px]">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Notifications</p>
                      <p className="text-xs text-slate-500">{unreadNotificationsCount} unread</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        markAllNotificationsRead().catch((error) => {
                          console.error('Failed to mark notifications as read.', error)
                        })
                        setShowNotifications(false)
                      }}
                      className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-900"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto">
                    {groupedNotifications.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-slate-500">No notifications yet.</div>
                    ) : (
                      groupedNotifications.map((group) => {
                        const notification = group.latest

                        return (
                        <div
                          key={group.key}
                          className="group flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50"
                        >
                          <span
                            className="mt-1.5 h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor: group.unreadCount === 0 ? 'var(--border-subtle)' : 'var(--pulse-accent)',
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                                  {group.count > 1 && (
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                      {group.count}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="whitespace-nowrap pt-0.5 text-[11px] text-slate-400">
                                  {formatNotificationTime(notification.createdAt)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(event) => handleDeleteNotificationGroup(event, group)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
                                  aria-label="Delete notification"
                                  title="Delete notification"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{notification.description}</p>
                            {group.count > 1 && (
                              <p className="mt-1 text-xs text-slate-400">
                                {group.unreadCount} unread in this group
                              </p>
                            )}
                            {notification.type === 'board-share-request' && notification.meta?.accepted !== true ? (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAcceptBoardShare(notification.id)}
                                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                                  style={{ backgroundColor: 'var(--pulse-accent)' }}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectBoardShare(notification.id)}
                                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleNotificationGroupClick(group)}
                                className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-900"
                              >
                                Open
                              </button>
                            )}
                          </div>
                        </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-soft transition hover:text-slate-700"
                aria-label="Log out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 py-6 pb-24 sm:px-4 xl:px-5">
          <div className="mx-auto w-full max-w-[min(100%,1800px)]">
            <Outlet />
          </div>
        </main>
      </div>

      <div className="pointer-events-none fixed bottom-0 left-4 right-4 z-10 h-14 overflow-hidden border-t border-slate-200/80 bg-[color:var(--app-bg-soft)]/80 backdrop-blur-sm sm:left-6 sm:right-6">
        <div className="boards-bot-track absolute inset-y-0 left-0 w-[220px]">
          <div className="boards-bot walker absolute bottom-1 left-0">
            <div className="boards-bot-shadow" />
            <div className="boards-bot-body">
              <span className="boards-bot-eye boards-bot-eye-left" />
              <span className="boards-bot-eye boards-bot-eye-right" />
              <span className="boards-bot-antenna" />
            </div>
            <span className="boards-bot-leg boards-bot-leg-left" />
            <span className="boards-bot-leg boards-bot-leg-right" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AppLayout
