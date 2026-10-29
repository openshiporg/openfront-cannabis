import { list } from "@keystone-6/core";
import { checkbox, json, relationship, text } from "@keystone-6/core/fields";
import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const PaymentProvider = list({
  access: { operation: { query: permissions.canManageFinance, create: permissions.canManageFinance, update: permissions.canManageFinance, delete: permissions.canManageFinance } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    code: text({ isIndexed: "unique", validation: { isRequired: true, match: { regex: /^pp_[a-zA-Z0-9_-]+$/, explanation: "Payment provider code must start with pp_" } } }),
    isInstalled: checkbox({ defaultValue: false }), credentials: json({ defaultValue: {} }), metadata: json({ defaultValue: {} }),
    createPaymentFunction: text({ validation: { isRequired: true } }), capturePaymentFunction: text({ validation: { isRequired: true } }),
    refundPaymentFunction: text({ validation: { isRequired: true } }), getPaymentStatusFunction: text({ validation: { isRequired: true } }),
    generatePaymentLinkFunction: text({ validation: { isRequired: true } }), handleWebhookFunction: text({ validation: { isRequired: true } }),
    tenderConfigurations: relationship({ ref: "TenderConfiguration.paymentProvider", many: true }), ...trackingFields,
  },
});
