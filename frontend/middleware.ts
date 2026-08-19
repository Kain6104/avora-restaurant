import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the token from cookies
  const token = request.cookies.get('token')?.value;

  // Check if the user is trying to access auth pages
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                     request.nextUrl.pathname.startsWith('/register');

  if (isAuthPage) {
    if (token) {
      // If user is already logged in, redirect them to the home page
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Check if the user is trying to access protected pages
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/checkout') || 
                           request.nextUrl.pathname.startsWith('/notifications');

  if (isProtectedRoute) {
    if (!token) {
      // If user is not logged in, redirect them to the login page
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectURL', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Allow the request to continue
  return NextResponse.next();
}

export const config = {
  // Apply middleware only to specific routes to optimize performance
  matcher: ['/login', '/register', '/checkout/:path*', '/notifications/:path*'],
};
