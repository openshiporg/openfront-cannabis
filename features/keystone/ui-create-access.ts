/**
 * Admin create buttons follow the list's own create access.
 *
 * Many lists deny generic create by design (records come only from workflow
 * commands), and role-based lists deny it to people without the permission.
 * Without this, the dashboard still shows "Create X" and the form always fails
 * with "Access denied". For every list that does not set `ui.hideCreate`
 * itself, hideCreate evaluates the list's operation-level create rule for the
 * current session. Access rules are not changed; this only reads them.
 *
 * Plain module: no @/ imports.
 */
type ListConfig = { access?: any; ui?: { hideCreate?: unknown; [key: string]: unknown }; [key: string]: unknown }

type Operation = 'create' | 'delete'

function operationRule(access: any, operation: Operation): ((args: any) => unknown) | undefined {
  if (typeof access === 'function') return access
  const rules = access?.operation
  if (typeof rules === 'function') return rules
  if (typeof rules?.[operation] === 'function') return rules[operation]
  return undefined
}
const createRule = (access: any) => operationRule(access, 'create')

async function allowed(listKey: string, list: ListConfig, operation: Operation, args: { session?: unknown; context: unknown }) {
  const rule = operationRule(list.access, operation)
  if (!rule) return true
  try {
    return Boolean(await rule({ session: args.session, context: args.context, listKey, operation }))
  } catch {
    return false
  }
}

export const createAllowed = (listKey: string, list: ListConfig, args: { session?: unknown; context: unknown }) =>
  allowed(listKey, list, 'create', args)

/**
 * Same for delete buttons. Opt-in (cannabis): repos whose lists already pick
 * their own hideDelete keep it.
 */
export function withDeleteAwareUi<T extends Record<string, ListConfig>>(lists: T): T {
  const out: Record<string, ListConfig> = {}
  for (const [listKey, list] of Object.entries(lists)) {
    if (list.ui?.hideDelete !== undefined || !operationRule(list.access, 'delete')) {
      out[listKey] = list
      continue
    }
    out[listKey] = {
      ...list,
      ui: { ...list.ui, hideDelete: async (args: { session?: unknown; context: unknown }) => !(await allowed(listKey, list, 'delete', args)) },
    }
  }
  return out as T
}

export function withCreateAwareUi<T extends Record<string, ListConfig>>(lists: T): T {
  const out: Record<string, ListConfig> = {}
  for (const [listKey, list] of Object.entries(lists)) {
    if (list.ui?.hideCreate !== undefined || !createRule(list.access)) {
      out[listKey] = list
      continue
    }
    out[listKey] = {
      ...list,
      ui: {
        ...list.ui,
        hideCreate: async (args: { session?: unknown; context: unknown }) => !(await createAllowed(listKey, list, args)),
      },
    }
  }
  return out as T
}
