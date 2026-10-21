import { Kind, parse, print, type FieldNode } from 'graphql';
import { isGraphQLName, parseBoundedFieldSelection } from './itemActionValidation.ts';

function isSafeOutputField(field: unknown): field is FieldNode {
  if (field === null || typeof field !== 'object' || (field as { kind?: unknown }).kind !== Kind.FIELD) return false;
  const node = field as FieldNode;
  if ((node.directives?.length ?? 0) > 0 || (node.alias && node.alias.value !== 'label')) return false;
  const args = node.arguments ?? [];
  const allowedDocumentArgument = node.name.value === 'document' && args.length === 1 &&
    args[0]?.name.value === 'hydrateRelationships' && args[0]?.value.kind === Kind.BOOLEAN &&
    args[0]?.value.value === true;
  if (args.length > 0 && !allowedDocumentArgument) return false;
  return !node.selectionSet || node.selectionSet.selections.every(isSafeOutputField);
}

export function buildGetItemQuery(itemQueryName: unknown, selectedFields: string): string | undefined {
  if (!isGraphQLName(itemQueryName)) return undefined;
  const selection = parseBoundedFieldSelection(selectedFields);
  if (!selection || !selection.selections.every(isSafeOutputField)) return undefined;

  const canonicalFields = selection.selections.map((field) => print(field)).join('\n');
  const query = `query KsFetchItem($id: ID!, $listKey: String!) { item: ${itemQueryName}(where: { id: $id }) { ${canonicalFields} } keystone { adminMeta { list(key: $listKey) { fields { path itemView(id: $id) { fieldMode fieldPosition } } } } } }`;
  try {
    parse(query, { noLocation: true, maxTokens: 256 });
    return query;
  } catch {
    return undefined;
  }
}
