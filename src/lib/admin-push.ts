import { getAdminMessaging } from "@/lib/firebase-admin";
import { createClient } from "@supabase/supabase-js";

export const TARGET_ALERT_CURRENCIES = ['PEN', 'USD', 'COP', 'CLP'];

// In-memory cache to prevent duplicate alerts for the same transaction within 30 seconds
const recentlyNotifiedTxs = new Set<string>();

export function isTargetCrossCurrency(currency?: string | null): boolean {
    if (!currency) return false;
    return TARGET_ALERT_CURRENCIES.includes(currency.trim().toUpperCase());
}

export interface CrossCurrencyAlertData {
    transaction_id?: string;
    amount_sent: number;
    currency_sent: string;
    amount_received: number;
    currency_received: string;
    client_name?: string;
    client_phone?: string;
    exchange_rate?: number;
    user_id?: string;
}

export async function sendCrossCurrencyAlertToAdmins(tx: CrossCurrencyAlertData) {
    try {
        const destCurrency = (tx.currency_received || '').trim().toUpperCase();
        if (!isTargetCrossCurrency(destCurrency)) {
            return { skipped: true, reason: `Currency ${destCurrency} is not in alert list (PEN, USD, COP, CLP)` };
        }

        // Deduplication check
        if (tx.transaction_id) {
            if (recentlyNotifiedTxs.has(tx.transaction_id)) {
                console.log(`[Admin Push] Skipping duplicate push for tx: ${tx.transaction_id}`);
                return { skipped: true, reason: 'Transaction already notified recently' };
            }
            recentlyNotifiedTxs.add(tx.transaction_id);
            setTimeout(() => {
                recentlyNotifiedTxs.delete(tx.transaction_id!);
            }, 30000);
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 1. Get all admin users from profiles
        const { data: adminProfiles, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, phone')
            .eq('role', 'admin');

        if (profileError || !adminProfiles || adminProfiles.length === 0) {
            console.log('No admin users found in profiles');
            return { success: false, message: 'No admin users found' };
        }

        const adminUserIds = adminProfiles.map(p => p.id);
        const clientLabel = tx.client_name || tx.client_phone || 'Cliente';
        const formattedSent = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(tx.amount_sent);
        const formattedReceived = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(tx.amount_received);

        const title = `🚨 Nueva Operación hacia ${destCurrency}`;
        const message = `${formattedSent} ${tx.currency_sent} → ${formattedReceived} ${destCurrency} (${clientLabel})`;

        // 2. Insert in-app notifications for admins
        const notificationRecords = adminUserIds.map(userId => ({
            user_id: userId,
            title,
            message,
            type: 'cross_currency_alert',
            data: {
                transaction_id: tx.transaction_id,
                amount_sent: tx.amount_sent,
                currency_sent: tx.currency_sent,
                amount_received: tx.amount_received,
                currency_received: destCurrency,
                url: '/admin/transactions'
            },
            is_read: false
        }));

        const { error: notifInsertError } = await supabaseAdmin
            .from('notifications')
            .insert(notificationRecords);

        if (notifInsertError) {
            console.error('Error saving in-app admin notifications:', notifInsertError);
        }

        // 3. Fetch all FCM tokens for these admins
        const { data: tokensData, error: tokensError } = await supabaseAdmin
            .from('fcm_tokens')
            .select('token, platform, user_id')
            .in('user_id', adminUserIds);

        if (tokensError || !tokensData || tokensData.length === 0) {
            console.log('No FCM tokens registered for admin users:', adminUserIds);
            return { success: true, message: 'In-app notification created. No FCM tokens found for admins.' };
        }

        const adminMessaging = getAdminMessaging();
        // Deduplicate tokens
        const webTokens = Array.from(new Set(tokensData.filter(t => t.platform === 'web').map(t => t.token)));
        const nativeTokens = Array.from(new Set(tokensData.filter(t => t.platform !== 'web').map(t => t.token)));

        const results: any[] = [];
        const notificationTag = tx.transaction_id ? `tx-${tx.transaction_id}` : 'cross-currency-alert';

        // 4a. Send Web Push
        if (webTokens.length > 0) {
            const webMessage = {
                tokens: webTokens,
                notification: {
                    title,
                    body: message,
                },
                webpush: {
                    headers: {
                        Urgency: 'high'
                    },
                    notification: {
                        title,
                        body: message,
                        icon: '/logo.png',
                        badge: '/logo.png',
                        tag: notificationTag,
                        vibrate: [200, 100, 200, 100, 200]
                    },
                    fcmOptions: {
                        link: '/admin/transactions'
                    }
                },
                data: {
                    type: 'cross_currency_alert',
                    transactionId: tx.transaction_id || '',
                    currencyReceived: destCurrency,
                    url: '/admin/transactions',
                    sound: 'default'
                }
            };
            const webResponse = await adminMessaging.sendEachForMulticast(webMessage as any);
            results.push({ type: 'web', response: webResponse, tokens: webTokens });
            console.log(`[Admin Push Web] Sent: ${webResponse.successCount} success, ${webResponse.failureCount} failed`);
        }

        // 4b. Send Native Push (Android / iOS) with Loud Sound Channel
        if (nativeTokens.length > 0) {
            const nativeMessage = {
                tokens: nativeTokens,
                notification: {
                    title,
                    body: message,
                },
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'transactions_alert',
                        sound: 'default',
                        defaultSound: true,
                        defaultVibrateTimings: true,
                        priority: 'high',
                        visibility: 'public',
                        tag: notificationTag
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1
                        }
                    }
                },
                data: {
                    type: 'cross_currency_alert',
                    transactionId: tx.transaction_id || '',
                    currencyReceived: destCurrency,
                    url: '/admin/transactions',
                    sound: 'default'
                }
            };
            const nativeResponse = await adminMessaging.sendEachForMulticast(nativeMessage as any);
            results.push({ type: 'native', response: nativeResponse, tokens: nativeTokens });
            console.log(`[Admin Push Native] Sent: ${nativeResponse.successCount} success, ${nativeResponse.failureCount} failed`);
        }

        // 5. Cleanup dead tokens
        for (const res of results) {
            if (res.response && res.response.failureCount > 0) {
                const failedTokens: string[] = [];
                res.response.responses.forEach((resp: any, idx: number) => {
                    if (!resp.success) {
                        failedTokens.push(res.tokens[idx]);
                    }
                });
                if (failedTokens.length > 0) {
                    console.log(`Removing invalid admin tokens (${res.type}):`, failedTokens);
                    await supabaseAdmin.from('fcm_tokens').delete().in('token', failedTokens);
                }
            }
        }

        return { success: true, results };
    } catch (error: any) {
        console.error('Error in sendCrossCurrencyAlertToAdmins:', error);
        return { success: false, error: error.message };
    }
}
