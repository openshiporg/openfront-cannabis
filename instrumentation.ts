// Time-based states settle here every minute inside the production web process: carts whose stock hold has run
// out are cancelled (their reserved stock comes back), and a cancelled card order whose hold release failed is
// released again. Before this, expiry only ran when a shopper opened the pickup checkout. Each cancel is its own
// idempotent, locked command (`expire:<cartId>`), so this is safe beside a checkout visit or another replica.
const INTERVAL_MS = 60_000

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return
  if (process.env.CART_EXPIRY_IN_PROCESS === '0') return
  const state = globalThis as unknown as { cannabisCartExpiryLoop?: boolean }
  if (state.cannabisCartExpiryLoop) return
  state.cannabisCartExpiryLoop = true
  let running = false
  const pass = async () => {
    if (running) return
    running = true
    try {
      const [{ keystoneContext }, { releaseExpiredOrders }] = await Promise.all([
        import('./features/keystone/context'),
        import('./features/keystone/mutations/onlineOrders'),
      ])
      await releaseExpiredOrders(keystoneContext)
    } catch (error) {
      console.error(JSON.stringify({ component: 'cannabis-cart-expiry', status: 'failed', error: error instanceof Error ? error.message : String(error) }))
    } finally { running = false }
  }
  setTimeout(pass, 15_000)
  setInterval(pass, INTERVAL_MS).unref?.()
}
