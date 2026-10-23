/**
 * Runtime capabilities stay closed until their required, independently verified
 * workflow exists in this repository. This is a code-level launch boundary,
 * not a configurable feature flag: adding a capability requires implementing
 * and registering its complete authority/evidence contract in source.
 */
const enabledCapabilities: ReadonlySet<string> = new Set([
  // Read-only public menu: implemented in mutations/public.ts, listing only released, lab-passed,
  // unexpired, unheld packages with free quantity, each re-checked by assertPackageSaleable.
  "storefront.public-live-menu",
]);

export function requireRuntimeCapability(capability: string, reason: string): void {
  if (!enabledCapabilities.has(capability)) throw new Error(reason);
}

export function isRuntimeCapabilityEnabled(capability: string): boolean {
  return enabledCapabilities.has(capability);
}
