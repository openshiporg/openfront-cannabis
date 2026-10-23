'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ActionTrack, Dot, DotLabel, inputClass, labelClass, Panel, PillButton, textareaClass } from '@/features/platform/components/cannabis-ui';
import { StoreLogo } from '@/features/storefront/components/StoreLogo';
import { CANNABIS_ACCENT_HUE, CANNABIS_LOGO_COLOR, CANNABIS_LOGO_ICON, isDefaultMark } from '@/features/storefront/lib/brand';
import { FieldError, fieldProps, useFocusFirstError, type FieldErrors, type FormState } from '@/features/platform/lib/formErrors';
import { useUnsavedChangesGuard } from '@/features/platform/lib/useUnsavedChangesGuard';
import { checkStoreSettingsSave, saveStoreSettings, type SaveStoreSettingsInput, type SaveStoreSettingsResult, type StoreSettingsSetup, type StoreSettingsValues } from '../actions/settings';
import { LogoPicker } from './LogoPicker';

const EMPTY: StoreSettingsValues = { businessName: '', tagline: '', description: '', brandHue: CANNABIS_ACCENT_HUE, logoIcon: CANNABIS_LOGO_ICON, logoColor: CANNABIS_LOGO_COLOR };
// A row still on the family's stored default mark opens on the Cannabis default instead.
const initial = (values: StoreSettingsValues | null) => values ? (isDefaultMark(values.logoIcon) ? { ...values, logoIcon: CANNABIS_LOGO_ICON, logoColor: CANNABIS_LOGO_COLOR } : values) : EMPTY;
const same = (left: StoreSettingsValues, right: StoreSettingsValues) => (Object.keys(left) as Array<keyof StoreSettingsValues>).every(key => left[key] === right[key]);

type Status =
  | { kind: 'idle' } | { kind: 'saved'; recovered?: boolean } | { kind: 'invalid' } | { kind: 'conflict' } | { kind: 'rejected' } | { kind: 'unknown' };

export function StorefrontSettingsForm({ setup, previewItems = [] }: { setup: StoreSettingsSetup; previewItems?: Array<{ form: string; name: string }> }) {
  const router = useRouter();
  const [baseline, setBaseline] = useState<StoreSettingsValues>(() => initial(setup.values));
  const [values, setValues] = useState<StoreSettingsValues>(() => initial(setup.values));
  const [revision, setRevision] = useState(setup.revision);
  const [published, setPublished] = useState(setup.publicationStatus === 'published');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [logoDraftPending, setLogoDraftPending] = useState(false);
  const [pending, startTransition] = useTransition();
  // One command identity per reviewed edit; it survives retries until the outcome is definite.
  const attempt = useRef<SaveStoreSettingsInput | null>(null);
  const dirty = !same(values, baseline);
  useUnsavedChangesGuard(dirty || logoDraftPending);
  const formState: FormState = { fieldErrors, error: status.kind === 'rejected' || status.kind === 'conflict' || status.kind === 'unknown' ? status.kind : undefined };
  const summary = useFocusFirstError(formState);

  function update<K extends keyof StoreSettingsValues>(key: K, value: StoreSettingsValues[K]) {
    if (status.kind === 'unknown') return; // the original save must be resolved first
    setValues(current => ({ ...current, [key]: value }));
    if (status.kind !== 'idle') setStatus({ kind: 'idle' });
    attempt.current = null;
  }

  function apply(result: SaveStoreSettingsResult, sent: SaveStoreSettingsInput) {
    if (result.status === 'saved') {
      attempt.current = null; setFieldErrors(undefined); setBaseline(sent.values); setPublished(true);
      if (result.revision) setRevision(result.revision); else router.refresh();
      setStatus({ kind: 'saved', recovered: result.recovered });
    } else if (result.status === 'invalid') {
      attempt.current = null; setFieldErrors(result.fieldErrors); setStatus({ kind: 'invalid' });
    } else if (result.status === 'unknown') {
      setStatus({ kind: 'unknown' });
    } else {
      attempt.current = null; setStatus({ kind: result.status });
    }
  }

  function send(input: SaveStoreSettingsInput, action: typeof saveStoreSettings) {
    startTransition(async () => {
      try { apply(await action(input), input); } catch { setStatus({ kind: 'unknown' }); }
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (logoDraftPending || pending) return;
    attempt.current ??= { values, expectedRevision: revision, idempotencyKey: `store-settings:${crypto.randomUUID()}` };
    send(attempt.current, saveStoreSettings);
  }

  function reload() {
    attempt.current = null;
    window.location.reload();
  }

  const statusLabel = published ? 'Saved and published' : setup.values ? 'Draft' : 'Not set up';
  const accent = (lightness: number, saturation = 38) => `hsl(${values.brandHue} ${saturation}% ${lightness}%)`;
  return <form onSubmit={submit} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]" data-testid="storefront-settings-form" noValidate>
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <DotLabel tone={published ? 'ok' : setup.values ? 'warn' : 'muted'}>{statusLabel}</DotLabel>
        {dirty && <DotLabel tone="info" className="text-muted-foreground">Unsaved changes</DotLabel>}
      </div>
      {!setup.canSave && <p role="status" className="flex items-baseline gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm ring-1 ring-inset ring-border/60"><Dot tone="danger" />Saving unavailable until the premises license and your staff credential are current.</p>}

      <fieldset disabled={!setup.canSave || status.kind === 'unknown'} className="space-y-6">
        <Panel title="Business">
          <div className="grid gap-4">
            <label className={labelClass} htmlFor="field-businessName">Business name
              <input {...fieldProps('businessName', fieldErrors)} required aria-required="true" maxLength={120} value={values.businessName} onChange={event => update('businessName', event.target.value)} autoComplete="organization" className={inputClass} />
              <FieldError name="businessName" errors={fieldErrors} />
            </label>
            <label className={labelClass} htmlFor="field-tagline">Tagline <span className="font-normal text-muted-foreground">(optional)</span>
              <input {...fieldProps('tagline', fieldErrors)} maxLength={180} value={values.tagline} onChange={event => update('tagline', event.target.value)} className={inputClass} />
              <FieldError name="tagline" errors={fieldErrors} />
            </label>
            <label className={labelClass} htmlFor="field-description">Description <span className="font-normal text-muted-foreground">(optional)</span>
              <textarea {...fieldProps('description', fieldErrors)} maxLength={240} rows={3} value={values.description} onChange={event => update('description', event.target.value)} className={textareaClass} />
              <span className="mt-1 block text-right font-mono font-normal text-muted-foreground">{values.description.length}/240</span>
              <FieldError name="description" errors={fieldErrors} />
            </label>
          </div>
        </Panel>

        <Panel title="Logo">
          <div className="space-y-5">
            <LogoPicker value={values.logoIcon} hue={values.logoColor} onChange={svg => update('logoIcon', svg)} onDraftPendingChange={setLogoDraftPending} />
            <FieldError name="logoIcon" errors={fieldErrors} />
            <div>
              <span className={labelClass}>Logo colour</span>
              <div className="mt-1.5 flex items-center gap-3">
                <label htmlFor="logo-colour-range" className="sr-only">Logo colour (slider)</label>
                <input id="logo-colour-range" type="range" min="0" max="359" step="1" value={values.logoColor} onChange={event => update('logoColor', event.target.value)} className="h-2 w-full cursor-pointer accent-foreground" />
                <label htmlFor="field-logoColor" className="sr-only">Logo colour (degrees)</label>
                <input {...fieldProps('logoColor', fieldErrors)} type="number" min="0" max="359" value={values.logoColor} onChange={event => update('logoColor', event.target.value)} className={`${inputClass} mt-0 w-24 font-mono`} />
              </div>
              <FieldError name="logoColor" errors={fieldErrors} />
            </div>
          </div>
        </Panel>

        <Panel title="Storefront accent">
          <div className="flex items-center gap-3">
            <label htmlFor="accent-hue-range" className="sr-only">Accent hue (slider)</label>
            <input id="accent-hue-range" type="range" min="0" max="359" step="1" value={values.brandHue} onChange={event => update('brandHue', Number(event.target.value))} className="h-2 w-full cursor-pointer" style={{ accentColor: accent(34) }} />
            <label htmlFor="field-brandHue" className="sr-only">Accent hue (degrees)</label>
            <input {...fieldProps('brandHue', fieldErrors)} type="number" min="0" max="359" step="1" value={values.brandHue} onChange={event => update('brandHue', Number(event.target.value))} className={`${inputClass} mt-0 w-24 font-mono`} />
            <span className="size-9 shrink-0 rounded-full ring-1 ring-inset ring-black/10" aria-hidden="true" style={{ backgroundColor: accent(28) }} />
          </div>
          <FieldError name="brandHue" errors={fieldErrors} />
        </Panel>
      </fieldset>

      <div aria-live="polite" className="space-y-2">
        {status.kind === 'saved' && <p role="status" className="flex items-baseline gap-2 text-sm"><Dot tone="ok" />{status.recovered ? 'Your earlier save was recorded. Store Settings are published.' : 'Saved and published.'}</p>}
        {status.kind === 'invalid' && <p ref={summary} tabIndex={-1} role="alert" className="flex items-baseline gap-2 text-sm text-destructive"><Dot tone="danger" />Fix the highlighted fields.</p>}
        {status.kind === 'rejected' && <p ref={summary} tabIndex={-1} role="alert" className="flex items-baseline gap-2 text-sm text-destructive"><Dot tone="danger" />Store Settings could not be saved. Check your access and try again.</p>}
        {status.kind === 'conflict' && <div ref={summary} tabIndex={-1} role="alert" className="space-y-2 text-sm"><p className="flex items-baseline gap-2 text-destructive"><Dot tone="danger" />Store Settings changed since you opened them. Your changes are still shown; reload to see the latest version.</p><ActionTrack><PillButton onClick={reload}>Reload</PillButton></ActionTrack></div>}
        {status.kind === 'unknown' && <div ref={summary} tabIndex={-1} role="alert" className="space-y-2 text-sm"><p className="flex items-baseline gap-2"><Dot tone="warn" />We couldn&apos;t confirm whether your save went through.</p><ActionTrack>
          <PillButton disabled={pending || !attempt.current} onClick={() => attempt.current && send(attempt.current, checkStoreSettingsSave)}>Check save status</PillButton>
          <PillButton tone="ink" disabled={pending || !attempt.current} onClick={() => attempt.current && send(attempt.current, saveStoreSettings)}>Retry same save</PillButton>
        </ActionTrack></div>}
        {logoDraftPending && <p role="status" className="flex items-baseline gap-2 text-sm text-muted-foreground"><Dot tone="warn" />Apply or discard the custom logo before saving.</p>}
      </div>

      <ActionTrack><PillButton type="submit" tone="ink" disabled={pending || !setup.canSave || logoDraftPending || status.kind === 'unknown' || (!dirty && Boolean(setup.values) && published)}>{pending ? 'Saving…' : 'Save and publish'}</PillButton></ActionTrack>
    </div>

    <aside aria-label="Storefront preview" className="xl:sticky xl:top-4">
      <p className="mb-2.5 text-sm font-semibold">Preview</p>
      <div className="overflow-hidden rounded-xl text-[#18201b] shadow-sm ring-1 ring-black/10" style={{ backgroundColor: '#f3f0e8' }}>
        <div className="flex items-center justify-between bg-[#18201b] px-4 py-1.5 font-mono text-[10px] tracking-[0.12em] text-[#f6f4ee]"><span>21+ ONLY</span><span className="font-sans tracking-normal opacity-75">In-store purchase only</span></div>
        <div className="border-b border-[#d9d4c6] px-4 py-2"><StoreLogo svg={values.logoIcon} hue={values.logoColor} name={values.businessName || 'Business name'} size="sm" /></div>
        <div className="space-y-3 px-4 pb-5 pt-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="min-w-0 break-words font-[family-name:var(--font-cn-display)] text-[30px] leading-[32px] tracking-[-0.02em]">{values.businessName || 'Business name'}</p>
            <span className="inline-flex items-baseline gap-1.5 text-xs text-[#545b53]"><span className="inline-block size-2 translate-y-[-0.1em] rounded-full" style={{ backgroundColor: accent(28) }} />In-store only</span>
          </div>
          {values.tagline && <p className="break-words font-[family-name:var(--font-cn-display)] text-[17px] leading-6">{values.tagline}</p>}
          {values.description && <p className="break-words text-[13px] leading-5 text-[#545b53]">{values.description}</p>}
          {previewItems.length > 0 && <div className="grid grid-cols-2 gap-2 pt-2">
            {previewItems.map(item => <div key={item.name} className="flex aspect-[4/5] min-w-0 flex-col justify-between rounded-[14px] p-3" style={{ backgroundColor: accent(88, 28), color: accent(28) }}>
              <span className="truncate font-mono text-[9px] uppercase tracking-[0.14em]">{item.form}</span>
              <span className="font-[family-name:var(--font-cn-display)] text-[56px] leading-none">{item.name.charAt(0).toUpperCase()}</span>
            </div>)}
          </div>}
        </div>
      </div>
    </aside>
  </form>;
}
