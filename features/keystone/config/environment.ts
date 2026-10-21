type RuntimeEnvironment = Record<string, string | undefined>;

function requiredEnv(env: RuntimeEnvironment, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function productionEnv(
  env: RuntimeEnvironment,
  name: string,
  developmentFallback: string,
): string {
  if (env[name]) return env[name]!;
  if (env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production`);
  }
  return developmentFallback;
}

export function readRuntimeEnvironment(env: RuntimeEnvironment = process.env) {
  const databaseUrl = requiredEnv(env, "DATABASE_URL");
  const sessionSecret = requiredEnv(env, "SESSION_SECRET");
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long");
  }

  return {
    databaseUrl,
    sessionSecret,
    storage: {
      bucketName: productionEnv(env, "S3_BUCKET_NAME", "keystone-test"),
      region: productionEnv(env, "S3_REGION", "ap-southeast-2"),
      accessKeyId: productionEnv(env, "S3_ACCESS_KEY_ID", "keystone"),
      secretAccessKey: productionEnv(env, "S3_SECRET_ACCESS_KEY", "keystone"),
      endpoint: productionEnv(
        env,
        "S3_ENDPOINT",
        "https://sfo3.digitaloceanspaces.com",
      ),
    },
  };
}
