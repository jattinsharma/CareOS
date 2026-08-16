import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.get("kinos_session")?.value === "true";

  const publicPages = ["/", "/login", "/signup"];
  const isPublic = publicPages.includes(pathname);

  // Logged-in user on landing/login/signup → redirect to dashboard before the
  // page ever renders. kinos_session is a client-set routing hint (no Firebase
  // token inside); Firebase auth on the client remains the source of truth.
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup"],
};
