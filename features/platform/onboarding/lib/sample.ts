import seed from './seed.json';
import { localDate, type LimitRow, type TaxRow } from './pack';

/**
 * The sample dispensary (lib/seed.json), the way E-commerce's "Complete" template works:
 * it fills the setup form for the owner to review, and after the authority pack installs
 * the same controlled commands staff use stock its menu (see actions/onboarding.ts).
 * License, credential, lab and manifest details are fictional sample records.
 */
export const SAMPLE_STORE = { name: seed.name, description: seed.description };

const { licenseValidDays, credentialValidDays, ruleValidDays, limits, taxes, ...fields } = seed.authority;

/** Form values for the sample dispensary; dates are relative to today. */
export function sampleFormValues() {
  return {
    ...fields,
    licenseEffectiveAt: localDate(-30), licenseExpiresAt: localDate(licenseValidDays),
    credentialEffectiveAt: localDate(-30), credentialExpiresAt: localDate(credentialValidDays),
    ruleEffectiveAt: localDate(-30), ruleExpiresAt: localDate(ruleValidDays),
  };
}

export const sampleLimits = (): LimitRow[] => limits.map(row => ({ ...row }));
export const sampleTaxes = (): TaxRow[] => taxes.map(row => ({ ...row }));

/** One stocking step per entry: store details, the register, then each menu item. */
export const SAMPLE_STEPS: string[] = ['Store details', 'Register', ...seed.products.map(product => product.name)];
