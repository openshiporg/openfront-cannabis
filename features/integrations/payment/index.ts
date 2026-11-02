export const paymentProviderAdapters = {
  manual: () => import("./manual"),
  aeropay: () => import("./aeropay"),
  authorizenet: () => import("./authorizenet"),
} as const;
