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

  // Allow the request to continue
  return NextResponse.next();
}

export const config = {
  // Apply middleware only to specific routes to optimize performance
  matcher: ['/login', '/register'],
};
