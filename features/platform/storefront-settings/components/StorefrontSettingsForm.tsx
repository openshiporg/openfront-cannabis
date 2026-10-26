'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Actions, Dot, DotLabel, inputClass, labelClass, Panel, Button, textareaClass } from '@/features/platform/components/cannabis-ui';
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

export function StorefrontSettingsForm({ setup, previewItems = [], previewStrip }: { setup: StoreSettingsSetup; previewItems?: Array<{ form: string; name: string }>; previewStrip?: { age: string; hours: string } }) {
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
      {!setup.canSave && <p role="status" className="flex items-baseline gap-2 rounded-md border border-red-300/70 bg-red-50 px-3 py-2.5 text-[13px] dark:border-red-900/70 dark:bg-red-950/30"><Dot tone="danger" />Saving unavailable until the premises license and your staff credential are current.</p>}

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
              <span className="mt-1 block text-right font-normal tabular-nums text-muted-foreground">{values.description.length}/240</span>
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
                <input {...fieldProps('logoColor', fieldErrors)} type="number" min="0" max="359" value={values.logoColor} onChange={event => update('logoColor', event.target.value)} className={`${inputClass} mt-0 w-24 tabular-nums`} />
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
            <input {...fieldProps('brandHue', fieldErrors)} type="number" min="0" max="359" step="1" value={values.brandHue} onChange={event => update('brandHue', Number(event.target.value))} className={`${inputClass} mt-0 w-24 tabular-nums`} />
            <span className="size-9 shrink-0 rounded-[5px] border border-black/10" aria-hidden="true" style={{ backgroundColor: accent(28) }} />
          </div>
          <FieldError name="brandHue" errors={fieldErrors} />
        </Panel>
      </fieldset>

      <div aria-live="polite" className="space-y-2">
        {status.kind === 'saved' && <p role="status" className="flex items-baseline gap-2 text-sm"><Dot tone="ok" />{status.recovered ? 'Your earlier save was recorded. Store Settings are published.' : 'Saved and published.'}</p>}
        {status.kind === 'invalid' && <p ref={summary} tabIndex={-1} role="alert" className="flex items-baseline gap-2 text-sm text-destructive"><Dot tone="danger" />Fix the highlighted fields.</p>}
        {status.kind === 'rejected' && <p ref={summary} tabIndex={-1} role="alert" className="flex items-baseline gap-2 text-sm text-destructive"><Dot tone="danger" />Store Settings could not be saved. Check your access and try again.</p>}
        {status.kind === 'conflict' && <div ref={summary} tabIndex={-1} role="alert" className="space-y-2 text-sm"><p className="flex items-baseline gap-2 text-destructive"><Dot tone="danger" />Store Settings changed since you opened them. Your changes are still shown; reload to see the latest version.</p><Actions><Button onClick={reload}>Reload</Button></Actions></div>}
        {status.kind === 'unknown' && <div ref={summary} tabIndex={-1} role="alert" className="space-y-2 text-sm"><p className="flex items-baseline gap-2"><Dot tone="warn" />We couldn&apos;t confirm whether your save went through.</p><Actions>
          <Button disabled={pending || !attempt.current} onClick={() => attempt.current && send(attempt.current, checkStoreSettingsSave)}>Check save status</Button>
          <Button tone="primary" disabled={pending || !attempt.current} onClick={() => attempt.current && send(attempt.current, saveStoreSettings)}>Retry same save</Button>
        </Actions></div>}
        {logoDraftPending && <p role="status" className="flex items-baseline gap-2 text-sm text-muted-foreground"><Dot tone="warn" />Apply or discard the custom logo before saving.</p>}
      </div>

      <Actions><Button type="submit" tone="primary" disabled={pending || !setup.canSave || logoDraftPending || status.kind === 'unknown' || (!dirty && Boolean(setup.values) && published)}>{pending ? 'Saving…' : 'Save and publish'}</Button></Actions>
    </div>

    <aside aria-label="Storefront preview" className="xl:sticky xl:top-4">
      <p className="mb-2 text-[13px] font-semibold">Preview</p>
      <div className="storefront-theme overflow-hidden rounded-md border border-border" style={{ '--cn-h': values.brandHue } as React.CSSProperties}>
        <div className="flex items-center justify-between bg-cn-ink px-3 py-1 text-[11px] font-semibold text-cn-on-ink"><span>{previewStrip?.age ?? '21+ ONLY'}</span><span className="truncate pl-3">{previewStrip?.hours ?? 'In-store purchase only'}</span></div>
        <div className="border-b border-cn-line px-3 py-1.5 text-cn-ink"><StoreLogo svg={values.logoIcon} hue={values.logoColor} name={values.businessName || 'Business name'} size="sm" /></div>
        <div className="relative h-36 bg-cn-raise">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/storefront/cover-silver-star-haze.jpg" alt="" className="absolute inset-0 size-full object-cover [object-position:36%_42%]" />
          <p className="cn-display absolute bottom-0 left-0 max-w-[90%] break-words bg-cn-bg px-3 pb-2 pt-2 text-[30px] text-cn-ink">{values.businessName || 'Business name'}</p>
        </div>
        <div className="space-y-2 bg-cn-page px-3 py-3">
          {values.tagline && <p className="cn-name break-words text-[14px] leading-5 text-cn-ink-2">{values.tagline}</p>}
          {values.description && <p className="break-words text-[12px] leading-[18px] text-cn-ink-3">{values.description}</p>}
          <span className="inline-flex items-baseline gap-1.5 text-[12px] text-cn-ink-2"><span className="cn-dot" style={{ backgroundColor: accent(60, 46) }} />In-store only</span>
        </div>
        {previewItems.length > 0 && <div className="px-3 pb-3">
          {previewItems.map(item => <div key={item.name} className="flex items-baseline justify-between gap-3 border-t border-cn-line py-2 text-cn-ink"><span className="cn-name truncate text-[15px]">{item.name}</span><span className="shrink-0 text-[11px] text-cn-ink-3">{item.form}</span></div>)}
        </div>}
      </div>
    </aside>
  </form>;
}
