import type { Context } from ".keystone/types";
import { requireRuntimeCapability } from "../domain/runtimeCapabilities";
import { validateReconciliationSubmission } from "../domain/reconciliationEvidence";
import { assertProviderEventScopeMatch } from "../domain/providerEventScope";
import { isCompleteShiftCashEventRead } from "../domain/operatorReadBounds";
import { evaluateRefundAllocationEvidence, getRefundEvidenceTenderIds, MAX_REFUND_ALLOCATION_EVIDENCE_ROWS } from "../domain/refundAllocation";
import { serializableTransaction } from "../domain/transaction";
import { assertInteger, assertReasonCode, assertText, fenceAuthority, requireReadAuthority, retainedRequest, runControlledOperation, stableHash } from "./workflow";
import { latestRulePack } from "./rulePack";

export async function configureCannabisProduct(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  assertInteger(input.unitQuantityMicrounits, "Unit quantity", 1); assertInteger(input.equivalencyMicrounits, "Equivalency", 1); assertInteger(input.priceCents, "Price", 0);
  if (input.adultUseEligible !== true && input.medicalEligible !== true) throw new Error("Product must be explicitly eligible for at least one configured channel");
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "configureCannabisProduct", resourceType: "Product", action: "catalog.product.configured", emitStateEvent: false, lockKeys: [String(input.sku)] }, async (tx, authority) => {
    const sudo = tx.sudo(); const existing = await sudo.query.Product.findOne({ where: { sku: assertText(input.sku, "SKU") }, query: "id name" }); if (existing) throw new Error(`SKU ${input.sku.trim()} is already used by ${existing.name}`);
    const product = await sudo.query.Product.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, sku: input.sku, name: assertText(input.name, "Product name"), brand: input.brand ? assertText(input.brand, "Brand", 1, 200) : "", form: assertText(input.form, "Product form"), categoryCode: assertText(input.categoryCode, "Category code"), unitOfMeasure: assertText(input.unitOfMeasure, "Unit of measure"), unitQuantityMicrounits: input.unitQuantityMicrounits, equivalencyMicrounits: input.equivalencyMicrounits, priceCents: input.priceCents, taxCategoryCode: assertText(input.taxCategoryCode, "Tax category"), adultUseEligible: input.adultUseEligible === true, medicalEligible: input.medicalEligible === true, status: "active", publicDescription: input.publicDescription ? assertText(input.publicDescription, "Public description", 1, 1000) : "", publicImageUrl: "" }, query: "id sku status" });
    return { id: product.id, status: product.status, reference: product.sku };
  });
}

export async function configureRegister(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "configureRegister", resourceType: "Register", action: "register.configured", emitStateEvent: false, lockKeys: [String(input.code)] }, async (tx, authority) => {
    const sudo = tx.sudo(); const existing = await sudo.query.Register.findOne({ where: { code: assertText(input.code, "Register code") }, query: "id name" }); if (existing) throw new Error(`Register code ${input.code.trim()} is already used by ${existing.name}`);
    const register = await sudo.query.Register.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, code: input.code, name: assertText(input.name, "Register name"), status: "active" }, query: "id code status" });
    return { id: register.id, status: register.status, reference: register.code };
  });
}

export async function openRegisterShift(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input; const opening = assertInteger(input.openingFloatCents, "Opening float", 0);
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "openRegisterShift", resourceType: "RegisterShift", action: "cash.shift.opened", emitStateEvent: false, lockKeys: [String(input.registerId)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo(); const register = await sudo.query.Register.findOne({ where: { id: assertText(input.registerId, "Register ID") }, query: "id code status organization { id } premises { id }" });
    if (!register || register.status !== "active" || register.organization?.id !== authority.organizationId || register.premises?.id !== authority.premisesId) throw new Error("Active register is outside actor authority");
    const existing = await sudo.query.RegisterShift.findMany({ where: { register: { id: { equals: register.id } }, status: { in: ["open", "count_pending", "counted", "variance_review"] } }, take: 2, query: "id" });
    if (existing.length) throw new Error("Register already has an unresolved shift");
    const evidenceHash = stableHash({ opening, denominationEvidence: input.denominationEvidence });
    const shift = await sudo.query.RegisterShift.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, register: { connect: { id: register.id } }, operator: { connect: { id: authority.actor.id } }, status: "open", openingFloatCents: opening, expectedCashCents: opening, openedAt: new Date(), evidenceHash }, query: "id status" });
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: shift.id } }, type: "opening_float", amountCents: opening, reasonCode: "opening_float", actor: { connect: { id: authority.actor.id } }, occurredAt: new Date(), idempotencyKey: `${correlationId}:open`, evidenceHash }, query: "id" });
    return { id: shift.id, status: shift.status, reference: register.code };
  });
}

export async function closeRegisterShift(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("finance.action-bound-approval", "Shift close is disabled until an authenticated, action-bound second-party approval workflow is implemented.");
  const input = args.input; const actual = assertInteger(input.actualCashCents, "Actual cash", 0);
  if (!input.approvedById || input.approvedById === (context.session as any)?.itemId) throw new Error("Shift close requires an independent approver");
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "closeRegisterShift", resourceType: "RegisterShift", action: "cash.shift.closed", emitStateEvent: false, lockKeys: [String(input.shiftId)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo(); const shift = await sudo.query.RegisterShift.findOne({ where: { id: assertText(input.shiftId, "Shift ID") }, query: "id status openingFloatCents organization { id } premises { id } operator { id } cashEvents(take: 500) { type amountCents }" });
    if (!shift || shift.status !== "open" || shift.organization?.id !== authority.organizationId || shift.premises?.id !== authority.premisesId || shift.operator?.id !== authority.actor.id) throw new Error("Actor does not own this open shift");
    if (!isCompleteShiftCashEventRead(shift.cashEvents)) throw new Error("Shift cash event read is incomplete; reconcile before close");
    const approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageFinance }" });
    if (!approver || approver.status !== "active" || !approver.role?.canManageFinance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("Approver lacks current finance authority");
    const expected = shift.cashEvents.reduce((sum: number, event) => sum + event.amountCents, 0); const variance = actual - expected;
    const evidenceHash = stableHash({ actual, expected, variance, denominationEvidence: input.denominationEvidence });
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: shift.id } }, type: "count", amountCents: actual, reasonCode: "blind_close_count", actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: approver.id } }, occurredAt: new Date(), idempotencyKey: `${correlationId}:count`, evidenceHash }, query: "id" });
    const status = variance === 0 ? "closed" : "variance_review";
    await sudo.query.RegisterShift.updateOne({ where: { id: shift.id }, data: { status, expectedCashCents: expected, actualCashCents: actual, varianceCents: variance, countedAt: new Date(), ...(status === "closed" ? { closedAt: new Date(), approvedBy: { connect: { id: approver.id } } } : {}) }, query: "id" });
    return { id: shift.id, status, reference: String(variance), expectedCashCents: expected, actualCashCents: actual };
  });
}

export async function approveCashVariance(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "approveCashVariance", resourceType: "RegisterShift", action: "cash.variance.approved", emitStateEvent: false, lockKeys: [String(input.shiftId)] }, async (tx, authority) => {
    const sudo = tx.sudo(); const shift = await sudo.query.RegisterShift.findOne({ where: { id: assertText(input.shiftId, "Shift ID") }, query: "id status varianceCents organization { id } premises { id } operator { id }" });
    if (!shift || shift.status !== "variance_review" || shift.organization?.id !== authority.organizationId || shift.premises?.id !== authority.premisesId || shift.operator?.id === authority.actor.id) throw new Error("An independent finance actor must approve this variance-review shift");
    // The approver's credential ceiling bounds the variance they may clear; zero grants no approval authority.
    const ceiling = authority.actor.staffCredential?.approvalLimitCents;
    if (!Number.isSafeInteger(shift.varianceCents) || !Number.isSafeInteger(ceiling) || ceiling <= 0 || Math.abs(shift.varianceCents) > ceiling) throw new Error("This variance exceeds your approval limit");
    const evidenceHash = stableHash({ varianceCents: shift.varianceCents, reason: input.reason, evidence: input.evidence });
    await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: shift.id } }, type: "count", amountCents: 0, reasonCode: assertReasonCode(input.reasonCode, "Variance reason code"), actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: authority.actor.id } }, occurredAt: new Date(), idempotencyKey: `${input.idempotencyKey}:variance`, evidenceHash }, query: "id" });
    await sudo.query.RegisterShift.updateOne({ where: { id: shift.id }, data: { status: "closed", approvedBy: { connect: { id: authority.actor.id } }, closedAt: new Date() }, query: "id" });
    return { id: shift.id, status: "closed", reference: String(shift.varianceCents) };
  });
}

export async function refundCannabisSale(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("finance.verified-refunds", "Refunds are disabled until trusted payment outcomes, cumulative tender allocations, return custody, and independent approvals are implemented.");
  const input = args.input; const amount = assertInteger(input.amountCents, "Refund amount", 1);
  if (!input.approvedById || input.approvedById === (context.session as any)?.itemId) throw new Error("Refund requires independent approval");
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "refundCannabisSale", resourceType: "Refund", action: "sale.refunded", lockKeys: [String(input.saleId)] }, async (tx, authority, correlationId) => {
    const sudo = tx.sudo(); const sale = await sudo.query.Sale.findOne({ where: { id: assertText(input.saleId, "Sale ID") }, query: "id receiptNumber status totalCents refundedCents organization { id } premises { id } shift { id status }" });
    if (!sale || sale.organization?.id !== authority.organizationId || sale.premises?.id !== authority.premisesId || ["reversed", "refunded"].includes(sale.status)) throw new Error("Sale cannot be refunded in this authority scope");
    if (sale.refundedCents + amount > sale.totalCents) throw new Error("Refund exceeds the immutable sale total");
    const approver = await sudo.query.User.findOne({ where: { id: input.approvedById }, query: "id status organization { id } premises { id } role { canManageFinance }" });
    if (!approver || approver.status !== "active" || !approver.role?.canManageFinance || approver.organization?.id !== authority.organizationId || approver.premises?.id !== authority.premisesId) throw new Error("Approver lacks current finance authority");
    if (!['none', 'quarantine', 'waste', 'returned_to_authority'].includes(input.inventoryDisposition)) throw new Error("Explicit returned-product disposition is required");

    const originalTenderId = assertText(input.originalTenderId, "Original tender ID");
    const refundRows = await sudo.query.Refund.findMany({
      where: { sale: { id: { equals: sale.id } } },
      take: MAX_REFUND_ALLOCATION_EVIDENCE_ROWS + 1,
      query: "id amountCents status originalTenderReference sale { id } organization { id } premises { id }",
    });
    const tenderIds = getRefundEvidenceTenderIds(refundRows, originalTenderId);
    if (!tenderIds) throw new Error("Refund allocation evidence is incomplete or ambiguous");
    const tenderRows = await sudo.query.Tender.findMany({
      where: { id: { in: tenderIds } },
      take: MAX_REFUND_ALLOCATION_EVIDENCE_ROWS + 1,
      query: "id amountCents typeSnapshot status sale { id } organization { id } premises { id }",
    });
    const allocation = evaluateRefundAllocationEvidence({
      saleId: sale.id,
      organizationId: authority.organizationId,
      premisesId: authority.premisesId,
      originalTenderId,
      requestedAmountCents: amount,
      saleRefundedCents: sale.refundedCents,
      refunds: refundRows,
      tenders: tenderRows,
    });
    if (!allocation.ok) throw new Error(allocation.reason === "limit" ? "Refund exceeds the remaining original tender allocation" : "Refund allocation evidence is incomplete or ambiguous");
    const originalTender = allocation.originalTender;
    const evidenceHash = stableHash(input.evidence || {});
    const refund = await sudo.query.Refund.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, sale: { connect: { id: sale.id } }, amountCents: amount, reasonCode: assertText(input.reasonCode, "Refund reason"), inventoryDisposition: input.inventoryDisposition, status: "pending", actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: approver.id } }, originalTenderReference: originalTender.id, providerReference: input.providerReference || "", occurredAt: new Date(), evidenceHash }, query: "id status" });
    const refundedCents = sale.refundedCents + amount; const saleStatus = refundedCents === sale.totalCents ? "refunded" : "partially_refunded";
    await sudo.query.Sale.updateOne({ where: { id: sale.id }, data: { refundedCents, status: saleStatus }, query: "id" });
    if (originalTender.typeSnapshot === "cash") await sudo.query.CashEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, shift: { connect: { id: sale.shift.id } }, type: "refund", amountCents: -amount, reasonCode: input.reasonCode, actor: { connect: { id: authority.actor.id } }, approvedBy: { connect: { id: approver.id } }, occurredAt: new Date(), idempotencyKey: `${correlationId}:refund`, evidenceHash }, query: "id" });
    return { id: refund.id, status: refund.status, reference: sale.receiptNumber, saleStatus };
  });
}

export async function recordComplianceIncident(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "incident", scope: "recordComplianceIncident", resourceType: "ComplianceIncident", action: "incident.recorded", emitStateEvent: false }, async (tx, authority) => {
    if (!['refusal_of_sale','identity','patient_registry_outage','traceability_outage','payment_ambiguity','inventory_discrepancy','theft','loss','diversion','recall','privacy','security','system_outage','offline_attempt'].includes(input.type)) throw new Error("Unsupported incident type");
    if (input.type === "offline_attempt" && input.outageMode !== "fail_closed") throw new Error("Offline regulated sale attempts must fail closed");
    if (!["low", "medium", "high", "critical"].includes(input.severity)) throw new Error("Select an incident severity");
    if (input.outageMode != null && !["none", "fail_closed", "approved_degraded"].includes(input.outageMode)) throw new Error("Unsupported outage mode");
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    const notificationDueAt = input.notificationDueAt ? new Date(input.notificationDueAt) : null;
    if (!Number.isFinite(occurredAt.getTime()) || occurredAt.getTime() > Date.now() + 60_000) throw new Error("Occurred time must be a past date and time");
    if (notificationDueAt && !Number.isFinite(notificationDueAt.getTime())) throw new Error("Notification due time is invalid");
    const incident = await tx.sudo().query.ComplianceIncident.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, reference: `INC-${Date.now()}-${authority.actor.id.slice(-6)}`, type: input.type, severity: input.severity, status: "open", occurredAt, detectedAt: new Date(), notificationDueAt, description: assertText(input.description, "Incident description", 4, 5000), affectedPackageUids: input.affectedPackageUids || [], customerReferenceHash: input.customerReferenceHash || "", outageMode: input.outageMode || "none", recoveryQueueReference: input.recoveryQueueReference || "", authorityReference: input.authorityReference || "", actor: { connect: { id: authority.actor.id } }, owner: { connect: { id: authority.actor.id } }, evidenceHash: stableHash(input.evidence || {}) }, query: "id reference status" });
    return { id: incident.id, status: incident.status, reference: incident.reference };
  });
}

export async function activateIntegrationInstallation(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("provider.installation-verification", "Provider installation activation is disabled until a provider adapter verifies capabilities and authority directly.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageIntegrations", activity: "state_reporting", scope: "activateIntegrationInstallation", resourceType: "IntegrationInstallation", action: "integration.validated", emitStateEvent: false, lockKeys: [String(input.installationId)] }, async (tx, authority) => {
    const sudo = tx.sudo(); const installation = await sudo.query.IntegrationInstallation.findOne({ where: { id: assertText(input.installationId, "Installation ID") }, query: "id status providerType organization { id } premises { id }" });
    if (!installation || installation.organization?.id !== authority.organizationId || installation.premises?.id !== authority.premisesId || !["unconfigured", "pending_validation", "suspended"].includes(installation.status)) throw new Error("Integration installation is outside this authority scope");
    const credentialReference = assertText(input.credentialReference, "External secret-manager credential reference", 8, 500);
    const authorityReference = assertText(input.authorityReference, "Provider validation authority reference", 4, 500);
    if (input.externallyValidated !== true) throw new Error("External provider validation evidence is required; software cannot self-certify an integration");
    await sudo.query.IntegrationInstallation.updateOne({ where: { id: installation.id }, data: { status: "active", credentialReference, facilityReference: assertText(input.facilityReference, "Facility reference"), capabilities: input.capabilities || [], validatedAt: new Date(), authorityReference }, query: "id" });
    return { id: installation.id, status: "active", reference: authorityReference };
  });
}

export async function recordStateInboxEvent(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("provider.authenticated-inbox", "Provider inbox records are disabled until signatures are verified by a trusted adapter.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageIntegrations", activity: "state_reporting", scope: "recordStateInboxEvent", resourceType: "StateEventInbox", action: "state.inbox.recorded", emitStateEvent: false }, async (tx, authority) => {
    if (!input.signatureEvidence) throw new Error("Provider signature evidence is required for later adapter verification");
    const providerEventId = assertText(input.providerEventId, "Provider event ID");
    const providerCode = assertText(input.providerCode, "Provider code");
    const existing = await tx.sudo().query.StateEventInbox.findOne({ where: { providerEventId }, query: "id payloadHash status providerCode organization { id } premises { id }" });
    const payloadHash = stableHash(input.payload || {});
    if (existing) {
      assertProviderEventScopeMatch(
        { providerCode: existing.providerCode, organizationId: existing.organization?.id, premisesId: existing.premises?.id },
        { providerCode, organizationId: authority.organizationId, premisesId: authority.premisesId },
      );
      if (existing.payloadHash !== payloadHash) throw new Error("Provider event ID was replayed with different payload");
      return { id: existing.id, status: existing.status, reference: providerEventId };
    }
    const event = await tx.sudo().query.StateEventInbox.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, providerCode, providerEventId, payloadHash, signatureEvidence: input.signatureEvidence, status: "received", receivedAt: new Date(), payload: input.payload || {} }, query: "id status" });
    return { id: event.id, status: event.status, reference: input.providerEventId };
  });
}

export async function retryStateOutboxEvent(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canManageIntegrations", activity: "state_reporting", scope: "retryStateOutboxEvent", resourceType: "OutboxEvent", action: "state.outbox.requeued", emitStateEvent: false, lockKeys: [String(input.outboxEventId)] }, async (tx, authority) => {
    const event = await tx.sudo().query.OutboxEvent.findOne({ where: { id: assertText(input.outboxEventId, "Outbox event ID") }, query: "id eventKey topic status attempts lastAttemptAt lastErrorCode organization { id } premises { id }" });
    if (!event || event.organization?.id !== authority.organizationId || event.premises?.id !== authority.premisesId || !['rejected','retryable','dead_letter'].includes(event.status)) throw new Error("Outbox event is not eligible for controlled retry");
    // `attempts` counts delivery attempts, so a requeue leaves it unchanged. The prior failure is kept
    // in this command's receipt and audit evidence before the current queue fields are reset.
    await tx.sudo().query.OutboxEvent.updateOne({ where: { id: event.id }, data: { status: "queued", availableAt: new Date(), lastErrorCode: "" }, query: "id" });
    return { id: event.id, status: "queued", reference: event.eventKey, previous: { status: event.status, lastErrorCode: event.lastErrorCode || null, attempts: event.attempts, lastAttemptAt: event.lastAttemptAt || null } };
  });
}

export async function approveReconciliationRun(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("provider.computed-reconciliation", "Reconciliation approval is disabled until the comparison is computed from trusted source snapshots.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canViewReports", activity: "state_reporting", scope: "approveReconciliationRun", resourceType: "ReconciliationRun", action: "reconciliation.approved", emitStateEvent: false, lockKeys: [String(input.runId)] }, async (tx, authority) => {
    const sudo = tx.sudo(); const run = await sudo.query.ReconciliationRun.findOne({ where: { id: assertText(input.runId, "Reconciliation run ID") }, query: "id status discrepancyCount owner { id } organization { id } premises { id }" });
    if (!run || run.organization?.id !== authority.organizationId || run.premises?.id !== authority.premisesId || run.owner?.id === authority.actor.id || run.status !== "balanced" || run.discrepancyCount !== 0) throw new Error("Independent approval requires a balanced zero-discrepancy run");
    await sudo.query.ReconciliationRun.updateOne({ where: { id: run.id }, data: { status: "approved", approvedBy: { connect: { id: authority.actor.id } } }, query: "id" });
    return { id: run.id, status: "approved", reference: assertText(input.approvalReference, "Approval reference") };
  });
}

export async function recordReconciliationRun(_root: unknown, args: { input: any }, context: Context) {
  requireRuntimeCapability("provider.computed-reconciliation", "Reconciliation recording is disabled until local and external snapshots are computed and linked to evidence.");
  const input = args.input;
  return runControlledOperation(context, input, { permission: "canViewReports", activity: "state_reporting", scope: "recordReconciliationRun", resourceType: "ReconciliationRun", action: "reconciliation.recorded", emitStateEvent: false }, async (tx, authority) => {
    const submission = validateReconciliationSubmission(input.discrepancies);
    const run = await tx.sudo().query.ReconciliationRun.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, type: input.type, status: submission.status, startedAt: new Date(input.startedAt || Date.now()), completedAt: null, localSnapshotHash: assertText(input.localSnapshotHash, "Local snapshot hash", 16), externalSnapshotHash: input.externalSnapshotHash || "", discrepancyCount: submission.discrepancyCount, discrepancies: submission.discrepancies, owner: { connect: { id: authority.actor.id } }, evidenceHash: stableHash({ local: input.localSnapshotHash, external: input.externalSnapshotHash, discrepancies: submission.discrepancies }) }, query: "id status" });
    return { id: run.id, status: run.status, reference: String(submission.discrepancyCount) };
  });
}

const INCIDENT_TRANSITIONS: Record<string, string[]> = {
  open: ["contained", "investigating", "resolved"], contained: ["investigating", "resolved"],
  investigating: ["reported", "resolved"], reported: ["resolved"], resolved: ["closed"], closed: [],
};

export async function transitionComplianceIncident(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  const incidentId = assertText(input.incidentId, "Incident ID"); const expectedStatus = assertText(input.expectedStatus, "Current status"); const nextStatus = assertText(input.nextStatus, "Next status");
  if (!INCIDENT_TRANSITIONS[expectedStatus]?.includes(nextStatus)) throw new Error(`An incident cannot move from ${expectedStatus} to ${nextStatus}`);
  const reasonCode = assertReasonCode(input.reasonCode);
  const authorityReference = nextStatus === "reported" ? assertText(input.authorityReference, "Report reference", 2, 200) : "";
  return runControlledOperation(context, input, { permission: "canManageCompliance", activity: "incident", scope: "transitionComplianceIncident", resourceType: "ComplianceIncident", action: "incident.transitioned", emitStateEvent: false, lockKeys: [incidentId] }, async (tx, authority) => {
    const incident = await tx.sudo().query.ComplianceIncident.findOne({ where: { id: incidentId }, query: "id reference status organization { id } premises { id }" });
    if (!incident || incident.organization?.id !== authority.organizationId || incident.premises?.id !== authority.premisesId) throw new Error("Incident is outside this premises");
    const changed = await tx.prisma.complianceIncident.updateMany({ where: { id: incident.id, status: expectedStatus as any }, data: { status: nextStatus as any, ...(nextStatus === "reported" ? { reportedAt: new Date(), authorityReference } : {}), ownerId: authority.actor.id } });
    if (changed.count !== 1) throw new Error("This incident changed since you opened it. Refresh and try again.");
    return { id: incident.id, status: nextStatus, reference: incident.reference, beforeStatus: incident.status, reasonCode };
  });
}

const PRODUCT_STATUS = new Set(["active", "inactive"]);

/** Correct or retire catalog data. Sold lines and received packages keep their own snapshots. */
export async function amendCannabisProduct(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  const productId = assertText(input.productId, "Product ID"); const expectedUpdatedAt = new Date(assertText(input.expectedUpdatedAt, "Product revision"));
  if (!Number.isFinite(expectedUpdatedAt.getTime())) throw new Error("Product revision is invalid");
  if (input.unitOfMeasure != null || input.unitQuantityMicrounits != null || input.equivalencyMicrounits != null || input.sku != null) throw new Error("Unit, equivalency and SKU cannot be changed; configure a new product instead");
  const data: Record<string, unknown> = {};
  if (input.name != null) data.name = assertText(input.name, "Product name", 1, 200);
  if (input.priceCents != null) data.priceCents = assertInteger(input.priceCents, "Price", 0);
  if (input.status != null) { if (!PRODUCT_STATUS.has(input.status)) throw new Error("Product status must be active or inactive"); data.status = input.status; }
  if (input.adultUseEligible != null) data.adultUseEligible = input.adultUseEligible === true;
  if (input.medicalEligible != null) data.medicalEligible = input.medicalEligible === true;
  if (input.publicDescription != null) data.publicDescription = input.publicDescription === "" ? "" : assertText(input.publicDescription, "Public description", 1, 1000);
  // Categories can be corrected after a sales-rules change; sales lines keep their own category snapshot.
  if (input.categoryCode != null) data.categoryCode = assertText(input.categoryCode, "Purchase-limit category", 1, 60);
  if (input.taxCategoryCode != null) data.taxCategoryCode = assertText(input.taxCategoryCode, "Tax category", 1, 60);
  if (!Object.keys(data).length) throw new Error("No product changes were submitted");
  return runControlledOperation(context, input, { permission: "canManageInventory", activity: "inventory", scope: "amendCannabisProduct", resourceType: "Product", action: "catalog.product.amended", emitStateEvent: false, lockKeys: [productId] }, async (tx, authority) => {
    const product = await tx.sudo().query.Product.findOne({ where: { id: productId }, query: "id sku name priceCents status adultUseEligible medicalEligible publicDescription categoryCode taxCategoryCode updatedAt organization { id } premises { id }" });
    if (!product || product.organization?.id !== authority.organizationId || product.premises?.id !== authority.premisesId) throw new Error("Product is outside this premises");
    if (data.categoryCode != null || data.taxCategoryCode != null) {
      const { pack } = await latestRulePack(tx, authority.organizationId, authority.premisesId);
      const limits = Array.isArray(pack?.purchaseLimits) ? pack!.purchaseLimits as Array<{ categoryCode?: unknown }> : [];
      const taxes = Array.isArray(pack?.taxRules) ? pack!.taxRules as Array<{ categoryCode?: unknown }> : [];
      if (data.categoryCode != null && !limits.some(rule => rule?.categoryCode === data.categoryCode)) throw new Error(`No purchase limit in the current sales rules uses category ${data.categoryCode}`);
      if (data.taxCategoryCode != null && !taxes.some(rule => rule?.categoryCode === data.taxCategoryCode)) throw new Error(`No tax rule in the current sales rules uses category ${data.taxCategoryCode}`);
    }
    const next: Record<string, unknown> = { adultUseEligible: product.adultUseEligible, medicalEligible: product.medicalEligible, ...data };
    if (next.adultUseEligible !== true && next.medicalEligible !== true) throw new Error("Product must remain eligible for at least one channel");
    const changed = await tx.prisma.product.updateMany({ where: { id: product.id, updatedAt: expectedUpdatedAt }, data });
    if (changed.count !== 1) throw new Error("This product changed since you opened it. Refresh and try again.");
    const before = { name: product.name, priceCents: product.priceCents, status: product.status, adultUseEligible: product.adultUseEligible, medicalEligible: product.medicalEligible, publicDescription: product.publicDescription, categoryCode: product.categoryCode, taxCategoryCode: product.taxCategoryCode };
    return { id: product.id, status: String(next.status ?? product.status), reference: product.sku, before, changes: data };
  });
}

export async function revokeStaffCredential(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  const credentialId = assertText(input.credentialId, "Credential ID"); const nextStatus = assertText(input.nextStatus, "Credential status");
  if (!["suspended", "terminated"].includes(nextStatus)) throw new Error("Credentials can be suspended or terminated here");
  const reasonCode = assertReasonCode(input.reasonCode);
  return runControlledOperation(context, input, { permission: "canManageAuthority", activity: "authority", scope: "revokeStaffCredential", resourceType: "StaffCredential", action: "staff.credential.revoked", emitStateEvent: false, lockKeys: [credentialId] }, async (tx, authority) => {
    const credential = await tx.sudo().query.StaffCredential.findOne({ where: { id: credentialId }, query: "id status user { id } organization { id } premises { id }" });
    if (!credential || credential.organization?.id !== authority.organizationId || credential.premises?.id !== authority.premisesId) throw new Error("Credential is outside this premises");
    if (credential.user?.id === authority.actor.id) throw new Error("You cannot revoke your own credential");
    if (!["active", "pending", "suspended"].includes(credential.status) || credential.status === nextStatus) throw new Error(`A ${credential.status} credential cannot be ${nextStatus}`);
    await tx.sudo().query.StaffCredential.updateOne({ where: { id: credential.id }, data: { status: nextStatus as any }, query: "id" });
    return { id: credential.id, status: nextStatus, reference: credential.user?.id ?? credential.id, beforeStatus: credential.status, reasonCode };
  });
}

export async function amendRegister(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  const registerId = assertText(input.registerId, "Register ID");
  if (!["active", "inactive", "maintenance"].includes(input.status)) throw new Error("Register status must be active, inactive or maintenance");
  return runControlledOperation(context, input, { permission: "canManageFinance", activity: "cash", scope: "amendRegister", resourceType: "Register", action: "register.amended", emitStateEvent: false, lockKeys: [registerId] }, async (tx, authority) => {
    const register = await tx.sudo().query.Register.findOne({ where: { id: registerId }, query: "id code name status organization { id } premises { id }" });
    if (!register || register.organization?.id !== authority.organizationId || register.premises?.id !== authority.premisesId) throw new Error("Register is outside this premises");
    if (input.status !== "active") {
      const open = await tx.sudo().query.RegisterShift.count({ where: { register: { id: { equals: register.id } }, status: { in: ["open", "count_pending", "counted", "variance_review"] } } });
      if (open) throw new Error("Resolve this register's open shift first");
    }
    const name = input.name ? assertText(input.name, "Register name", 1, 200) : register.name;
    await tx.sudo().query.Register.updateOne({ where: { id: register.id }, data: { name, status: input.status }, query: "id" });
    return { id: register.id, status: input.status, reference: register.code, before: { name: register.name, status: register.status } };
  });
}

const RENEWABLE: Record<"license" | "credential", string[]> = { license: ["active", "expired", "conditioned"], credential: ["active", "expired", "pending", "suspended"] };

/**
 * Owner renewal of an expiring or lapsed license or staff credential. It works while
 * operating authority is lapsed (that is when it is needed) and keeps the prior
 * interval in the audit trail. Revoked, suspended licenses and terminated credentials
 * are not reinstated here.
 */
export async function renewCannabisAuthority(_root: unknown, args: { input: any }, context: Context) {
  const input = args.input;
  const authority = await requireReadAuthority(context, "canManageAuthority");
  const owner = await context.sudo().query.User.findOne({ where: { id: authority.actor.id }, query: "role { canManageOnboarding }" });
  if (owner?.role?.canManageOnboarding !== true) throw new Error("Only the business owner can renew licenses and credentials");
  const kind = input.kind === "license" ? "license" : input.kind === "credential" ? "credential" : null;
  if (!kind) throw new Error("Choose a license or credential to renew");
  const recordId = assertText(input.id, "Record ID"); const key = assertText(input.idempotencyKey, "Idempotency key", 8, 200);
  const effectiveAt = new Date(assertText(input.effectiveAt, "Effective date")); const expiresAt = new Date(assertText(input.expiresAt, "Expiry date"));
  if (!Number.isFinite(effectiveAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || effectiveAt >= expiresAt || expiresAt.getTime() <= Date.now()) throw new Error("Enter a valid period that ends in the future");
  const reference = assertText(input.reference, kind === "license" ? "Renewal reference" : "Credential number", 2, 200);
  const lookupKey = `${authority.organizationId}:${authority.premisesId}:renewCannabisAuthority:${key}`;
  const requestHash = stableHash(input);
  return serializableTransaction(context, async tx => {
    await tx.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "openfront-cannabis", lookupKey);
    await fenceAuthority(tx, authority);
    const sudo = tx.sudo();
    const prior = await sudo.query.IdempotencyKey.findOne({ where: { lookupKey }, query: "requestHash status responseSnapshot actor { id }" });
    if (prior) {
      if (prior.requestHash !== requestHash || prior.actor?.id !== authority.actor.id) throw new Error("Idempotency key was reused with different input");
      return { ...(prior.responseSnapshot as object), replayed: true };
    }
    const list = kind === "license" ? sudo.query.CannabisLicense : sudo.query.StaffCredential;
    const record = await (list as any).findOne({ where: { id: recordId }, query: `id status effectiveAt expiresAt ${kind === "license" ? "authorityReference" : "credentialReference"} organization { id } premises { id }` });
    if (!record || record.organization?.id !== authority.organizationId || record.premises?.id !== authority.premisesId) throw new Error("Record is outside this premises");
    if (!RENEWABLE[kind].includes(record.status)) throw new Error(`A ${record.status} ${kind} can't be renewed here`);
    const before = { status: record.status, effectiveAt: record.effectiveAt, expiresAt: record.expiresAt, reference: kind === "license" ? record.authorityReference : record.credentialReference };
    await (list as any).updateOne({ where: { id: record.id }, data: { status: "active", effectiveAt, expiresAt, ...(kind === "license" ? { authorityReference: reference } : { credentialReference: reference }) }, query: "id" });
    const result = { id: record.id, status: "active", reference: kind, before, after: { effectiveAt: effectiveAt.toISOString(), expiresAt: expiresAt.toISOString() } };
    await sudo.query.IdempotencyKey.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, scope: "renewCannabisAuthority", lookupKey, requestHash, requestSnapshot: retainedRequest(input), status: "succeeded", responseSnapshot: JSON.parse(JSON.stringify(result)), startedAt: new Date(), completedAt: new Date(), expiresAt: new Date(Date.now() + 300_000), actor: { connect: { id: authority.actor.id } } }, query: "id" });
    await sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, actor: { connect: { id: authority.actor.id } }, action: `authority.${kind}.renewed`, resourceType: kind === "license" ? "CannabisLicense" : "StaffCredential", resourceId: record.id, correlationId: key, reasonCode: "owner_renewal", evidence: JSON.parse(JSON.stringify(result)), evidenceHash: stableHash(result), occurredAt: new Date() }, query: "id" });
    return { ...result, replayed: false };
  });
}
