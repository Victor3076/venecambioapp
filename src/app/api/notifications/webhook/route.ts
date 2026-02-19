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
            .select('token')
            .eq('user_id', notification.user_id);

        if (tokensError || !tokensData || tokensData.length === 0) {
            console.log('No FCM tokens found for user:', notification.user_id);
            return NextResponse.json({ success: true, message: 'No tokens found, skipping push' });
        }

        const tokens = tokensData.map(t => t.token);
        console.log(`Found ${tokens.length} tokens for user ${notification.user_id}`);

        // 3. Send Push Notification via Firebase Admin to Multiple Tokens
        const message = {
            notification: {
                title: notification.title || 'Venecambio',
                body: notification.message || 'Tienes una nueva actualización.',
            },
            tokens: tokens, // Use 'tokens' array for multicast
            // Optional: Add custom data for app redirection
            data: {
                notificationId: notification.id,
                type: notification.type || 'info',
            },
            webpush: {
                fcmOptions: {
                    link: '/dashboard/transactions'
                }
            }
        };

        const response = await adminMessaging.sendEachForMulticast(message as any);
        console.log('Successfully sent push notification:', response.successCount, 'successes', response.failureCount, 'failures');

        // Optional: Cleanup invalid tokens
        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            if (failedTokens.length > 0) {
                console.log('Removing invalid tokens:', failedTokens);
                await supabaseAdmin.from('fcm_tokens').delete().in('token', failedTokens);
            }
        }

        // Message sent via sendEachForMulticast above
        console.log('Successfully sent push notification:', response);

        return NextResponse.json({ success: true, response });

    } catch (error: any) {
        console.error('Error in push notification webhook:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
