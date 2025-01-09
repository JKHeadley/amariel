import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default withAuth(
  function middleware(req: NextRequest) {
    // Only protect admin routes and require auth
    if (req.nextUrl.pathname.startsWith('/admin')) {
      const token = req.nextauth?.token;
      
      if (!token) {
        const signInUrl = new URL('/auth/signin', req.url);
        signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
        return NextResponse.redirect(signInUrl);
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ['/admin/:path*'],
}; 