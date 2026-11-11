/**
 * Sidebar filtering from capabilities the session already has: the role's
 * canAccessDashboard flag and Keystone's per-session list `isHidden` from admin meta.
 * Plain module: no 'use server' / 'use client', no @/ imports.
 */

type SidebarList = { path: string; isHidden?: boolean | null }
type SidebarUser = { role?: ({ canAccessDashboard?: boolean | null } & Record<string, unknown>) | null } | null | undefined

/** Only an explicit false hides navigation; an unknown user is left to the middleware. */
export function canUseDashboardNav(user: SidebarUser) {
  return user?.role?.canAccessDashboard !== false
}

export function visibleSidebarLists<T extends SidebarList>(lists: T[], user: SidebarUser): T[] {
  if (!canUseDashboardNav(user)) return []
  return lists.filter((list) => !list.isHidden)
}

/**
 * A platform page whose first segment is a list path follows that list's visibility, and a page
 * that names a role grant needs that grant; other pages stay visible to dashboard users.
 */
export function visiblePlatformItems<T extends { href: string; permission?: string }>(
  items: T[],
  lists: SidebarList[],
  user: SidebarUser
): T[] {
  if (!canUseDashboardNav(user)) return []
  const hiddenPaths = new Set(lists.filter((list) => list.isHidden).map((list) => list.path))
  return items.filter((item) => {
    // A page that names a role grant is hidden when the loaded role lacks it.
    if (item.permission && user?.role && user.role[item.permission] !== true) return false
    const slug = item.href.split('/platform/')[1]?.split(/[/?#]/)[0]
    return !slug || !hiddenPaths.has(slug)
  })
}
