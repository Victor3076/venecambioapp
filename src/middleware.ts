import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// NOTE: This app uses localStorage for Supabase sessions (standard supabase-js client).
// Middleware cannot access localStorage, so cookie-based session detection doesn't work here.
// Route protection is handled by: layout.tsx auth checks + RLS policies + Server Action auth validation.
export function middleware(request: NextRequest) {
    return NextResponse.next()
}

export const config = {
    matcher: [],
}
