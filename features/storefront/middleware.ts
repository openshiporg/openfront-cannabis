import { NextResponse, type NextRequest } from 'next/server';

// The vertical's storefront hook for the shared proxy (as in Openfront Restaurant). The dispensary storefront needs no
// region, cart-cookie or redirect handling, so every request passes through, as the old cannabis proxy did.
export async function handleStorefrontRoutes(_request: NextRequest, _user: unknown) {
  return NextResponse.next();
}
