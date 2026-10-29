'use server';
import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export async function updatePaymentProviderInstalled(_state: unknown, formData: FormData) {
  const id = String(formData.get('providerId') || ''); const installed = formData.get('isInstalled') === 'true';
  if (!id) return { error: 'Choose a provider.' };
  if (installed) {
    const lookup = await keystoneClient('query($id:ID!){ paymentProvider(where:{id:$id}){ code } }', { id });
    const code = lookup.success ? lookup.data.paymentProvider?.code : null;
    if (!code) return { error: 'Provider is unavailable.' };
    if (code.startsWith('pp_aeropay') && !(process.env.AEROPAY_API_KEY && process.env.AEROPAY_API_SECRET && process.env.AEROPAY_MERCHANT_ID && process.env.AEROPAY_WEBHOOK_SECRET && process.env.AEROPAY_BANK_ACCOUNT_ID)) return { error: 'Aeropay is Not configured; merchant credentials and bank account setup are required before installation.' };
  }
  const result = await keystoneClient('mutation($where:PaymentProviderWhereUniqueInput!,$data:PaymentProviderUpdateInput!){ updatePaymentProvider(where:$where,data:$data){ id isInstalled } }', { where: { id }, data: { isInstalled: installed } });
  revalidatePath('/dashboard/platform/payment-providers');
  return result.success ? { success: true } : { error: result.error };
}

export async function linkTenderProvider(_state: unknown, formData: FormData) {
  const tenderId = String(formData.get('tenderId') || ''); const providerId = String(formData.get('providerId') || '');
  if (!tenderId || !providerId) return { error: 'Choose a tender configuration and provider.' };
  const result = await keystoneClient('mutation($input:JSON!){ linkTenderPaymentProvider(input:$input) }', { input: { idempotencyKey: crypto.randomUUID(), tenderConfigurationId: tenderId, paymentProviderId: providerId } });
  revalidatePath('/dashboard/platform/payment-providers');
  return result.success ? { success: true } : { error: result.error };
}
