import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ADMIN_PATHS = [/^\/admin(\/.*)?$/];
const STAFF_PATHS = [/^\/staff(\/.*)?$/];
const CLIENT_PATHS = [/^\/(?:client|dashboard)(\/.*)?$/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  });

  if (!token) {
    const url = new URL("/auth/signin", req.url);
    url.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(url);
  }

  const role = token.user?.role;

  if (ADMIN_PATHS.some((r) => r.test(pathname))) {
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/", req.url));
  }

  if (STAFF_PATHS.some((r) => r.test(pathname))) {
    if (role !== "STAFF" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (CLIENT_PATHS.some((r) => r.test(pathname))) {
    if (!role) return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/staff/:path*",
    "/client/:path*",
    "/dashboard/:path*",
  ],
};
