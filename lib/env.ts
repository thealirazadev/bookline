import { z } from "zod";

// Server-only validated environment access. Nothing here is exposed to the
// client (no NEXT_PUBLIC_ prefix); importing this module in client code is a bug.

const runtimeSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  LINK_TOKEN_SECRET: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  MAIL_FROM: z.string().min(1),
});

const seedSchema = z.object({
  SEED_HOST_EMAIL: z.string().email(),
  SEED_HOST_PASSWORD: z.string().min(1),
  SEED_HOST_NAME: z.string().min(1),
  SEED_HOST_TIMEZONE: z.string().min(1),
});

export type Env = z.infer<typeof runtimeSchema>;
export type SeedEnv = z.infer<typeof seedSchema>;

function fail(context: string, error: z.ZodError): never {
  // List only variable names, never their values, so secrets stay out of logs.
  const names = error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(
    `Invalid ${context} environment. Check these variables: ${names}. ` +
      `See .env.example for the expected shape.`,
  );
}

function loadRuntimeEnv(): Env {
  const parsed = runtimeSchema.safeParse(process.env);
  if (!parsed.success) fail("runtime", parsed.error);
  return parsed.data;
}

/**
 * Validated seed-only variables. Called by prisma/seed.ts so the runtime app
 * never requires SEED_HOST_* to be present.
 */
export function loadSeedEnv(): SeedEnv {
  const parsed = seedSchema.safeParse(process.env);
  if (!parsed.success) fail("seed", parsed.error);
  return parsed.data;
}

export const env: Env = loadRuntimeEnv();
