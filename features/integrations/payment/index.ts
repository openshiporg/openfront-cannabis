export const paymentProviderAdapters = {
  manual: () => import("./manual"),
  aeropay: () => import("./aeropay"),
} as const;
