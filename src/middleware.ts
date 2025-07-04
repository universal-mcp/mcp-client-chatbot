import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    // Check if this is an invitation URL and extract the invitation ID
    const invitationMatch = pathname.match(/^\/accept-invitation\/(.+)$/);
    if (invitationMatch) {
      const invitationId = invitationMatch[1];
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("invite", invitationId);
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/auth|api/mcp/oauth|sign-in|sign-up).*)",
  ],
};
