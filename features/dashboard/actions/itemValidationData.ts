import { isGraphQLName } from './itemActionValidation.ts';

export interface ItemFieldValidation {
  fieldMode: string;
  fieldPosition: string;
  isRequired: boolean;
  isNonNull: string[];
  fieldMeta: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeItemValidationFields(fields: unknown): Record<string, ItemFieldValidation> | undefined {
  if (!Array.isArray(fields) || fields.length > 256) return undefined;
  const entries: Array<[string, ItemFieldValidation]> = [];
  const paths = new Set<string>();

  for (const candidate of fields) {
    if (!isRecord(candidate) || !isGraphQLName(candidate.path) || paths.has(candidate.path)) return undefined;
    paths.add(candidate.path);
    if (candidate.itemView === null || candidate.itemView === undefined) continue;
    if (!isRecord(candidate.itemView) ||
        !['edit', 'read', 'hidden'].includes(String(candidate.itemView.fieldMode))) return undefined;

    const fieldMeta = isRecord(candidate.fieldMeta) ? candidate.fieldMeta : {};
    const validation = isRecord(fieldMeta.validation) ? fieldMeta.validation : {};
    if (validation.isRequired !== undefined && typeof validation.isRequired !== 'boolean') return undefined;
    if (candidate.isNonNull !== undefined &&
        (!Array.isArray(candidate.isNonNull) || !candidate.isNonNull.every((value) => typeof value === 'string'))) return undefined;

    const position = candidate.itemView.fieldPosition;
    if (position !== undefined && position !== null && typeof position !== 'string') return undefined;
    entries.push([candidate.path, {
      fieldMode: candidate.itemView.fieldMode as string,
      fieldPosition: (position as string | null | undefined) || 'form',
      isRequired: validation.isRequired === true,
      isNonNull: (candidate.isNonNull as string[] | undefined) || [],
      fieldMeta,
    }]);
  }

  return Object.fromEntries(entries);
}
