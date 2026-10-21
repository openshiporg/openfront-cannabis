'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Palette, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_STORE_LOGO_ICON } from '@/features/lib/store-logo';
import { FieldError, fieldProps, useFocusFirstError, type FieldErrors, type FormState } from '@/features/platform/lib/formErrors';
import { useUnsavedChangesGuard } from '@/features/platform/lib/useUnsavedChangesGuard';
import { checkStoreSettingsSave, saveStoreSettings, type SaveStoreSettingsInput, type SaveStoreSettingsResult, type StoreSettingsSetup, type StoreSettingsValues } from '../actions/settings';
import { LogoPicker } from './LogoPicker';

const EMPTY: StoreSettingsValues = { businessName: '', tagline: '', description: '', brandHue: 215, logoIcon: DEFAULT_STORE_LOGO_ICON, logoColor: '0' };
const same = (left: StoreSettingsValues, right: StoreSettingsValues) => (Object.keys(left) as Array<keyof StoreSettingsValues>).every(key => left[key] === right[key]);

type Status =
  | { kind: 'idle' } | { kind: 'saved'; recovered?: boolean } | { kind: 'invalid' } | { kind: 'conflict' } | { kind: 'rejected' } | { kind: 'unknown' };

export function StorefrontSettingsForm({ setup }: { setup: StoreSettingsSetup }) {
  const router = useRouter();
  const [baseline, setBaseline] = useState<StoreSettingsValues>(setup.values ?? EMPTY);
  const [values, setValues] = useState<StoreSettingsValues>(setup.values ?? EMPTY);
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

  return <form onSubmit={submit} className="max-w-2xl space-y-6" data-testid="storefront-settings-form" noValidate>
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Status</span>
      <Badge variant="outline">{published ? 'Published' : setup.values ? 'Draft' : 'Not set up'}</Badge>
      {dirty && <Badge variant="secondary">Unsaved changes</Badge>}
    </div>
    {!setup.canSave && <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">Saving is unavailable until the premises license and your staff credential are current.</p>}

    <fieldset disabled={!setup.canSave || status.kind === 'unknown'} className="space-y-6">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Business details</h2>
        <div className="space-y-1.5">
          <Label htmlFor="field-businessName">Business name</Label>
          <Input {...fieldProps('businessName', fieldErrors)} maxLength={120} value={values.businessName} onChange={event => update('businessName', event.target.value)} autoComplete="organization" />
          <FieldError name="businessName" errors={fieldErrors} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="field-tagline">Tagline <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input {...fieldProps('tagline', fieldErrors)} maxLength={180} value={values.tagline} onChange={event => update('tagline', event.target.value)} />
          <FieldError name="tagline" errors={fieldErrors} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="field-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea {...fieldProps('description', fieldErrors)} maxLength={240} rows={3} value={values.description} onChange={event => update('description', event.target.value)} />
          <FieldError name="description" errors={fieldErrors} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <LogoPicker value={values.logoIcon} hue={values.logoColor} onChange={svg => update('logoIcon', svg)} onDraftPendingChange={setLogoDraftPending} />
        <FieldError name="logoIcon" errors={fieldErrors} />
        <div className="space-y-1.5">
          <Label htmlFor="field-logoColor">Logo colour</Label>
          <Input {...fieldProps('logoColor', fieldErrors)} type="number" min="0" max="359" value={values.logoColor} onChange={event => update('logoColor', event.target.value)} className="w-28" />
          <FieldError name="logoColor" errors={fieldErrors} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2"><Palette className="size-5" aria-hidden="true" /><h2 className="font-semibold">Accent hue</h2></div>
        <div className="flex items-center gap-3">
          <input aria-label="Accent hue slider" type="range" min="0" max="359" step="1" value={values.brandHue} onChange={event => update('brandHue', Number(event.target.value))} className="w-full" />
          <Input {...fieldProps('brandHue', fieldErrors)} aria-label="Accent hue" type="number" min="0" max="359" step="1" value={values.brandHue} onChange={event => update('brandHue', Number(event.target.value))} className="w-28" />
          <span className="size-8 shrink-0 rounded-full border" aria-hidden="true" style={{ backgroundColor: `hsl(${values.brandHue} 58% 40%)` }} />
        </div>
        <FieldError name="brandHue" errors={fieldErrors} />
      </section>
    </fieldset>

    <div aria-live="polite">
      {status.kind === 'saved' && <p role="status" className="text-sm">{status.recovered ? 'Your earlier save was recorded. Store Settings are published.' : 'Store Settings saved and published.'}</p>}
      {status.kind === 'invalid' && <p ref={summary} tabIndex={-1} role="alert" className="text-sm text-destructive">Fix the highlighted fields.</p>}
      {status.kind === 'rejected' && <p ref={summary} tabIndex={-1} role="alert" className="text-sm text-destructive">Store Settings could not be saved. Check your access and try again.</p>}
      {status.kind === 'conflict' && <div ref={summary} tabIndex={-1} role="alert" className="space-y-2 text-sm"><p className="text-destructive">Store settings changed since you opened them. Your changes are still shown here; reload to see the latest version.</p><Button type="button" size="sm" variant="outline" onClick={reload}>Reload</Button></div>}
      {status.kind === 'unknown' && <div ref={summary} tabIndex={-1} role="alert" className="space-y-2 text-sm"><p>We couldn't confirm whether your save went through.</p><div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={pending || !attempt.current} onClick={() => attempt.current && send(attempt.current, checkStoreSettingsSave)}>Check save status</Button>
        <Button type="button" size="sm" disabled={pending || !attempt.current} onClick={() => attempt.current && send(attempt.current, saveStoreSettings)}>Retry same save</Button>
      </div></div>}
      {logoDraftPending && <p role="status" className="text-sm text-muted-foreground">Apply or discard the custom logo before saving.</p>}
    </div>

    <Button type="submit" disabled={pending || !setup.canSave || logoDraftPending || status.kind === 'unknown' || (!dirty && Boolean(setup.values) && published)}>{pending ? 'Saving…' : 'Save Store Settings'}<Save className="size-4" /></Button>
  </form>;
}
