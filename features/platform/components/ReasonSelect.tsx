import { FieldError, fieldProps, type FieldErrors } from '../lib/formErrors';
import { inputClass, labelClass } from './cannabis-ui';

/** The reasons staff pick from, in plain words. The value stored on the record is the code. */
export const REASONS = {
  receive: [['manifest_receipt', 'Delivery received against the manifest'], ['transfer_in', 'Transfer from another licensed store'], ['return_to_stock', 'Returned to stock'], ['opening_inventory', 'Opening inventory']],
  hold: [['damaged_seal', 'Damaged or broken seal'], ['damaged_product', 'Damaged product'], ['label_error', 'Label is wrong or missing'], ['awaiting_lab_result', 'Waiting for a lab result'], ['failed_lab_result', 'Failed a lab test'], ['customer_complaint', 'Customer complaint'], ['supplier_notice', 'Supplier or regulator notice'], ['count_discrepancy', 'Count does not match'], ['other_hold', 'Other']],
  release: [['retest_passed', 'Retest passed'], ['lab_result_passed', 'Lab result passed'], ['label_corrected', 'Label corrected'], ['inspection_cleared', 'Checked and cleared'], ['count_resolved', 'Count resolved'], ['held_in_error', 'Held by mistake']],
  refund: [['damaged_product', 'Damaged product'], ['wrong_item', 'Wrong item sold'], ['product_defect', 'Product did not work'], ['recalled_product', 'Recalled product'], ['overcharge', 'Charged too much'], ['manager_goodwill', 'Manager decision']],
  incident: [['contained_on_site', 'Contained on site'], ['under_investigation', 'Under investigation'], ['reported_to_regulator', 'Reported to the regulator'], ['corrective_action_taken', 'Corrective action taken'], ['no_action_needed', 'No action needed'], ['resolved', 'Resolved']],
  variance: [['counting_error', 'Counting error'], ['change_error', 'Wrong change given'], ['unrecorded_payout', 'Payout not recorded'], ['unrecorded_drop', 'Safe drop not recorded'], ['suspected_theft', 'Suspected theft'], ['unexplained', 'Unexplained']],
  paid_in: [['change_added', 'Change added to the drawer'], ['float_top_up', 'Float topped up'], ['cash_returned', 'Cash returned to the drawer']],
  paid_out: [['supplier_paid', 'Supplier paid in cash'], ['store_supplies', 'Store supplies'], ['change_run', 'Cash taken to get change'], ['other_expense', 'Other store expense']],
  safe_drop: [['safe_drop', 'Moved to the safe'], ['bank_deposit', 'Taken for the bank deposit']],
  revoke: [['employment_ended', 'No longer works here'], ['badge_expired', 'Badge expired'], ['role_changed', 'Role changed'], ['policy_violation', 'Policy violation'], ['entered_in_error', 'Entered by mistake']],
} as const satisfies Record<string, ReadonlyArray<readonly [string, string]>>;

/** A reason picker. Staff choose a sentence; they never type a code. */
export function ReasonSelect({ kind, title = 'Reason', errors, disabled, defaultValue }: { kind: keyof typeof REASONS; title?: string; errors?: FieldErrors; disabled?: boolean; defaultValue?: string }) {
  return <label className={labelClass}>{title}
    <select {...fieldProps('reasonCode', errors)} required disabled={disabled} defaultValue={defaultValue ?? ''} className={inputClass}>
      <option value="" disabled>Choose a reason</option>
      {REASONS[kind].map(([code, text]) => <option key={code} value={code}>{text}</option>)}
    </select>
    <FieldError name="reasonCode" errors={errors} />
  </label>;
}
