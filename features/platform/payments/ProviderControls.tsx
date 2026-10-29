'use client';
import { useActionState } from 'react';
import { updatePaymentProviderInstalled, linkTenderProvider } from './actions';

export function ProviderToggle({ id, installed }: { id: string; installed: boolean }) {
  const [state, action, pending] = useActionState(updatePaymentProviderInstalled, null as any);
  return <form action={action} className="flex items-center gap-2"><input type="hidden" name="providerId" value={id}/><input type="hidden" name="isInstalled" value={String(!installed)}/><button disabled={pending} className="rounded border px-3 py-1 text-xs">{installed ? 'Disable provider' : 'Mark installed'}</button>{state?.error && <span role="alert">{state.error}</span>}</form>;
}
export function TenderProviderLink({ providers, tenders }: { providers: Array<{id:string;name:string}>; tenders: Array<{id:string;displayName:string;type:string}> }) {
  const [state, action, pending] = useActionState(linkTenderProvider, null as any);
  return <form action={action} className="grid gap-2 border-t p-4 sm:grid-cols-3"><label className="text-xs">Tender configuration<select required name="tenderId" className="mt-1 block w-full rounded border bg-background p-2">{tenders.filter(t=>t.type!=='cash').map(t=><option key={t.id} value={t.id}>{t.displayName} · {t.type}</option>)}</select></label><label className="text-xs">Payment provider<select required name="providerId" className="mt-1 block w-full rounded border bg-background p-2">{providers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button disabled={pending} className="self-end rounded border px-3 py-2 text-sm">Link provider</button>{state?.error&&<span role="alert">{state.error}</span>}</form>;
}
