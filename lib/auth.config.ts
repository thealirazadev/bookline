import type { NextAuthConfig } from "next-auth";

// Edge-safe base config shared by the middleware. It holds no node-only imports
// (no Prisma, no bcrypt); the credentials provider lives only in lib/auth.ts.
export const authConfig = {
  // Self-hosted single-instance deploy behind a trusted proxy; there is no
  // Vercel host header to auto-detect, so trust the configured host.
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.hostId = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.hostId === "string") {
        session.user.id = token.hostId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
