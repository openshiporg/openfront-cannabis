export type ProviderEventScope = {
  providerCode: string;
  organizationId: string | null | undefined;
  premisesId: string | null | undefined;
};

export function assertProviderEventScopeMatch(existing: ProviderEventScope, current: ProviderEventScope): void {
  if (
    !existing.providerCode || !existing.organizationId || !existing.premisesId ||
    existing.providerCode !== current.providerCode ||
    existing.organizationId !== current.organizationId ||
    existing.premisesId !== current.premisesId
  ) {
    throw new Error("Provider event ID conflicts with another provider authority scope");
  }
}
