export const OPERATOR_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * Keep post-authentication navigation on the operator dashboard. Values from
 * query/form input are untrusted and must never become absolute redirects.
 */
export function getSafeDashboardRedirect(
  value: unknown,
  fallback = "/dashboard",
): string {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /%5c/i.test(candidate) ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, "https://openfront.invalid");
    if (
      parsed.origin !== "https://openfront.invalid" ||
      (parsed.pathname !== "/dashboard" &&
        !parsed.pathname.startsWith("/dashboard/"))
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
