import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RatesService } from '@/services/rates';
import { calculateRate, isInversePair, performCalculation, normalizeCurrency } from '@/lib/rates-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create a Supabase admin client to bypass RLS for webhook insertions
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
    try {
        // 1. Verify Authentication
        const authHeader = req.headers.get('authorization');
        const secret = process.env.N8N_WEBHOOK_SECRET;

        if (!secret) {
            console.error('N8N_WEBHOOK_SECRET is not configured');
            return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
        }

        if (authHeader !== `Bearer ${secret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Body
        const body = await req.json();
        const {
            phone_number,
            amount_sent,
            currency_sent = 'PEN',
            currency_received = 'VES',
            destination_account
        } = body;

        if (!phone_number || !amount_sent || !destination_account) {
            return NextResponse.json({ error: 'Missing required fields: phone_number, amount_sent, destination_account' }, { status: 400 });
        }

        const sourceCurrency = normalizeCurrency(currency_sent);
        const targetCurrency = normalizeCurrency(currency_received);

        // 3. Find User by Phone
        // Clean phone number (remove spaces, +, etc) to improve matching
        const cleanPhone = phone_number.replace(/\D/g, '');
        
        // We try to match the exact phone, or ending with the number
        const { data: users, error: userError } = await supabaseAdmin
            .from('profiles')
            .select('id, phone, full_name, client_code')
            .filter('phone', 'ilike', `%${cleanPhone}%`)
            .limit(1);

        if (userError || !users || users.length === 0) {
            return NextResponse.json({ error: 'User not found with phone: ' + phone_number }, { status: 404 });
        }

        const user = users[0];

        // 4. Calculate Rates
        const ratesData = await RatesService.getLatest();
        if (!ratesData) {
            return NextResponse.json({ error: 'Rates configuration not found' }, { status: 500 });
        }

        const toPrice = ratesData.usdt_prices[targetCurrency as keyof typeof ratesData.usdt_prices] || 1;
        const fromPrice = ratesData.usdt_prices[sourceCurrency as keyof typeof ratesData.usdt_prices] || 1;
        
        const marginKey = `${sourceCurrency}_${targetCurrency}`;
        const marginPercentage = ratesData.margins[marginKey] || ratesData.margins['GENERIC'] || 0;

        const rate = calculateRate(targetCurrency, sourceCurrency, toPrice, fromPrice, marginPercentage);
        const isInv = isInversePair(targetCurrency, sourceCurrency);
        const amountReceived = performCalculation(Number(amount_sent), rate, isInv);

        // 5. Create Transaction
        // Build beneficiary data JSON structure
        const beneficiaryData = typeof destination_account === 'string' 
            ? { raw_text: destination_account } 
            : destination_account;

        const { data: transaction, error: txError } = await supabaseAdmin
            .from('transactions')
            .insert({
                user_id: user.id,
                status: 'verifying',
                amount_sent: Number(amount_sent),
                currency_sent: sourceCurrency,
                amount_received: amountReceived,
                currency_received: targetCurrency,
                exchange_rate: rate,
                beneficiary_data: beneficiaryData,
                payment_proof_url: body.payment_proof_url || null // Optional if n8n uploads it
            })
            .select('id')
            .single();

        if (txError) {
            console.error('Error creating transaction:', txError);
            return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Transaction created successfully in verifying state',
            transaction_id: transaction.id,
            user: { name: user.full_name, code: user.client_code },
            calculation: {
                rate,
                amount_received: amountReceived
            }
        });

    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
