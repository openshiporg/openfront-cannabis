import { print } from 'graphql';
import { isGraphQLName, parseBoundedFieldSelection } from './itemActionValidation.ts';

export interface ListQueryGraphQLNames {
  whereInputName?: unknown;
  listOrderName?: unknown;
  listQueryName?: unknown;
  listQueryCountName?: unknown;
}

export function buildListItemsQuery(names: ListQueryGraphQLNames | null | undefined, selectedFields: string): string | undefined {
  if (!names) return undefined;
  if (!isGraphQLName(names.whereInputName) || !isGraphQLName(names.listOrderName) ||
      !isGraphQLName(names.listQueryName) || !isGraphQLName(names.listQueryCountName)) return undefined;
  const selection = parseBoundedFieldSelection(selectedFields);
  if (!selection) return undefined;
  const canonicalFields = selection.selections.map((field) => print(field)).join('\n');

  return `query GetListItems($where: ${names.whereInputName}, $take: Int!, $skip: Int!, $orderBy: [${names.listOrderName}!]) { items: ${names.listQueryName}(where: $where, take: $take, skip: $skip, orderBy: $orderBy) { id ${canonicalFields} } count: ${names.listQueryCountName}(where: $where) }`;
}
