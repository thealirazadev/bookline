import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (req.auth) return NextResponse.next();

  const { pathname, origin } = req.nextUrl;
  const isHostApi =
    pathname.startsWith("/api/event-types") ||
    pathname.startsWith("/api/host");

  if (isHostApi) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "You need to sign in to do that.",
        },
      },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", origin);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/event-types/:path*",
    "/api/host/:path*",
  ],
};
