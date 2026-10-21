import type { Context } from '.keystone/types';

/** Core 6.5.3 runtime forwards opts to Prisma.$transaction unchanged
 * (createSystem-*). Its declaration incorrectly types isolationLevel as the
 * enum OBJECT. Prisma 6.5 requires the enum VALUE. Keep the correction at this
 * single version-gated boundary, never pass an object to the actual engine. */
export function serializableTransaction<T>(context: Context, work: (tx: Context) => Promise<T>, timeout = 30_000): Promise<T> {
  const transaction = context.transaction as unknown as (
    work: (tx: Context) => Promise<T>,
    options: { isolationLevel: 'Serializable'; maxWait: number; timeout: number },
  ) => Promise<T>;
  return transaction(work, { isolationLevel: 'Serializable', maxWait: 5_000, timeout });
}
