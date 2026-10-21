export type PreparationDetail = {
  id: string; reference: string; source: string; status: string; version: number; expiresAt: string; totalCents: number; authorityFingerprint: string;
  linesHasMore: boolean; historyHasMore: boolean; allocationHistoryHasMore: boolean;
  allocationHistory: Array<{ id: string; occurredAt: string; actorName: string; resourceId: string; evidenceState: 'recorded_fields' | 'unknown_legacy'; quantityMicrounits?: number; totalCents?: number; quoteHash?: string }>;
  verification: 'preparation_only_not_sale_or_handoff';
  lines: Array<{ id: string; titleSnapshot: string; packageUidSnapshot: string; quantityMicrounits: number; totalCents: number }>;
  history: Array<{ id: string; occurredAt: string; actorName: string | null; beforeStatus: string | null; status: string | null; reasonCode: string | null }>;
};
