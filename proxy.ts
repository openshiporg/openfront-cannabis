import type { NextRequest } from "next/server";
import { handleDashboardRoutes, getAuthenticatedUser, isShopperSession } from "@/features/dashboard/middleware";
import { handleStorefrontRoutes } from "@/features/storefront/middleware";
import { NextResponse } from "next/server";
import { isDashboardRoute } from "@/features/dashboard/lib/authFlow";

const dashboardPath = "/dashboard";

// Main middleware function that handles all routes
export async function proxy(request: NextRequest) {
  // A malformed percent-escape (for example /%E0%A4%A) is a bad request, not a server error.
  try { decodeURIComponent(request.nextUrl.pathname); } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Get authenticated user once
  const { user, redirectToInit } = await getAuthenticatedUser(request);

  // If redirectToInit is true (no users exist) and user is on storefront, redirect to dashboard init
  if (redirectToInit && !isDashboardRoute(request.nextUrl.pathname, "init")) {
    return NextResponse.redirect(new URL(`${dashboardPath}/init`, request.url));
  }

  // A signed-in shopper has no role and no place on the staff side: send them to their account (the reset page stays open).
  const onStaffSide = request.nextUrl.pathname === dashboardPath || request.nextUrl.pathname.startsWith(`${dashboardPath}/`);
  if (onStaffSide && !isDashboardRoute(request.nextUrl.pathname, "reset") && (user ? !user.role : await isShopperSession(request))) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  // Let each handler manage its own routes and logic
  const response = await handleDashboardRoutes(request, user, redirectToInit);
  
  // If dashboard handler didn't handle the route, pass to storefront
  if (!response) {
    return handleStorefrontRoutes(request, user);
  }
  
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.svg|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
};