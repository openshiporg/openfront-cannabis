import { s3ForcePathStyle } from "./lib/s3-storage";
import { createAuth } from "@keystone-6/auth";
import { createHash } from "node:crypto";
import { config } from "@keystone-6/core";
import "dotenv/config";
import { models } from "./models";
import { withCreateAwareUi, withDeleteAwareUi } from "./ui-create-access";
import { statelessSessions } from "@keystone-6/core/session";
import { extendGraphqlSchema } from "./mutations";
import { sendPasswordResetEmail } from "./lib/mail";
import { OPERATOR_SESSION_MAX_AGE_SECONDS } from "../../lib/security";
import { readRuntimeEnvironment } from "./config/environment";
import { pooledDatabaseUrl } from './database-url';
import { throwKeystonePrismaErrors } from './lib/keystonePrismaErrors';

const runtimeEnvironment = readRuntimeEnvironment();

const sessionConfig = {
  maxAge: OPERATOR_SESSION_MAX_AGE_SECONDS,
  secret: runtimeEnvironment.sessionSecret,
};

const { withAuth } = createAuth({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      role: {
        create: {
          name: "Admin",
          canManagePeople: true,
          canManageRoles: true,
          canAccessDashboard: true,
          canManageOnboarding: true,
          canManageAuthority: true,
          canManageCompliance: true,
          canManageInventory: true,
          canManageSales: true,
          canManageFinance: true,
          canManageIntegrations: true,
          canViewReports: true,
        },
      },
    },
  },
  passwordResetLink: {
    async sendToken(args) {
      // Send, then keep the outcome on the account (never the address or token) so staff can see a reset went out.
      let evidence: Record<string, string> = { status: "sent" };
      try {
        const info = await sendPasswordResetEmail(args.token, args.identity);
        if (info?.messageId) evidence.messageId = String(info.messageId).slice(0, 200);
        if (info?.response) evidence.smtpResponse = String(info.response).slice(0, 300);
      } catch (caught) {
        evidence = { status: "failed", error: (caught instanceof Error ? caught.message : "send_failed").slice(0, 200) };
      }
      try {
        const sudo = args.context.sudo();
        const user = await sudo.query.User.findOne({ where: { id: String(args.itemId) }, query: "organization { id } premises { id } customerProfile { organization { id } premises { id } }" });
        const org = user?.organization?.id || user?.customerProfile?.organization?.id;
        const site = user?.premises?.id || user?.customerProfile?.premises?.id;
        await sudo.db.AuditEvent.createOne({ data: { ...(org ? { organization: { connect: { id: org } } } : {}), ...(site ? { premises: { connect: { id: site } } } : {}), action: "user.password_reset_email", resourceType: "User", resourceId: String(args.itemId), correlationId: `reset:${String(args.itemId)}`, reasonCode: evidence.status, evidence, evidenceHash: createHash("sha256").update(`reset:${String(args.itemId)}:${Date.now()}:${evidence.status}`).digest("hex"), occurredAt: new Date() } });
      } catch (caught) {
        console.error("Password reset email bookkeeping failed:", caught instanceof Error ? caught.message : "unknown");
      }
    },
  },
  sessionData: `
    name
    email
    status
    onboardingStatus
    organization { id }
    premises { id }
    staffCredential { id status effectiveAt expiresAt allowedActivities evidenceHash }
    role {
      id
      name
      canManagePeople
      canManageRoles
      canAccessDashboard
      canManageOnboarding
      canManageAuthority
      canManageCompliance
      canManageInventory
      canManageSales
      canManageFinance
      canManageIntegrations
      canViewReports
    }
  `,
});

export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: pooledDatabaseUrl(runtimeEnvironment.databaseUrl),
      // Keystone returns failed queries as values; this makes them throw so transactions roll back.
      extendPrismaClient: throwKeystonePrismaErrors,
    },
    lists: withDeleteAwareUi(withCreateAwareUi(models)),
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName: runtimeEnvironment.storage.bucketName,
        region: runtimeEnvironment.storage.region,
        accessKeyId: runtimeEnvironment.storage.accessKeyId,
        secretAccessKey: runtimeEnvironment.storage.secretAccessKey,
        endpoint: runtimeEnvironment.storage.endpoint,
        signed: { expiry: 300 },
        forcePathStyle: s3ForcePathStyle(runtimeEnvironment.storage.endpoint),
      },
    },
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false,
    },
    session: statelessSessions(sessionConfig),
    graphql: {
      extendGraphqlSchema,
    },
  })
);