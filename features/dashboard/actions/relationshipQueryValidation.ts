import { parse, print } from 'graphql';
import {
  isGraphQLName,
  parseBoundedFieldSelection,
  printSafeFieldSelection,
  type ItemActionListMetadata,
} from './itemActionValidation.ts';

const MAX_TAKE = 1000;
const MAX_SKIP = 1_000_000;
const MAX_FILTER_TERMS = 32;
const MAX_FILTER_TEXT = 256;

export interface RelationshipQueryNames {
  whereInputName?: unknown;
  listQueryName?: unknown;
  listQueryCountName?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

export function isBoundedRelationshipPagination(take: unknown, skip: unknown): take is number {
  return Number.isSafeInteger(take) && (take as number) >= 1 && (take as number) <= MAX_TAKE &&
    Number.isSafeInteger(skip) && (skip as number) >= 0 && (skip as number) <= MAX_SKIP;
}

export function isAllowedRelationshipWhere(
  where: unknown,
  list: ItemActionListMetadata,
  take: number,
): where is Record<string, unknown> {
  if (!isRecord(where) || !isRecord(list.fields)) return false;

  if (hasExactKeys(where, ['id'])) {
    const idFilter = where.id;
    if (!isRecord(idFilter) || !hasExactKeys(idFilter, ['in']) || !Array.isArray(idFilter.in) ||
        idFilter.in.length === 0 || idFilter.in.length > MAX_TAKE || idFilter.in.length > take) return false;
    return idFilter.in.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 256);
  }

  if (!hasExactKeys(where, ['OR']) || !Array.isArray(where.OR) || where.OR.length > MAX_FILTER_TERMS) return false;
  const initialSearchFields = Array.isArray(list.initialSearchFields)
    ? list.initialSearchFields.filter(isGraphQLName)
    : [];

  return where.OR.every((term: unknown) => {
    if (!isRecord(term) || Object.keys(term).length !== 1) return false;
    const [fieldPath] = Object.keys(term);
    if (!isGraphQLName(fieldPath) || !Object.hasOwn(list.fields, fieldPath)) return false;
    const filter = term[fieldPath];
    if (!isRecord(filter)) return false;

    if (fieldPath === 'id') {
      return hasExactKeys(filter, ['equals']) && typeof filter.equals === 'string' &&
        filter.equals.length > 0 && filter.equals.length <= 256;
    }

    if (!initialSearchFields.includes(fieldPath) || !hasExactKeys(filter,
      Object.hasOwn(filter, 'mode') ? ['contains', 'mode'] : ['contains'])) return false;
    const field = list.fields[fieldPath];
    if (!isRecord(field) || !['default', 'insensitive'].includes(String(field.search))) return false;
    if (typeof filter.contains !== 'string' || filter.contains.length > MAX_FILTER_TEXT) return false;
    const expectedMode = field.search === 'insensitive' ? 'insensitive' : undefined;
    return filter.mode === expectedMode;
  });
}

export function buildRelationshipLabelSelection(
  list: ItemActionListMetadata,
  labelField: unknown,
  extraSelection: unknown,
  viewOrder: readonly string[],
): string | undefined {
  if (!isGraphQLName(labelField) || labelField !== list.labelField || extraSelection !== '') return undefined;
  const parsed = parseBoundedFieldSelection(labelField);
  if (!parsed) return undefined;
  const canonical = printSafeFieldSelection(parsed, list, viewOrder);
  return canonical === labelField ? canonical : undefined;
}

export function buildRelationshipOptionsQuery(
  names: RelationshipQueryNames | null | undefined,
  labelSelection: string,
): string | undefined {
  if (!names || !isGraphQLName(names.whereInputName) || !isGraphQLName(names.listQueryName) ||
      !isGraphQLName(names.listQueryCountName)) return undefined;
  const selection = parseBoundedFieldSelection(labelSelection);
  if (!selection) return undefined;
  const canonicalLabel = selection.selections.map((field) => print(field)).join('\n');
  if (canonicalLabel !== labelSelection) return undefined;

  const labelProjection = labelSelection === 'id' ? '' : ` ${canonicalLabel}`;
  const query = `query GetOptions($where: ${names.whereInputName}!, $take: Int!, $skip: Int!) { items: ${names.listQueryName}(where: $where, take: $take, skip: $skip) { id${labelProjection} } count: ${names.listQueryCountName}(where: $where) }`;
  try {
    parse(query, { noLocation: true, maxTokens: 256 });
    return query;
  } catch {
    return undefined;
  }
}
