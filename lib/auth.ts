import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import { logger, redactEmail } from "@/lib/logger";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }
        const host = await prisma.host.findUnique({ where: { email } });
        if (!host) return null;
        const valid = await bcrypt.compare(password, host.passwordHash);
        if (!valid) {
          logger.warn({ event: "auth.login_failed", to: redactEmail(email) });
          return null;
        }
        return { id: host.id, email: host.email, name: host.name };
      },
    }),
  ],
});
