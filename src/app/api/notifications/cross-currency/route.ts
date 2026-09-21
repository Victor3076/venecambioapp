import { NextRequest, NextResponse } from "next/server";
import { sendCrossCurrencyAlertToAdmins, isTargetCrossCurrency } from "@/lib/admin-push";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log('Cross-currency notification request received:', body);

        // Can receive direct payload or Supabase webhook payload ({ record: { ... } })
        const tx = body.record || body;

        if (!tx || !tx.currency_received) {
            return NextResponse.json({ error: 'Missing transaction data or currency_received' }, { status: 400 });
        }

        const destCurrency = (tx.currency_received || '').trim().toUpperCase();
        if (!isTargetCrossCurrency(destCurrency)) {
            return NextResponse.json({ skipped: true, message: `Currency ${destCurrency} is not in alert list (PEN, USD, COP, CLP)` });
        }

        // Fetch client name if not provided
        let clientName = tx.client_name;
        if (!clientName && tx.user_id) {
            try {
                const supabaseAdmin = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                );
                const { data: userProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('full_name, client_code, phone')
                    .eq('id', tx.user_id)
                    .single();

                if (userProfile) {
                    clientName = userProfile.full_name || userProfile.client_code || userProfile.phone;
                }
            } catch (e) {
                console.warn('Could not fetch profile for user_id:', tx.user_id);
            }
        }

        const result = await sendCrossCurrencyAlertToAdmins({
            transaction_id: tx.id || tx.transaction_id,
            amount_sent: Number(tx.amount_sent) || 0,
            currency_sent: (tx.currency_sent || '').toUpperCase(),
            amount_received: Number(tx.amount_received) || 0,
            currency_received: destCurrency,
            client_name: clientName,
            exchange_rate: Number(tx.exchange_rate) || 0,
            user_id: tx.user_id
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error handling cross-currency alert request:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
