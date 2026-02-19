import { NextRequest, NextResponse } from "next/server";
import { getAdminMessaging } from "@/lib/firebase-admin";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

// Use service role key to bypass RLS and get tokens
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const adminMessaging = getAdminMessaging();
        // 1. Basic Security Check (Optional: Add a specialized webhook secret)
        const authHeader = req.headers.get('authorization');
        if (process.env.WEBHOOK_SECRET && authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
        console.log('Webhook payload received:', payload);

        // Supabase Webhook payload structure: { record: { ... }, type: 'INSERT', ... }
        const notification = payload.record;
        if (!notification || !notification.user_id) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // 2. Fetch ALL User's FCM Tokens
        const { data: tokensData, error: tokensError } = await supabaseAdmin
            .from('fcm_tokens')
            .select('token, platform')
            .eq('user_id', notification.user_id);

        if (tokensError || !tokensData || tokensData.length === 0) {
            console.log('No FCM tokens found for user:', notification.user_id);
            return NextResponse.json({ success: true, message: 'No tokens found, skipping push' });
        }

        const tokens = tokensData.map(t => t.token);
        console.log(`Found ${tokens.length} tokens for user ${notification.user_id}`);

        const webTokens = tokensData.filter(t => t.platform === 'web').map(t => t.token);
        const nativeTokens = tokensData.filter(t => t.platform !== 'web').map(t => t.token);

        const results = [];

        // 3a. Send "Notification Message" to Web Tokens (Ensures display on old SW)
        // We include 'data.url' for the New SW to handle the click redirection.
        if (webTokens.length > 0) {
            const webMessage = {
                tokens: webTokens,
                notification: {
                    title: notification.title || 'Venecambio',
                    body: notification.message || 'Tienes una nueva actualización.',
                },
                webpush: {
                    notification: {
                        icon: '/logo.png',
                        badge: '/logo.png'
                    }
                },
                data: {
                    notificationId: notification.id,
                    type: notification.type || 'info',
                    url: '/dashboard/transactions' // Used by New SW listener
                }
            };
            const webResponse = await adminMessaging.sendEachForMulticast(webMessage as any);
            results.push({ type: 'web', response: webResponse, tokens: webTokens });
            console.log('Sent Web Notification Messages:', webResponse.successCount);
        }

        // 3b. Send "Notification Message" to Native Tokens (Standard System Notification)
        if (nativeTokens.length > 0) {
            const nativeMessage = {
                tokens: nativeTokens,
                notification: {
                    title: notification.title || 'Venecambio',
                    body: notification.message || 'Tienes una nueva actualización.',
                },
                data: {
                    notificationId: notification.id,
                    type: notification.type || 'info',
                }
            };
            const nativeResponse = await adminMessaging.sendEachForMulticast(nativeMessage as any);
            results.push({ type: 'native', response: nativeResponse, tokens: nativeTokens });
            console.log('Sent Native Notifications:', nativeResponse.successCount);
        }

        // Cleanup invalid tokens from both batches
        for (const res of results) {
            if (res.response.failureCount > 0) {
                const failedTokens: string[] = [];
                res.response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        failedTokens.push(res.tokens[idx]);
                    }
                });
                if (failedTokens.length > 0) {
                    console.log(`Removing invalid ${res.type} tokens:`, failedTokens);
                    await supabaseAdmin.from('fcm_tokens').delete().in('token', failedTokens);
                }
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('Error in push notification webhook:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
