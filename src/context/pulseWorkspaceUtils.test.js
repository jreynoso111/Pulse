import { describe, expect, it } from 'vitest'
import {
  canAccessBoard,
  hasColumnStructureChanges,
  mapNotificationRecord,
  mergeSettings,
} from './pulseWorkspaceUtils'

describe('pulseWorkspaceUtils', () => {
  it('merges persisted settings with defaults', () => {
    const settings = mergeSettings({
      locale: 'en-GB',
      themeAccent: 'emerald',
    })

    expect(settings.locale).toBe('en-GB')
    expect(settings.themeAccent).toBe('emerald')
    expect(settings.notificationsEnabled).toBe(true)
    expect(settings.boardViews).toEqual({})
  })

  it('allows access for accepted board shares only', () => {
    const board = {
      ownerUserId: 'owner-1',
      deletedFor: [],
      sharedWith: [
        { userId: 'member-1', accepted: true, permission: 'edit' },
        { userId: 'member-2', accepted: false, permission: 'view' },
      ],
    }

    expect(canAccessBoard(board, 'owner-1')).toBe(true)
    expect(canAccessBoard(board, 'member-1')).toBe(true)
    expect(canAccessBoard(board, 'member-2')).toBe(false)
  })

  it('maps notification rows into UI-friendly records', () => {
    const notification = mapNotificationRecord({
      id: 'notification-1',
      user_id: 'user-1',
      title: 'Board shared',
      description: 'A board was shared with you.',
      link: '/app/boards/ops',
      type: 'board-share-request',
      meta: { boardId: 'board-1' },
      created_at: '2026-04-04T10:00:00.000Z',
      read: false,
    })

    expect(notification).toEqual({
      id: 'notification-1',
      userId: 'user-1',
      title: 'Board shared',
      description: 'A board was shared with you.',
      link: '/app/boards/ops',
      type: 'board-share-request',
      meta: { boardId: 'board-1' },
      createdAt: '2026-04-04T10:00:00.000Z',
      read: false,
    })
  })

  it('detects structural column changes without flagging reordering', () => {
    const currentColumns = [
      { key: 'name' },
      { key: 'status' },
      { key: 'due_date' },
    ]

    expect(
      hasColumnStructureChanges(currentColumns, [
        { key: 'status' },
        { key: 'name' },
        { key: 'due_date' },
      ]),
    ).toBe(false)

    expect(
      hasColumnStructureChanges(currentColumns, [
        { key: 'name' },
        { key: 'status' },
        { key: 'priority' },
      ]),
    ).toBe(true)
  })
})
