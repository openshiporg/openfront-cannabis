'use client';

import { useState, useTransition } from 'react';
import { ActionTrack, inputClass, labelClass, PillButton } from '@/features/platform/components/cannabis-ui';
import { FieldError, fieldProps, type FieldErrors } from '@/features/platform/lib/formErrors';
import { formatMinorUnits } from '@/features/lib/money';
import { formatMicrounits, parseQuantityToMicrounits } from '@/features/lib/quantity';
import { getAllocationQuote, type AllocationQuoteReadback } from '@/features/platform/fulfillment/actions/allocationQuote';
import {
  addCartLineFromDesk, advanceRecallFromDesk, cancelCartFromDesk, checkInAndStartSaleFromDesk, closeShiftFromDesk, finalizeSaleFromDesk,
  recordLabResultFromDesk, refundSaleFromDesk, releaseHoldFromDesk, releasePackageFromDesk,
} from '@/features/platform/workspaces/actions/workflows';
import { CommandStatus, useCommand } from './useCommand';

function Field({ name, title, errors, ...rest }: { name: string; title: string; errors?: FieldErrors } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className={labelClass}>{title}<input {...rest} {...fieldProps(name, errors)} className={`${inputClass} ${rest.className ?? ''}`} /><FieldError name={name} errors={errors} /></label>;
}

function Select({ name, title, errors, children, ...rest }: { name: string; title: string; errors?: FieldErrors; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <label className={labelClass}>{title}<select {...rest} {...fieldProps(name, errors)} className={inputClass}>{children}</select><FieldError name={name} errors={errors} /></label>;
}

function Check({ name, title, errors }: { name: string; title: string; errors?: FieldErrors }) {
  return <div><label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border bg-background px-3 text-sm has-[:checked]:border-foreground/30 has-[:checked]:bg-muted/60"><input type="checkbox" name={name} id={`field-${name}`} className="size-4 accent-green-700 dark:accent-green-400" />{title}</label><FieldError name={name} errors={errors} /></div>;
}

function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return <details className="rounded-lg bg-muted/40 ring-1 ring-inset ring-border/60">
    <summary className="flex cursor-pointer list-none items-center px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">{label}</summary>
    <div className="px-3 pb-3">{children}</div>
  </details>;
}

/** The second person signs for this one action on the same screen; nothing is signed in. */
function ApproverFields({ errors, role }: { errors?: FieldErrors; role: string }) {
  return <fieldset className="grid gap-3 rounded-lg bg-background/70 p-3 ring-1 ring-inset ring-border/60 sm:grid-cols-2">
    <legend className="px-1 text-xs font-medium">Second approver ({role})</legend>
    <Field name="approverEmail" title="Approver email" type="email" autoComplete="off" errors={errors} required />
    <Field name="approverPassword" title="Approver password" type="password" autoComplete="off" errors={errors} required />
  </fieldset>;
}

export function LabResultForm({ packageId, packageUid, labName, labResultReference, coaReference }: { packageId: string; packageUid: string; labName?: string | null; labResultReference?: string | null; coaReference?: string | null }) {
  const { state, onSubmit, pending, key, summary, markDirty } = useCommand(recordLabResultFromDesk);
  const errors = state.fieldErrors;
  return <Disclosure label="Record lab result">
    <form onSubmit={onSubmit()} onChange={markDirty} className="space-y-3" aria-label={`Record lab result for ${packageUid}`}>
      <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="packageId" value={packageId} />
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        <Select name="result" title="Result" errors={errors} required defaultValue=""><option value="" disabled>Choose</option><option value="passed">Passed</option><option value="failed">Failed</option></Select>
        <Field name="labName" title="Lab" errors={errors} defaultValue={labName ?? ''} required />
        <Field name="labResultReference" title="Result reference" errors={errors} defaultValue={labResultReference ?? ''} required className="font-mono" />
        <Field name="coaReference" title="COA reference" errors={errors} defaultValue={coaReference ?? ''} required className="font-mono" />
      </fieldset>
      <ActionTrack><PillButton type="submit" tone="ink" disabled={pending}>{pending ? 'Saving…' : 'Save lab result'}</PillButton></ActionTrack>
      <CommandStatus state={state} summary={summary} />
    </form>
  </Disclosure>;
}

export function ReleasePackageForm({ packageId, packageUid }: { packageId: string; packageUid: string }) {
  const { state, onSubmit, pending, key, summary } = useCommand(releasePackageFromDesk);
  return <form onSubmit={onSubmit(() => window.confirm(`Release ${packageUid} for sale?`))} className="space-y-2" aria-label={`Release ${packageUid}`}>
    <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="packageId" value={packageId} />
    <ActionTrack><PillButton type="submit" tone="ink" disabled={pending}>{pending ? 'Releasing…' : 'Release for sale'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

export function ReleaseHoldForm({ holdId, label }: { holdId: string; label: string }) {
  const { state, onSubmit, pending, key, summary, markDirty } = useCommand(releaseHoldFromDesk);
  const errors = state.fieldErrors;
  return <Disclosure label="Release hold">
    <form onSubmit={onSubmit()} onChange={markDirty} className="space-y-3" aria-label={`Release ${label}`}>
      <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="holdId" value={holdId} />
      <fieldset disabled={pending} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="releaseAuthorityReference" title="Release reference" errors={errors} required className="font-mono" />
          <Field name="reasonCode" title="Reason code" errors={errors} required pattern="[a-z][a-z0-9_]{2,99}" placeholder="retest_passed" className="font-mono" />
        </div>
        <ApproverFields errors={errors} role="compliance" />
      </fieldset>
      <ActionTrack><PillButton type="submit" tone="ink" disabled={pending}>{pending ? 'Releasing…' : 'Release hold'}</PillButton></ActionTrack>
      <CommandStatus state={state} summary={summary} />
    </form>
  </Disclosure>;
}

const RECALL_STAGES: Array<[string, string]> = [['hold', 'Hold'], ['scope_confirmed', 'Scope confirmed'], ['active', 'Active'], ['monitoring', 'Monitoring'], ['disposition', 'Disposition'], ['regulator_closed', 'Closed by regulator']];

export function AdvanceRecallForm({ recallId, reference, status }: { recallId: string; reference: string; status: string }) {
  const { state, onSubmit, pending, key, summary, markDirty } = useCommand(advanceRecallFromDesk);
  const errors = state.fieldErrors;
  const later = RECALL_STAGES.slice(RECALL_STAGES.findIndex(([value]) => value === status) + 1);
  const [next, setNext] = useState(later[0]?.[0] ?? '');
  if (!later.length) return null;
  const closing = next === 'regulator_closed';
  return <Disclosure label="Move to next stage">
    <form onSubmit={onSubmit(form => !closing || window.confirm(`Close recall ${reference} and ${form.get('disposition') === 'destroy' ? 'destroy' : 'release'} every package it holds?`))} onChange={markDirty} className="space-y-3" aria-label={`Advance recall ${reference}`}>
      <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="recallId" value={recallId} />
      <fieldset disabled={pending} className="grid gap-3">
        <Select name="nextStatus" title="Stage" errors={errors} value={next} onChange={event => setNext(event.target.value)}>{later.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        {closing && <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select name="disposition" title="Held packages" errors={errors} required defaultValue=""><option value="" disabled>Choose</option><option value="release">Release back to stock</option><option value="destroy">Destroy</option></Select>
            <Field name="closureReference" title="Regulator closure reference" errors={errors} required className="font-mono" />
          </div>
          <ApproverFields errors={errors} role="compliance" />
        </>}
      </fieldset>
      <ActionTrack><PillButton type="submit" tone={closing ? 'danger' : 'ink'} disabled={pending}>{pending ? 'Saving…' : closing ? 'Close recall' : 'Move stage'}</PillButton></ActionTrack>
      <CommandStatus state={state} summary={summary} />
    </form>
  </Disclosure>;
}

const ID_TYPES: Array<[string, string]> = [['drivers_license', 'Driver’s license'], ['state_id', 'State ID'], ['passport', 'Passport'], ['military_id', 'Military ID'], ['tribal_id', 'Tribal ID']];

export function CheckInForm({ shifts, medicalEnabled }: { shifts: Array<{ id: string; register: { name: string; code: string } | null }>; medicalEnabled: boolean }) {
  const { state, onSubmit, pending, key, summary, markDirty } = useCommand(checkInAndStartSaleFromDesk);
  const errors = state.fieldErrors;
  const [capacity, setCapacity] = useState('adult_use');
  const medical = capacity !== 'adult_use';
  return <form onSubmit={onSubmit()} onChange={markDirty} className="space-y-3" aria-label="Check in a customer">
    <input type="hidden" name="idempotencyKey" value={key} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <Select name="shiftId" title="Register" errors={errors} required defaultValue={shifts[0]?.id ?? ''}>{shifts.map(shift => <option key={shift.id} value={shift.id}>{shift.register ? `${shift.register.name} · ${shift.register.code}` : 'Open shift'}</option>)}</Select>
      <Select name="capacity" title="Buyer" errors={errors} value={capacity} onChange={event => setCapacity(event.target.value)}>
        <option value="adult_use">Adult-use</option>{medicalEnabled && <><option value="patient">Patient</option><option value="caregiver">Caregiver</option></>}
      </Select>
      <Select name="identityMethod" title="ID type" errors={errors} required defaultValue="">{[<option key="" value="" disabled>Choose</option>, ...ID_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)]}</Select>
      <Field name="identityNumber" title="ID number" errors={errors} required autoComplete="off" className="font-mono" />
      <Field name="dateOfBirth" title="Date of birth" type="date" errors={errors} required />
      <Field name="identityExpiresAt" title="ID expires" type="date" errors={errors} required />
      {medical && <>
        <Field name="registryName" title="Registry" errors={errors} required />
        <Field name="registryNumber" title="Registry card number" errors={errors} required autoComplete="off" className="font-mono" />
        <Field name="registryExpiresAt" title="Card expires" type="date" errors={errors} required />
      </>}
      {capacity === 'caregiver' && <Field name="representedPatientNumber" title="Patient’s registry number" errors={errors} required autoComplete="off" className="font-mono" />}
      <div className="grid gap-2 sm:col-span-2">
        <Check name="identityVerified" title="I checked this ID in person and it matches the buyer" errors={errors} />
        {medical && <Check name="registryVerified" title="I checked the registry card" errors={errors} />}
        {capacity === 'caregiver' && <Check name="representedPatientVerified" title="The caregiver is authorised for this patient" errors={errors} />}
      </div>
    </fieldset>
    <p className="text-xs text-muted-foreground">ID and card numbers are stored only as a one-way code.</p>
    <ActionTrack><PillButton type="submit" tone="ink" disabled={pending}>{pending ? 'Checking…' : 'Check in and start sale'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

type CartProduct = { id: string; name: string; sku: string; form: string; unitOfMeasure: string; unitQuantityMicrounits: number };

function AddLineForm({ cartId, products, currencyCode }: { cartId: string; products: CartProduct[]; currencyCode: string | null }) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [quantity, setQuantity] = useState('');
  const [quote, setQuote] = useState<{ data: AllocationQuoteReadback; productId: string; micro: number } | null>(null);
  const [message, setMessage] = useState('');
  const [quoting, startQuote] = useTransition();
  // A confirmed add clears the priced line; the page data refreshes with the server action.
  const { state, onSubmit, pending, key, summary } = useCommand(async (previous, formData) => {
    const next = await addCartLineFromDesk(previous, formData);
    if (next.success) { setQuote(null); setQuantity(''); }
    return next;
  });
  const product = products.find(entry => entry.id === productId);
  function price() {
    setQuote(null); setMessage('');
    const micro = product ? parseQuantityToMicrounits(quantity) : null;
    if (!product || !micro) { setMessage('Choose a product and a quantity.'); return; }
    if (micro % product.unitQuantityMicrounits !== 0) { setMessage(`Quantity must be a whole number of ${formatMicrounits(product.unitQuantityMicrounits, product.unitOfMeasure)} units.`); return; }
    const form = new FormData(); form.set('cartId', cartId); form.set('productId', product.id); form.set('quantityMicrounits', String(micro));
    startQuote(async () => {
      const result = await getAllocationQuote(form);
      if ('data' in result) setQuote({ data: result.data, productId: product.id, micro }); else setMessage(result.error);
    });
  }
  if (!products.length) return <p className="text-sm text-muted-foreground">No active products.</p>;
  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
      <label className={labelClass}>Product<select value={productId} onChange={event => { setProductId(event.target.value); setQuote(null); }} className={inputClass}>{products.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {entry.form}</option>)}</select></label>
      <label className={labelClass}>Quantity{product ? ` (${product.unitOfMeasure})` : ''}<input value={quantity} onChange={event => { setQuantity(event.target.value); setQuote(null); }} inputMode="decimal" placeholder={product ? formatMicrounits(product.unitQuantityMicrounits) : ''} className={`${inputClass} font-mono`} /></label>
      <ActionTrack><PillButton onClick={price} disabled={quoting}>{quoting ? 'Pricing…' : 'Price'}</PillButton></ActionTrack>
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
    {quote && <form onSubmit={onSubmit()} className="flex flex-wrap items-center gap-3" aria-label="Add to cart">
      <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="cartId" value={cartId} /><input type="hidden" name="productId" value={quote.productId} />
      <input type="hidden" name="quantityMicrounits" value={quote.micro} /><input type="hidden" name="expectedCartVersion" value={quote.data.cartVersion} /><input type="hidden" name="reviewedQuoteHash" value={quote.data.quoteHash} />
      <span className="font-mono text-sm">{formatMicrounits(quote.micro, quote.data.unitOfMeasure)} · {formatMinorUnits(quote.data.totalCents, quote.data.currencyCode ?? currencyCode)} <span className="text-muted-foreground">incl. tax {formatMinorUnits(quote.data.taxCents, quote.data.currencyCode ?? currencyCode)}</span></span>
      <ActionTrack><PillButton type="submit" tone="ink" disabled={pending}>{pending ? 'Adding…' : 'Add to cart'}</PillButton></ActionTrack>
    </form>}
    <CommandStatus state={state} summary={summary} />
  </div>;
}

export type PosCart = {
  id: string; reference: string; status: string; totalCents: number; subtotalCents: number | null; taxCents: number | null; discountCents: number | null;
  customer: { reference: string; capacity: string } | null; shift: { operator: { id: string } | null } | null;
  lines: Array<{ id: string; titleSnapshot: string; quantityMicrounits: number; totalCents: number; package: { unitOfMeasure: string } | null }>;
};

export function CartPanel({ cart, products, tenderTypes, currencyCode, actorId }: { cart: PosCart; products: CartProduct[]; tenderTypes: Array<{ type: string; displayName: string }>; currencyCode: string | null; actorId: string }) {
  const money = (cents: number | null) => formatMinorUnits(cents ?? 0, currencyCode);
  const mine = cart.shift?.operator?.id === actorId;
  const open = ['preliminarily_eligible', 'reserved'].includes(cart.status);
  return <div className="space-y-4">
    {cart.lines.length ? <ul className="divide-y divide-border overflow-hidden rounded-lg bg-background ring-1 ring-inset ring-border/60">{cart.lines.map(line => <li key={line.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"><span className="min-w-0">{line.titleSnapshot} <span className="font-mono text-xs text-muted-foreground">{formatMicrounits(line.quantityMicrounits, line.package?.unitOfMeasure)}</span></span><span className="font-mono">{money(line.totalCents)}</span></li>)}
      <li className="flex items-baseline justify-between gap-3 px-3 py-2 text-xs text-muted-foreground"><span>Subtotal {money(cart.subtotalCents)} · tax {money(cart.taxCents)}{cart.discountCents ? ` · discount ${money(cart.discountCents)}` : ''}</span><span className="font-mono text-sm font-medium text-foreground">{money(cart.totalCents)}</span></li>
    </ul> : <p className="text-sm text-muted-foreground">No items yet.</p>}
    {!mine ? <p className="text-sm text-muted-foreground">Rung up on another person’s shift.</p> : open ? <>
      <AddLineForm cartId={cart.id} products={products} currencyCode={currencyCode} />
      {cart.lines.length > 0 && cart.status === 'reserved' && <PayForm cart={cart} tenderTypes={tenderTypes} money={money} />}
      <CancelCartForm cartId={cart.id} reference={cart.reference} />
    </> : null}
  </div>;
}

function PayForm({ cart, tenderTypes, money }: { cart: PosCart; tenderTypes: Array<{ type: string; displayName: string }>; money: (cents: number | null) => string }) {
  const { state, onSubmit, pending, key, summary, markDirty } = useCommand(finalizeSaleFromDesk);
  const errors = state.fieldErrors;
  const [type, setType] = useState(tenderTypes[0]?.type ?? '');
  if (!tenderTypes.length) return <p className="text-sm text-muted-foreground">No payment types are in effect.</p>;
  return <form onSubmit={onSubmit(() => window.confirm(`Take ${money(cart.totalCents)} and complete the sale?`))} onChange={markDirty} className="space-y-3 rounded-lg bg-background/70 p-3 ring-1 ring-inset ring-border/60" aria-label={`Take payment for ${cart.reference}`}>
    <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="cartId" value={cart.id} /><input type="hidden" name="totalCents" value={cart.totalCents} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <Select name="tenderType" title="Payment" errors={errors} value={type} onChange={event => setType(event.target.value)}>{tenderTypes.map(tender => <option key={tender.type} value={tender.type}>{tender.displayName}</option>)}</Select>
      {type === 'cash'
        ? <Field name="tendered" title="Cash received" errors={errors} required inputMode="decimal" placeholder={(cart.totalCents / 100).toFixed(2)} className="font-mono" />
        : <Field name="providerReference" title="Terminal approval code" errors={errors} required autoComplete="off" className="font-mono" />}
      {cart.customer?.capacity === 'caregiver' && <div className="sm:col-span-2"><Check name="representedPatientVerified" title="Caregiver authority checked again at payment" errors={errors} /></div>}
    </fieldset>
    <ActionTrack><PillButton type="submit" tone="ink" disabled={pending}>{pending ? 'Completing…' : `Complete sale · ${money(cart.totalCents)}`}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

function CancelCartForm({ cartId, reference }: { cartId: string; reference: string }) {
  const { state, onSubmit, pending, key, summary } = useCommand(cancelCartFromDesk);
  return <form onSubmit={onSubmit(() => window.confirm(`Cancel ${reference} and put its items back?`))} className="space-y-2" aria-label={`Cancel ${reference}`}>
    <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="cartId" value={cartId} />
    <ActionTrack><PillButton type="submit" tone="danger" disabled={pending}>{pending ? 'Cancelling…' : 'Cancel cart'}</PillButton></ActionTrack>
    <CommandStatus state={state} summary={summary} />
  </form>;
}

export function CloseShiftForm({ shiftId }: { shiftId: string }) {
  const { state, onSubmit, pending, key, summary, markDirty } = useCommand(closeShiftFromDesk);
  const errors = state.fieldErrors;
  return <Disclosure label="Count and close">
    <form onSubmit={onSubmit()} onChange={markDirty} className="space-y-3" aria-label="Count and close shift">
      <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="shiftId" value={shiftId} />
      <fieldset disabled={pending} className="grid gap-3">
        <Field name="actualCash" title="Cash counted in the drawer" errors={errors} required inputMode="decimal" className="font-mono" />
        <ApproverFields errors={errors} role="finance" />
      </fieldset>
      <ActionTrack><PillButton type="submit" tone="ink" disabled={pending}>{pending ? 'Closing…' : 'Close shift'}</PillButton></ActionTrack>
      <CommandStatus state={state} summary={summary} />
    </form>
  </Disclosure>;
}

const DISPOSITIONS: Array<[string, string]> = [['none', 'Nothing returned'], ['quarantine', 'Quarantine'], ['waste', 'Waste'], ['returned_to_authority', 'Returned to the authority']];

export function RefundForm({ saleId, tenders, remainingCents, currencyCode }: { saleId: string; tenders: Array<{ id: string; typeSnapshot: string; amountCents: number }>; remainingCents: number; currencyCode: string | null }) {
  const { state, onSubmit, pending, key, summary, markDirty } = useCommand(refundSaleFromDesk);
  const errors = state.fieldErrors;
  const [tenderId, setTenderId] = useState(tenders[0]?.id ?? '');
  const tender = tenders.find(entry => entry.id === tenderId);
  if (!tenders.length || remainingCents <= 0) return null;
  return <Disclosure label="Refund">
    <form onSubmit={onSubmit(form => window.confirm(`Refund ${form.get('amount')}?`))} onChange={markDirty} className="space-y-3" aria-label="Refund this sale">
      <input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="saleId" value={saleId} />
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        <Select name="originalTenderId" title="Original payment" errors={errors} value={tenderId} onChange={event => setTenderId(event.target.value)}>{tenders.map(entry => <option key={entry.id} value={entry.id}>{entry.typeSnapshot === 'ach' ? 'ACH' : entry.typeSnapshot.charAt(0).toUpperCase() + entry.typeSnapshot.slice(1)} · {formatMinorUnits(entry.amountCents, currencyCode)}</option>)}</Select>
        <Field name="amount" title={`Amount (up to ${formatMinorUnits(remainingCents, currencyCode)})`} errors={errors} required inputMode="decimal" className="font-mono" />
        <Field name="reasonCode" title="Reason code" errors={errors} required pattern="[a-z][a-z0-9_]{2,99}" placeholder="damaged_product" className="font-mono" />
        <Select name="inventoryDisposition" title="Returned product" errors={errors} required defaultValue="">{[<option key="" value="" disabled>Choose</option>, ...DISPOSITIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)]}</Select>
        {tender && tender.typeSnapshot !== 'cash' && <Field name="providerReference" title="Terminal refund reference" errors={errors} required autoComplete="off" className="font-mono" />}
      </fieldset>
      <ApproverFields errors={errors} role="finance" />
      <ActionTrack><PillButton type="submit" tone="danger" disabled={pending}>{pending ? 'Refunding…' : 'Record refund'}</PillButton></ActionTrack>
      <CommandStatus state={state} summary={summary} />
    </form>
  </Disclosure>;
}
