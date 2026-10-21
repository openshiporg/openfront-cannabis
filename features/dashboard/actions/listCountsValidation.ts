import { parse } from 'graphql';
import { isGraphQLName } from './itemActionValidation.ts';

export interface ListCountQueryEntry {
  alias: unknown;
  fieldName: unknown;
}

export function buildListCountsQuery(entries: readonly ListCountQueryEntry[]): string | undefined {
  if (entries.length === 0 || entries.length > 64) return undefined;
  const aliases = new Set<string>();
  const selections: string[] = [];
  for (const entry of entries) {
    if (!isGraphQLName(entry.alias) || !isGraphQLName(entry.fieldName) || aliases.has(entry.alias)) return undefined;
    aliases.add(entry.alias);
    selections.push(`${entry.alias}: ${entry.fieldName}`);
  }

  const query = `query GetListCounts { ${selections.join('\n')} }`;
  try {
    parse(query, { noLocation: true, maxTokens: 256 });
    return query;
  } catch {
    return undefined;
  }
}
