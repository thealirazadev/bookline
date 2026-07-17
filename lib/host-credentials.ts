import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logger, redactEmail } from "@/lib/logger";

export interface AuthedHost {
  id: string;
  email: string;
  name: string;
}

/**
 * Verify host login credentials against the stored bcrypt hash. Returns the
 * host identity on success, null on any failure (unknown email or wrong
 * password) so callers surface one generic message.
 */
export async function verifyHostCredentials(
  email: string,
  password: string,
): Promise<AuthedHost | null> {
  const host = await prisma.host.findUnique({ where: { email } });
  if (!host) return null;

  const valid = await bcrypt.compare(password, host.passwordHash);
  if (!valid) {
    logger.warn({ event: "auth.login_failed", to: redactEmail(email) });
    return null;
  }

  return { id: host.id, email: host.email, name: host.name };
}
