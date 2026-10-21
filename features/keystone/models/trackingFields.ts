import { timestamp } from "@keystone-6/core/fields";

export const trackingFields = {
  createdAt: timestamp({
    access: { read: () => true, create: () => false, update: () => false },
    defaultValue: { kind: "now" },
    validation: { isRequired: true },
    ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
  }),
  updatedAt: timestamp({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    defaultValue: { kind: "now" },
    validation: { isRequired: true },
    ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
  }),
};
