import { describe, expect, it } from 'vitest'
import {
  applyBoardItemRows,
  canAccessBoard,
  hasColumnStructureChanges,
  mapBoardRecord,
  mapNotificationRecord,
  mergeSettings,
  normalizeBoardItems,
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

  it('normalizes board items when persisted data is not an array', () => {
    expect(normalizeBoardItems(null)).toEqual([])
    expect(normalizeBoardItems('bad data')).toEqual([])
    expect(normalizeBoardItems({ id: 'row-1', name: 'GPS installation' })).toEqual([
      { id: 'row-1', name: 'GPS installation' },
    ])
    expect(
      normalizeBoardItems({
        0: { id: 'row-1', name: 'GPS installation 1' },
        1: { id: 'row-2', name: 'GPS installation 2' },
      }),
    ).toEqual([
      { id: 'row-1', name: 'GPS installation 1' },
      { id: 'row-2', name: 'GPS installation 2' },
    ])
  })

  it('maps boards without crashing when items are stored as an object', () => {
    const board = mapBoardRecord(
      {
        id: 'board-gps',
        slug: 'gps-installations',
        name: 'GPS Installations',
        description: 'Tracks GPS installations.',
        preferred_view: 'table',
        kanban_group_by: 'status',
        kanban_card_fields: [],
        owner_user_id: 'user-1',
        shared_with: [],
        deleted_for: [],
        columns: {
          0: { id: 'col-name', key: 'name', label: 'Name', type: 'text' },
        },
        items: {
          0: { id: 'gps-1', name: 'Install 1' },
          1: { id: 'gps-2', name: 'Install 2' },
        },
      },
      new Map([['user-1', { email: 'admin@pulse.office' }]]),
    )

    expect(board.columns).toHaveLength(1)
    expect(board.items).toHaveLength(2)
    expect(board.items.map((item) => item.id)).toEqual(['gps-1', 'gps-2'])
  })

  it('uses normalized board item rows when they exist', () => {
    const [board] = applyBoardItemRows(
      [
        {
          id: 'board-gps',
          items: [{ id: 'old-row', name: 'Stale row' }],
        },
      ],
      [
        {
          board_id: 'board-gps',
          item_id: 'gps-2',
          row_data: { name: 'Second install' },
          position: 2,
          is_deleted: false,
        },
        {
          board_id: 'board-gps',
          item_id: 'gps-1',
          row_data: { id: 'gps-1', name: 'First install' },
          position: 1,
          is_deleted: false,
        },
        {
          board_id: 'board-gps',
          item_id: 'gps-deleted',
          row_data: { id: 'gps-deleted', name: 'Deleted install' },
          position: 3,
          is_deleted: true,
        },
      ],
    )

    expect(board.items).toEqual([
      { id: 'gps-1', name: 'First install' },
      { id: 'gps-2', name: 'Second install' },
    ])
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
