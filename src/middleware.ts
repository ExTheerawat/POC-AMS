import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isAuthPage = pathname.startsWith("/login");
  const isSelectModule = pathname.startsWith("/select-module");
  const isPublic =
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  // Not logged in → only allow /login
  if (!isLoggedIn) {
    if (isAuthPage) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Logged in but on /login → go pick a module
  if (isAuthPage) {
    return NextResponse.redirect(new URL("/select-module", req.nextUrl));
  }

  // Logged in + on /select-module = OK (let user pick)
  if (isSelectModule) return NextResponse.next();

  // Logged in but no module chosen → bounce to picker
  const activeModule = req.cookies.get("activeModule")?.value;
  if (!activeModule || (activeModule !== "leave" && activeModule !== "ot")) {
    return NextResponse.redirect(new URL("/select-module", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
