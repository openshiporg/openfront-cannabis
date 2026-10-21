import { ITEM_ACTION_FAILURE, isGraphQLName, isRegisteredListKey, safeListRoutePath } from './itemActionValidation.ts';

export const ADMIN_META_FAILURE = ITEM_ACTION_FAILURE;

const GRAPHQL_NAME_KEYS = [
  'outputTypeName',
  'whereInputName',
  'whereUniqueInputName',
  'createInputName',
  'createMutationName',
  'createManyMutationName',
  'relateToOneForCreateInputName',
  'relateToManyForCreateInputName',
  'itemQueryName',
  'listOrderName',
  'listQueryCountName',
  'listQueryName',
  'updateInputName',
  'updateMutationName',
  'updateManyInputName',
  'updateManyMutationName',
  'relateToOneForUpdateInputName',
  'relateToManyForUpdateInputName',
  'deleteMutationName',
  'deleteManyMutationName',
] as const;

const TYPE_NAME_KEYS = [
  'outputTypeName', 'whereInputName', 'whereUniqueInputName', 'createInputName',
  'relateToOneForCreateInputName', 'relateToManyForCreateInputName', 'listOrderName',
  'updateInputName', 'updateManyInputName', 'relateToOneForUpdateInputName',
  'relateToManyForUpdateInputName',
] as const;
const QUERY_NAME_KEYS = ['itemQueryName', 'listQueryName', 'listQueryCountName'] as const;
const MUTATION_NAME_KEYS = [
  'createMutationName', 'createManyMutationName', 'updateMutationName',
  'updateManyMutationName', 'deleteMutationName', 'deleteManyMutationName',
] as const;

export type ValidatedAdminList = Record<string, unknown> & {
  key: string;
  path: string;
  fields: Array<Record<string, unknown> & { path: string }>;
  graphql: Record<string, unknown> & { names: Record<string, string> };
};

export type ValidatedAdminMeta = Record<string, unknown> & { lists: ValidatedAdminList[] };

export type AdminMetaResult =
  | { success: true; data: ValidatedAdminMeta }
  | { success: false; error: typeof ADMIN_META_FAILURE };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isBoundedGraphQLName(value: unknown): value is string {
  return isGraphQLName(value) && !value.startsWith('__') && value.length <= 128;
}

function isSafeListPath(value: unknown): value is string {
  return safeListRoutePath(value) !== undefined;
}

function isText(value: unknown, maxLength = 512): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isNullableText(value: unknown, maxLength = 2048): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= maxLength);
}

function isUniqueNameGroup(
  names: Record<string, unknown>,
  keys: readonly string[],
  seen: Set<string>,
): boolean {
  for (const key of keys) {
    const value = names[key];
    if (!isBoundedGraphQLName(value) || seen.has(value)) return false;
    seen.add(value);
  }
  return true;
}

function validNameList(value: unknown, validPaths: Set<string>, maxLength: number): value is string[] {
  if (!Array.isArray(value) || value.length > maxLength) return false;
  const seen = new Set<string>();
  for (const item of value) {
    if (!isBoundedGraphQLName(item) || !validPaths.has(item) || seen.has(item)) return false;
    seen.add(item);
  }
  return true;
}

function validateField(field: unknown, paths: Set<string>): field is Record<string, unknown> & { path: string } {
  if (!isRecord(field) || !isBoundedGraphQLName(field.path) || paths.has(field.path) ||
      !isText(field.label, 256) || !isNullableText(field.description) ||
      !Object.hasOwn(field, 'fieldMeta') || typeof field.isOrderable !== 'boolean' ||
      typeof field.isFilterable !== 'boolean' || !Number.isSafeInteger(field.viewsIndex) ||
      (field.viewsIndex as number) < 0) return false;

  if (!Object.hasOwn(field, 'customViewsIndex')) return false;
  const customViewsIndex = field.customViewsIndex;
  if (customViewsIndex !== null &&
      (!Number.isSafeInteger(customViewsIndex) || (customViewsIndex as number) < 0)) return false;

  if (field.search !== null && field.search !== 'default' && field.search !== 'insensitive') return false;
  if (field.isNonNull !== null && (!Array.isArray(field.isNonNull) ||
      !field.isNonNull.every((value) => ['read', 'create', 'update'].includes(String(value))) ||
      new Set(field.isNonNull).size !== field.isNonNull.length)) return false;

  if (!isRecord(field.createView) || !['edit', 'hidden'].includes(String(field.createView.fieldMode))) return false;
  if (!isRecord(field.listView) || !['read', 'hidden'].includes(String(field.listView.fieldMode))) return false;
  if (field.itemView !== null) {
    if (!isRecord(field.itemView) ||
        (field.itemView.fieldMode !== null && !['edit', 'read', 'hidden'].includes(String(field.itemView.fieldMode))) ||
        (field.itemView.fieldPosition !== null && !['form', 'sidebar'].includes(String(field.itemView.fieldPosition)))) return false;
  }

  paths.add(field.path);
  return true;
}

function validateList(
  list: unknown,
  registry: object,
  paths: Set<string>,
  graphQLTypeNames: Set<string>,
  graphQLQueryNames: Set<string>,
  graphQLMutationNames: Set<string>,
): list is ValidatedAdminList {
  if (!isRecord(list) || !isRegisteredListKey(list.key, registry) || !isBoundedGraphQLName(list.key) ||
      !isSafeListPath(list.path) || paths.has(list.path) || !isText(list.label, 256) ||
      !isText(list.singular, 256) || !isText(list.plural, 256) || !isNullableText(list.description) ||
      !Number.isSafeInteger(list.pageSize) || (list.pageSize as number) < 1 ||
      !isBoundedGraphQLName(list.labelField) || typeof list.isSingleton !== 'boolean' ||
      typeof list.isHidden !== 'boolean' || typeof list.hideCreate !== 'boolean' ||
      typeof list.hideDelete !== 'boolean' || !Array.isArray(list.fields) || list.fields.length > 512 ||
      !Array.isArray(list.groups) || list.groups.length > 256 ||
      !Array.isArray(list.initialColumns) || !Array.isArray(list.initialSearchFields)) return false;

  const fieldPaths = new Set<string>();
  for (const field of list.fields) {
    if (!validateField(field, fieldPaths)) return false;
  }
  if (fieldPaths.size === 0 || !fieldPaths.has(list.labelField) ||
      !validNameList(list.initialColumns, fieldPaths, 512) ||
      !validNameList(list.initialSearchFields, fieldPaths, 512)) return false;

  if (list.initialSort !== null) {
    if (!isRecord(list.initialSort) || !isBoundedGraphQLName(list.initialSort.field) ||
        !fieldPaths.has(list.initialSort.field) ||
        (list.initialSort.direction !== 'ASC' && list.initialSort.direction !== 'DESC')) return false;
  }

  for (const group of list.groups) {
    if (!isRecord(group) || !isText(group.label, 256) || !isNullableText(group.description) ||
        !Array.isArray(group.fields) || group.fields.length > 512) return false;
    const groupedPaths = new Set<string>();
    for (const groupField of group.fields) {
      if (!isRecord(groupField) || !isBoundedGraphQLName(groupField.path) ||
          !fieldPaths.has(groupField.path) || groupedPaths.has(groupField.path)) return false;
      groupedPaths.add(groupField.path);
    }
  }

  if (!isRecord(list.graphql) || !isRecord(list.graphql.names)) return false;
  const names = list.graphql.names;
  for (const nameKey of GRAPHQL_NAME_KEYS) {
    if (!isBoundedGraphQLName(names[nameKey])) return false;
  }
  // Core 6.5.x top-level names are deprecated PascalCase List identities
  // (create-admin-meta); executable operation names live in graphql.names.
  const legacyPlural = typeof names.listQueryName === 'string' ? names.listQueryName[0]?.toUpperCase() + names.listQueryName.slice(1) : '';
  if ((list.itemQueryName !== names.itemQueryName && list.itemQueryName !== list.key) ||
      (list.listQueryName !== names.listQueryName && list.listQueryName !== legacyPlural) ||
      !isBoundedGraphQLName(list.itemQueryName) || !isBoundedGraphQLName(list.listQueryName) ||
      !isUniqueNameGroup(names, TYPE_NAME_KEYS, graphQLTypeNames) ||
      !isUniqueNameGroup(names, QUERY_NAME_KEYS, graphQLQueryNames) ||
      !isUniqueNameGroup(names, MUTATION_NAME_KEYS, graphQLMutationNames)) return false;

  paths.add(list.path);
  return true;
}

export function validateAdminMetaResponse(response: unknown, registry: object): AdminMetaResult {
  if (!isRecord(response) || response.success !== true || !isRecord(response.data) ||
      !isRecord(response.data.keystone) || !isRecord(response.data.keystone.adminMeta)) {
    return { success: false, error: ADMIN_META_FAILURE };
  }

  const adminMeta = response.data.keystone.adminMeta;
  if (!Array.isArray(adminMeta.lists) || adminMeta.lists.length > Object.keys(registry).length) {
    return { success: false, error: ADMIN_META_FAILURE };
  }

  const listKeys = new Set<string>();
  const listPaths = new Set<string>();
  const graphQLTypeNames = new Set<string>();
  const graphQLQueryNames = new Set<string>();
  const graphQLMutationNames = new Set<string>();
  for (const list of adminMeta.lists) {
    if (!validateList(list, registry, listPaths, graphQLTypeNames, graphQLQueryNames, graphQLMutationNames) ||
        listKeys.has(list.key)) {
      return { success: false, error: ADMIN_META_FAILURE };
    }
    listKeys.add(list.key);
  }

  const lists = adminMeta.lists.map((list) => {
    const names = list.graphql.names;
    return {
      ...list,
      itemQueryName: names.itemQueryName,
      listQueryName: names.listQueryName,
      gqlNames: names,
      graphql: { ...list.graphql, names },
    };
  });

  return { success: true, data: { ...adminMeta, lists } };
}

export function selectAdminMetaList(
  response: AdminMetaResult,
  listKey: unknown,
  registry: object,
): { success: true; data: { list: Record<string, unknown> } } | { success: false; error: typeof ADMIN_META_FAILURE } {
  if (!response.success || !isRegisteredListKey(listKey, registry)) {
    return { success: false, error: ADMIN_META_FAILURE };
  }

  const list = response.data.lists.find((candidate) => candidate.key === listKey);
  if (!list) return { success: false, error: ADMIN_META_FAILURE };
  const fields = Object.fromEntries(list.fields.map((field) => [field.path, field]));
  return { success: true, data: { list: { ...list, fields } } };
}
