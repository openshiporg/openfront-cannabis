const MAX_UPLOAD_SCAN_DEPTH = 64;
const MAX_UPLOAD_SCAN_NODES = 10_000;

export type UploadVariableScan =
  | { ok: true; hasUploads: boolean }
  | { ok: false };

type ScanFrame =
  | { value: unknown; depth: number }
  | { value: object; exit: true };

function isFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

function enumerableOwnValues(value: object, maxValues: number): unknown[] | undefined {
  if (Array.isArray(value)) {
    if (value.length > maxValues) return undefined;
    const values: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor) continue;
      if (!Object.hasOwn(descriptor, 'value')) return undefined;
      values.push(descriptor.value);
    }
    return values;
  }

  let count = 0;
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    count += 1;
    if (count > maxValues) return undefined;
  }

  const values: unknown[] = [];
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) continue;
    if (!Object.hasOwn(descriptor, 'value')) return undefined;
    values.push(descriptor.value);
  }
  return values;
}

/**
 * Bounded iterative scan for direct File values and Keystone `{ upload: File }` inputs.
 * Cycles, accessors, and inputs beyond the traversal budget fail closed.
 */
export function scanUploadVariables(root: unknown): UploadVariableScan {
  const active = new WeakSet<object>();
  const stack: ScanFrame[] = [{ value: root, depth: 0 }];
  let scheduledNodes = 1;
  let visitedNodes = 0;
  let hasUploads = false;

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) break;

    if ('exit' in frame) {
      active.delete(frame.value);
      continue;
    }

    visitedNodes += 1;
    if (visitedNodes > MAX_UPLOAD_SCAN_NODES || frame.depth > MAX_UPLOAD_SCAN_DEPTH) return { ok: false };

    const value = frame.value;
    if (value === null || typeof value !== 'object') continue;
    if (isFile(value)) {
      hasUploads = true;
      continue;
    }
    if (active.has(value)) return { ok: false };
    active.add(value);
    stack.push({ value, exit: true });

    if (!Array.isArray(value)) {
      const uploadDescriptor = Object.getOwnPropertyDescriptor(value, 'upload');
      if (uploadDescriptor && !Object.hasOwn(uploadDescriptor, 'value')) return { ok: false };
      if (uploadDescriptor && isFile(uploadDescriptor.value)) hasUploads = true;
    }

    const childValues = enumerableOwnValues(value, MAX_UPLOAD_SCAN_NODES - scheduledNodes);
    if (!childValues || scheduledNodes + childValues.length > MAX_UPLOAD_SCAN_NODES) return { ok: false };
    scheduledNodes += childValues.length;
    for (let index = childValues.length - 1; index >= 0; index -= 1) {
      stack.push({ value: childValues[index], depth: frame.depth + 1 });
    }
  }

  return { ok: true, hasUploads };
}
