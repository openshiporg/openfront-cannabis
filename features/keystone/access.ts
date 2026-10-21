export type CannabisPermission =
  | "canManagePeople"
  | "canManageRoles"
  | "canAccessDashboard"
  | "canManageOnboarding"
  | "canManageAuthority"
  | "canManageCompliance"
  | "canManageInventory"
  | "canManageSales"
  | "canManageFinance"
  | "canManageIntegrations"
  | "canViewReports";

export type Session = {
  itemId: string;
  listKey: string;
  data: {
    name: string;
    email?: string;
    status?: "active" | "disabled";
    onboardingStatus?: "not_started" | "in_progress" | "completed" | "dismissed";
    organization?: { id: string } | null;
    premises?: { id: string } | null;
    role?: ({ id: string; name: string } & Partial<Record<CannabisPermission, boolean>>) | null;
  };
};

export type AccessArgs = { session?: Session; context?: any };

export function isSignedIn({ session }: AccessArgs) {
  return Boolean(session?.itemId) && session?.data.status !== "disabled";
}

const sessionPermission = (session: Session | undefined, permission: CannabisPermission) =>
  session?.data.status !== "disabled" && session?.data.role?.[permission] === true;

async function freshActor({ session, context }: AccessArgs) {
  if (!session?.itemId || !context || session.data.status === "disabled") return null;
  const actor = await context.sudo().query.User.findOne({
    where: { id: session.itemId },
    query: `id status onboardingStatus organization { id } premises { id } role {
      canManagePeople canManageRoles canAccessDashboard canManageOnboarding canManageAuthority
      canManageCompliance canManageInventory canManageSales canManageFinance canManageIntegrations canViewReports
    } staffCredential { id status effectiveAt expiresAt user { id } organization { id } premises { id } }`,
  });
  if (!actor || actor.status !== "active") return null;
  if (actor.organization?.id !== session.data.organization?.id || actor.premises?.id !== session.data.premises?.id) return null;
  for (const permission of permissionNames) {
    if (sessionPermission(session, permission) && actor.role?.[permission] !== true) return null;
  }
  return actor;
}

/** The same current staff-credential intersection that operational commands require. */
function hasCurrentCredential(actor: any) {
  const credential = actor?.staffCredential; const now = Date.now();
  return Boolean(credential && credential.status === "active" && new Date(credential.effectiveAt).getTime() <= now && new Date(credential.expiresAt).getTime() > now
    && credential.user?.id === actor.id && actor.organization?.id && credential.organization?.id === actor.organization.id
    && actor.premises?.id && credential.premises?.id === actor.premises.id);
}

export const permissionNames: CannabisPermission[] = [
  "canManagePeople", "canManageRoles", "canAccessDashboard", "canManageOnboarding",
  "canManageAuthority", "canManageCompliance", "canManageInventory", "canManageSales",
  "canManageFinance", "canManageIntegrations", "canViewReports",
];

export const permissions = Object.fromEntries(
  permissionNames.map((permission) => [permission, ({ session }: AccessArgs) => sessionPermission(session, permission)]),
) as Record<CannabisPermission, (args: AccessArgs) => boolean>;

export const activePermissions = Object.fromEntries(
  permissionNames.map((permission) => [permission, async (args: AccessArgs) => (await freshActor(args))?.role?.[permission] === true]),
) as Record<CannabisPermission, (args: AccessArgs) => Promise<boolean>>;

/** Regulated operational records: current dashboard and purpose grants plus a current staff credential. */
export const operationalPermissions = Object.fromEntries(
  permissionNames.map((permission) => [permission, async (args: AccessArgs) => {
    const actor = await freshActor(args);
    return actor?.role?.canAccessDashboard === true && actor.role?.[permission] === true && hasCurrentCredential(actor);
  }]),
) as Record<CannabisPermission, (args: AccessArgs) => Promise<boolean>>;

export async function canManageScopedPeople(args: AccessArgs & { item?: { [key: string]: unknown } }) {
  const actor = await freshActor(args);
  if (!actor?.organization?.id || !actor?.premises?.id || actor.role?.canManagePeople !== true) return false;
  // People management is premises-scoped: never another site's staff.
  return !args.item || args.item.premisesId === actor.premises.id;
}

export function organizationId(session?: Session) {
  return session?.data.organization?.id || null;
}

export function premisesId(session?: Session) {
  return session?.data.premises?.id || null;
}

export function organizationFilter({ session }: AccessArgs) {
  const id = organizationId(session);
  return id ? { organization: { id: { equals: id } } } : false;
}

export function organizationSelfFilter({ session }: AccessArgs) {
  const id = organizationId(session);
  return id ? { id: { equals: id } } : false;
}

export function premisesFilter({ session }: AccessArgs) {
  const organization = organizationId(session);
  const premises = premisesId(session);
  return organization && premises
    ? { organization: { id: { equals: organization } }, premises: { id: { equals: premises } } }
    : false;
}

export function tenantAccess(read: CannabisPermission, manage: CannabisPermission = read) {
  return {
    operation: {
      query: activePermissions[read],
      create: activePermissions[manage],
      update: activePermissions[manage],
      delete: () => false,
    },
    filter: { query: organizationFilter, update: organizationFilter },
  };
}

export function premisesAccess(read: CannabisPermission, manage: CannabisPermission = read) {
  return {
    operation: {
      query: activePermissions[read],
      create: activePermissions[manage],
      update: activePermissions[manage],
      delete: () => false,
    },
    filter: { query: premisesFilter, update: premisesFilter },
  };
}

export function immutableTenantAccess(read: CannabisPermission) {
  return {
    operation: { query: activePermissions[read], create: () => false, update: () => false, delete: () => false },
    filter: { query: organizationFilter },
  };
}

export function immutableOrganizationAccess(read: CannabisPermission) {
  return {
    operation: { query: activePermissions[read], create: () => false, update: () => false, delete: () => false },
    filter: { query: organizationSelfFilter },
  };
}

export function immutablePremisesAccess(read: CannabisPermission, purpose: "operational" | "authority" = "operational") {
  // Authority records stay readable to their managers when a credential or license lapses, so it can be diagnosed and renewed.
  const query = purpose === "authority" ? activePermissions[read] : operationalPermissions[read];
  return {
    operation: { query, create: () => false, update: () => false, delete: () => false },
    filter: { query: premisesFilter },
  };
}

type FreshActor = {
  id: string;
  onboardingStatus?: string | null;
  organization?: { id: string } | null;
  premises?: { id: string } | null;
  role?: Partial<Record<CannabisPermission, boolean>> | null;
};

function isBootstrapActor(actor: FreshActor) {
  return !actor.organization?.id && !actor.premises?.id
    && actor.onboardingStatus !== "completed"
    && actor.role?.canAccessDashboard === true
    && actor.role?.canManageOnboarding === true;
}

function freshOrganizationFilter(actor: FreshActor) {
  return actor.organization?.id ? { organization: { id: { equals: actor.organization.id } } } : false;
}

function freshSelfFilter(actor: FreshActor) {
  const organization = freshOrganizationFilter(actor);
  return organization ? { AND: [{ id: { equals: actor.id } }, organization] } : false;
}

async function peopleFilter(args: AccessArgs) {
  const actor = await freshActor(args);
  if (!actor) return false;
  if (isBootstrapActor(actor)) return {
    AND: [
      { id: { equals: actor.id } },
      { status: { equals: "active" } },
      { organization: null },
      { premises: null },
    ],
  };
  if (actor.role?.canManagePeople === true && actor.organization?.id && actor.premises?.id) {
    return { AND: [{ organization: { id: { equals: actor.organization.id } } }, { premises: { id: { equals: actor.premises.id } } }] };
  }
  return freshSelfFilter(actor);
}

export async function roleQueryFilter(args: AccessArgs) {
  const actor = await freshActor(args);
  if (!actor) return false;
  if (isBootstrapActor(actor)) return {
    AND: [
      { organization: null },
      { assignedTo: { some: { id: { equals: actor.id } } } },
    ],
  };
  return freshOrganizationFilter(actor);
}

export const rules = {
  canReadPeople: peopleFilter,
  canUpdatePeople: peopleFilter,
};
