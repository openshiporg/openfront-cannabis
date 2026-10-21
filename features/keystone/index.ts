import { createAuth } from "@keystone-6/auth";
import { config } from "@keystone-6/core";
import "dotenv/config";
import { models } from "./models";
import { statelessSessions } from "@keystone-6/core/session";
import { extendGraphqlSchema } from "./mutations";
import { sendPasswordResetEmail } from "./lib/mail";
import { OPERATOR_SESSION_MAX_AGE_SECONDS } from "../../lib/security";
import { readRuntimeEnvironment } from "./config/environment";

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
      // send the email
      await sendPasswordResetEmail(args.token, args.identity);
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
      url: runtimeEnvironment.databaseUrl,
    },
    lists: models,
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
        forcePathStyle: true,
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