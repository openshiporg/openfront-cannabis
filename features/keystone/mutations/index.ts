import { mergeSchemas } from "@graphql-tools/schema";
import type { GraphQLSchema } from "graphql";
import redirectToInit from "./redirectToInit";
import runCannabisOnboarding, { dismissCannabisOnboarding, provisionStaffAuthority } from "./onboarding";
import { cannabisCommandReceipt, cannabisSaleReceipt } from "./receipts";
import { receiveCannabisPackage, postCannabisInventoryEvent, releasePackageHold } from "./inventory";
import { publicCannabisMenu, publicCannabisStorefrontSettings, submitCannabisCustomerIntake, recordEligibilityDecision } from "./public";
import { cannabisCartAllocationQuote, createCustomerPickupCart, createPosCannabisCart, addCannabisCartLine, cancelCannabisCart, finalizeCannabisSale } from "./commerce";
import { configureCannabisProduct, configureRegister, openRegisterShift, closeRegisterShift, approveCashVariance, refundCannabisSale, recordComplianceIncident, transitionComplianceIncident, amendCannabisProduct, revokeStaffCredential, amendRegister, renewCannabisAuthority, activateIntegrationInstallation, recordStateInboxEvent, retryStateOutboxEvent, recordReconciliationRun, approveReconciliationRun } from "./operations";
import cannabisOperationsWorkspace from "./workspace";
import { cannabisCartPreparation, transitionCannabisCartPreparation } from "./fulfillment";
import { cannabisStorefrontSettingsWorkspace, configureCannabisStorefrontSettings } from "./storefrontSettings";
import { amendCannabisPremisesDetails, amendCannabisRulePack } from "./rulePack";
import { setStaffTemporaryPassword } from "./staffAccess";
import { exposeRuleErrors } from "./ruleErrors";

const graphql = String.raw;

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: graphql`
      type Query {
        redirectToInit: Boolean
        publicCannabisMenu: JSON!
        publicCannabisStorefrontSettings: JSON!
        cannabisOperationsWorkspace(section: String!, options: JSON): JSON!
        cannabisStorefrontSettingsWorkspace: JSON!
        cannabisCartPreparation(cartId: ID!): JSON!
        cannabisCartAllocationQuote(input: JSON!): JSON!
        cannabisCommandReceipt(input: JSON!): JSON!
        cannabisSaleReceipt(saleId: ID!): JSON!
      }
      type Mutation {
        runCannabisOnboarding(input: JSON!): JSON!
        dismissCannabisOnboarding: JSON!
        transitionComplianceIncident(input: JSON!): JSON!
        amendCannabisProduct(input: JSON!): JSON!
        revokeStaffCredential(input: JSON!): JSON!
        amendRegister(input: JSON!): JSON!
        renewCannabisAuthority(input: JSON!): JSON!
        amendCannabisRulePack(input: JSON!): JSON!
        amendCannabisPremisesDetails(input: JSON!): JSON!
        setStaffTemporaryPassword(input: JSON!): JSON!
        configureCannabisStorefrontSettings(input: JSON!): JSON!
        provisionStaffAuthority(input: JSON!): JSON!
        submitCannabisCustomerIntake(input: JSON!): JSON!
        recordEligibilityDecision(input: JSON!): JSON!
        receiveCannabisPackage(input: JSON!): JSON!
        postCannabisInventoryEvent(input: JSON!): JSON!
        releasePackageHold(input: JSON!): JSON!
        createCustomerPickupCart(input: JSON!): JSON!
        createPosCannabisCart(input: JSON!): JSON!
        transitionCannabisCartPreparation(input: JSON!): JSON!
        addCannabisCartLine(input: JSON!): JSON!
        cancelCannabisCart(input: JSON!): JSON!
        finalizeCannabisSale(input: JSON!): JSON!
        configureCannabisProduct(input: JSON!): JSON!
        configureRegister(input: JSON!): JSON!
        openRegisterShift(input: JSON!): JSON!
        closeRegisterShift(input: JSON!): JSON!
        approveCashVariance(input: JSON!): JSON!
        refundCannabisSale(input: JSON!): JSON!
        recordComplianceIncident(input: JSON!): JSON!
        activateIntegrationInstallation(input: JSON!): JSON!
        recordStateInboxEvent(input: JSON!): JSON!
        retryStateOutboxEvent(input: JSON!): JSON!
        recordReconciliationRun(input: JSON!): JSON!
        approveReconciliationRun(input: JSON!): JSON!
      }
    `,
    resolvers: {
      Query: exposeRuleErrors({ redirectToInit, publicCannabisMenu, publicCannabisStorefrontSettings, cannabisOperationsWorkspace, cannabisStorefrontSettingsWorkspace, cannabisCartPreparation, cannabisCartAllocationQuote, cannabisCommandReceipt, cannabisSaleReceipt }),
      Mutation: exposeRuleErrors({
        runCannabisOnboarding,
        dismissCannabisOnboarding,
        transitionComplianceIncident,
        amendCannabisProduct,
        revokeStaffCredential,
        amendRegister,
        renewCannabisAuthority,
        amendCannabisRulePack,
        amendCannabisPremisesDetails,
        setStaffTemporaryPassword,
        configureCannabisStorefrontSettings,
        provisionStaffAuthority,
        submitCannabisCustomerIntake,
        recordEligibilityDecision,
        receiveCannabisPackage,
        postCannabisInventoryEvent,
        releasePackageHold,
        createCustomerPickupCart,
        createPosCannabisCart,
        transitionCannabisCartPreparation,
        addCannabisCartLine,
        cancelCannabisCart,
        finalizeCannabisSale,
        configureCannabisProduct,
        configureRegister,
        openRegisterShift,
        closeRegisterShift,
        approveCashVariance,
        refundCannabisSale,
        recordComplianceIncident,
        activateIntegrationInstallation,
        recordStateInboxEvent,
        retryStateOutboxEvent,
        recordReconciliationRun,
        approveReconciliationRun,
      }),
    },
  });
}
