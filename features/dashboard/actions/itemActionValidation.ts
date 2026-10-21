import { Kind, parse, print, type FieldNode, type SelectionSetNode } from 'graphql';

const GRAPHQL_NAME = /^[_A-Za-z][_0-9A-Za-z]*$/;
const MAX_SELECTION_SOURCE_LENGTH = 4096;
const MAX_SELECTION_TOKENS = 256;
const MAX_ROOT_SELECTIONS = 32;

export const ITEM_ACTION_FAILURE = 'The request could not be completed. Please try again.';

export interface ItemActionListMetadata {
  key: string;
  path: string;
  labelField?: string | null;
  initialSearchFields?: unknown;
  fields: Record<string, unknown>;
  gqlNames?: unknown;
  graphql?: unknown;
}

export function isGraphQLName(value: unknown): value is string {
  return typeof value === 'string' && GRAPHQL_NAME.test(value);
}

export function isRegisteredListKey(value: unknown, registry: object): value is string {
  return isGraphQLName(value) && Object.hasOwn(registry, value);
}

export function isItemActionListMetadata(value: unknown): value is ItemActionListMetadata {
  return isRecord(value) && isGraphQLName(value.key) && typeof value.path === 'string' && isRecord(value.fields);
}

export function safeListRoutePath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 128 || !/^[a-z_-][a-z0-9_-]*$/.test(value)) return undefined;
  return `/dashboard/(admin)/${value}`;
}

export function parseBoundedFieldSelection(value: unknown): SelectionSetNode | undefined {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_SELECTION_SOURCE_LENGTH) return undefined;

  try {
    const document = parse(`query __ItemActionSelection { ${value} }`, {
      noLocation: true,
      maxTokens: MAX_SELECTION_TOKENS,
    });
    if (document.definitions.length !== 1 || document.definitions[0]?.kind !== Kind.OPERATION_DEFINITION) return undefined;

    const operation = document.definitions[0];
    if (operation.operation !== 'query' || (operation.variableDefinitions?.length ?? 0) > 0 || (operation.directives?.length ?? 0) > 0) return undefined;
    if (operation.selectionSet.selections.length === 0 || operation.selectionSet.selections.length > MAX_ROOT_SELECTIONS) return undefined;
    return operation.selectionSet;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFieldNode(value: unknown): value is FieldNode {
  return isRecord(value) && value.kind === Kind.FIELD && Array.isArray(value.arguments) && Array.isArray(value.directives) && value.directives.length === 0;
}

function isPlainField(value: unknown): value is FieldNode {
  return isFieldNode(value) && (value.arguments?.length ?? 0) === 0;
}

function fieldTypeFromMetadata(field: Record<string, unknown>, viewOrder: readonly string[]): string | undefined {
  if (field.path === 'id') return 'id';
  const viewsIndex = field.viewsIndex;
  if (!Number.isInteger(viewsIndex) || typeof viewsIndex !== 'number' || viewsIndex < 1 || viewsIndex > viewOrder.length) return undefined;
  return viewOrder[viewsIndex - 1];
}

function leaf(field: FieldNode): boolean {
  return !field.selectionSet;
}

function childrenMatch(field: FieldNode, expected: Array<{ name: string; alias?: string; booleanArgument?: string }>): boolean {
  const selections = field.selectionSet?.selections;
  if (!selections || selections.length !== expected.length) return false;
  if (!selections.every(isFieldNode)) return false;

  return expected.every((wanted) => {
    const match = selections.find((candidate) =>
      candidate.name.value === wanted.name && candidate.alias?.value === wanted.alias,
    );
    if (!match || match.selectionSet) return false;
    const argumentsList = match.arguments ?? [];
    if (wanted.booleanArgument === undefined) return argumentsList.length === 0;
    return argumentsList.length === 1 &&
      argumentsList[0]?.name.value === wanted.booleanArgument &&
      argumentsList[0]?.value.kind === Kind.BOOLEAN &&
      argumentsList[0]?.value.value === true;
  });
}

function fieldSelectionIsAllowed(field: FieldNode, metadata: Record<string, unknown>, viewOrder: readonly string[]): boolean {
  if (!isGraphQLName(field.name.value) || !isPlainField(field)) return false;
  if (field.alias && field.alias.value !== 'label') return false;

  const path = field.name.value;
  const entry = metadata[path];
  if (!isRecord(entry) || entry.path !== path) {
    const relationship = Object.values(metadata).find((candidate) => isRecord(candidate) &&
      candidate.path === path.replace(/Count$/, '') && candidate.fieldMeta && isRecord(candidate.fieldMeta) &&
      candidate.fieldMeta.displayMode === 'count' && `${candidate.path}Count` === path,
    );
    return Boolean(relationship && !field.alias && leaf(field));
  }

  const type = fieldTypeFromMetadata(entry, viewOrder);
  const fieldMeta = isRecord(entry.fieldMeta) ? entry.fieldMeta : {};
  if (type === 'relationship' && fieldMeta.displayMode === 'count') return false;

  switch (type) {
    case 'id':
    case 'bigInt':
    case 'checkbox':
    case 'decimal':
    case 'float':
    case 'integer':
    case 'json':
    case 'multiselect':
    case 'select':
    case 'text':
    case 'timestamp':
      return leaf(field);
    case 'password':
      return childrenMatch(field, [{ name: 'isSet' }]);
    case 'image':
      return childrenMatch(field, [
        { name: 'id' },
        { name: 'url' },
        { name: 'extension' },
        { name: 'filesize' },
        { name: 'width' },
        { name: 'height' },
      ]);
    case 'document':
      return childrenMatch(field, [{ name: 'document', booleanArgument: 'hydrateRelationships' }]);
    case 'relationship': {
      const labelField = typeof fieldMeta.refLabelField === 'string' && fieldMeta.refLabelField.length > 0
        ? fieldMeta.refLabelField
        : 'name';
      return isGraphQLName(labelField) && childrenMatch(field, [
        { name: 'id' },
        { name: labelField, alias: 'label' },
      ]);
    }
    default:
      return false;
  }
}

export function printSafeFieldSelection(
  selection: SelectionSetNode,
  list: ItemActionListMetadata,
  viewOrder: readonly string[],
): string | undefined {
  if (!isRecord(list.fields)) return undefined;
  const selections = selection.selections;
  if (!selections.every((field) => isPlainField(field) && fieldSelectionIsAllowed(field, list.fields, viewOrder))) return undefined;
  return selections.map((field) => print(field)).join('\n');
}

function itemFieldSelection(field: unknown, viewOrder: readonly string[]): string | undefined {
  if (!isRecord(field) || !isGraphQLName(field.path)) return undefined;
  const type = fieldTypeFromMetadata(field, viewOrder);
  const fieldMeta = isRecord(field.fieldMeta) ? field.fieldMeta : {};

  switch (type) {
    case 'id':
    case 'bigInt':
    case 'checkbox':
    case 'decimal':
    case 'float':
    case 'integer':
    case 'json':
    case 'multiselect':
    case 'select':
    case 'text':
    case 'timestamp':
      return field.path;
    case 'password':
      return `${field.path} { isSet }`;
    case 'image':
      return `${field.path} { id url extension filesize width height }`;
    case 'document':
      return `${field.path} { document(hydrateRelationships: true) }`;
    case 'relationship': {
      if (fieldMeta.displayMode === 'count') return `${field.path}Count`;
      const labelField = typeof fieldMeta.refLabelField === 'string' && fieldMeta.refLabelField.length > 0
        ? fieldMeta.refLabelField
        : 'name';
      return isGraphQLName(labelField) ? `${field.path} { id label: ${labelField} }` : undefined;
    }
    default:
      // Virtual/custom output selections have no output-type contract in AdminMeta.
      return undefined;
  }
}

export function buildItemReadSelection(
  list: ItemActionListMetadata,
  viewOrder: readonly string[],
): string | undefined {
  if (!isRecord(list.fields)) return undefined;
  const visibleFields: Record<string, unknown>[] = [];
  for (const candidate of Object.values(list.fields)) {
    if (!isRecord(candidate) || !isGraphQLName(candidate.path)) return undefined;
    if (candidate.path !== 'id') {
      // Core returns null for item-dependent UI modes when AdminMeta is read
      // without an item id. The item query below resolves the actual mode;
      // output access still runs on every selected field. Unknown field types
      // and malformed modes remain closed, not guessed.
      if (!isRecord(candidate.itemView) ||
          (candidate.itemView.fieldMode !== null && !['edit', 'read', 'hidden'].includes(String(candidate.itemView.fieldMode)))) return undefined;
      if (candidate.itemView.fieldMode === 'hidden') continue;
    }
    visibleFields.push(candidate);
  }

  if (visibleFields.length === 0 || visibleFields.length > MAX_ROOT_SELECTIONS ||
      !visibleFields.some((field) => field.path === 'id')) return undefined;

  const generated = visibleFields.map((field) => itemFieldSelection(field, viewOrder));
  if (generated.some((selection) => selection === undefined)) return undefined;
  const parsed = parseBoundedFieldSelection(generated.join('\n'));
  if (!parsed) return undefined;
  return printSafeFieldSelection(parsed, list, viewOrder);
}

export function buildCreateItemMutation(listKey: string, selectedFields: string): string | undefined {
  if (!isGraphQLName(listKey)) return undefined;
  return `mutation ($data: ${listKey}CreateInput!) { item: create${listKey}(data: $data) { ${selectedFields} } }`;
}

export function buildUpdateItemMutation(listKey: string): string | undefined {
  if (!isGraphQLName(listKey)) return undefined;
  return `mutation ($id: ID!, $data: ${listKey}UpdateInput!) { item: update${listKey}(where: { id: $id }, data: $data) { id } }`;
}

export function buildDeleteItemMutation(listKey: string): string | undefined {
  if (!isGraphQLName(listKey)) return undefined;
  return `mutation ($id: ID!) { delete${listKey}(where: { id: $id }) { id } }`;
}

export function buildBulkDeleteMutation(
  gqlNames: { deleteManyMutationName?: unknown; whereUniqueInputName?: unknown } | null | undefined,
): string | undefined {
  if (!gqlNames || !isGraphQLName(gqlNames.deleteManyMutationName) || !isGraphQLName(gqlNames.whereUniqueInputName)) return undefined;
  return `mutation ($where: [${gqlNames.whereUniqueInputName}!]!) { items: ${gqlNames.deleteManyMutationName}(where: $where) { id } }`;
}
