import { NextRequest, NextResponse } from "next/server";
import { adminMessaging } from "@/lib/firebase-admin";
import { createClient } from "@supabase/supabase-js";

// Use service role key to bypass RLS and get tokens
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
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

        // 2. Fetch the User's FCM Token
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('fcm_token')
            .eq('id', notification.user_id)
            .single();

        if (profileError || !profile?.fcm_token) {
            console.log('No FCM token found for user:', notification.user_id);
            return NextResponse.json({ success: true, message: 'No token found, skipping push' });
        }

        // 3. Send Push Notification via Firebase Admin
        const message = {
            notification: {
                title: notification.title || 'Venecambio',
                body: notification.message || 'Tienes una nueva actualización.',
            },
            token: profile.fcm_token,
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

        const response = await adminMessaging.send(message);
        console.log('Successfully sent push notification:', response);

        return NextResponse.json({ success: true, response });

    } catch (error: any) {
        console.error('Error in push notification webhook:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
