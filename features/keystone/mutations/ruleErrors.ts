import { GraphQLError } from "graphql";

type Resolver = (...args: any[]) => unknown;

/**
 * The GraphQL route (graphql-yoga) masks every non-GraphQLError as "Unexpected error." in
 * production. Our rule checks throw plain `Error`s with operator-facing text ("SKU … is
 * already used by …"), so re-raise exactly those as user-input errors. Anything else
 * (Prisma, runtime TypeErrors, subclasses) stays masked.
 */
export function exposeRuleErrors<T extends Record<string, Resolver>>(resolvers: T): T {
  return Object.fromEntries(Object.entries(resolvers).map(([name, resolve]) => [name, async (...args: unknown[]) => {
    try {
      return await resolve(...args);
    } catch (error) {
      if (error instanceof Error && error.constructor === Error && error.message && error.message.length <= 300) {
        throw new GraphQLError(error.message, { extensions: { code: "BAD_USER_INPUT" } });
      }
      throw error;
    }
  }])) as T;
}
