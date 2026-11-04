import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logger, redactEmail } from "@/lib/logger";

// Compared against when the email is unknown so a miss costs the same bcrypt
// work as a wrong password and response time does not reveal the host email.
// Same cost factor as the seed script.
const DUMMY_HASH = "$2b$10$MJsAJUVt6zLdu.YQKs9ewebRrVXL.p3fF7MqVkxWqCczXixH/3BwS";

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

  const valid = await bcrypt.compare(
    password,
    host?.passwordHash ?? DUMMY_HASH,
  );
  if (!host || !valid) {
    logger.warn({ event: "auth.login_failed", to: redactEmail(email) });
    return null;
  }

  return { id: host.id, email: host.email, name: host.name };
}
