import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    const isAdminRoute = pathname.startsWith('/admin')
    const isDashboardRoute = pathname.startsWith('/dashboard')
    const isLoginRoute = pathname === '/login'

    // Detect if there's an active Supabase session by checking the access token cookie
    // Supabase stores the session in a cookie named sb-<project_ref>-auth-token
    const hasSession = request.cookies.getAll().some(
        c => c.name.includes('-auth-token') && c.value.length > 0
    )

    // If no session and accessing protected routes → redirect to login
    if (!hasSession && (isAdminRoute || isDashboardRoute)) {
        const loginUrl = new URL('/login', request.url)
        return NextResponse.redirect(loginUrl)
    }

    // If already has session and going to login → redirect to dashboard
    if (hasSession && isLoginRoute) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/dashboard/:path*',
        '/login',
    ],
}
