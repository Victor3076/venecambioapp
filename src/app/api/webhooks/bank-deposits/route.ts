import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseBankEmail, getChileTimeHHMM } from '@/lib/bank-email-parser'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Create Supabase Admin client to bypass RLS for webhook insertions
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: Request) {
    try {
        // 1. Verify Authentication (Bearer token or x-webhook-secret)
        const authHeader = req.headers.get('authorization')
        const headerSecret = req.headers.get('x-webhook-secret')
        const secret = process.env.N8N_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET

        if (secret) {
            const isBearerValid = authHeader === `Bearer ${secret}`
            const isHeaderValid = headerSecret === secret

            if (!isBearerValid && !isHeaderValid) {
                return NextResponse.json({ error: 'Unauthorized: Invalid webhook secret' }, { status: 401 })
            }
        }

        // 2. Parse Request Body
        const body = await req.json()

        // Handle both: raw email input OR direct JSON payload
        let amount = Number(body.amount) || 0
        let currency = (body.currency || 'CLP').toUpperCase()
        let bankName = body.bank_name || body.bankName || 'Banco Estado'
        let notes = body.notes || body.comment || ''
        let referenceNumber = body.reference_number || body.referenceNumber || ''
        let parsedDetails: any = null

        // If amount is not provided directly, or if email body/text/html is present -> parse email
        if (!amount || body.body || body.text || body.html || body.snippet || body.subject) {
            const parsed = parseBankEmail({
                subject: body.subject,
                body: body.body || body.content || body.snippet,
                text: body.text || body.plain,
                html: body.html,
                from: body.from || body.sender,
                date: body.date || body.internalDate || body.timestamp
            })

            parsedDetails = parsed
            if (!amount && parsed.amount > 0) amount = parsed.amount
            if (!body.currency && parsed.currency) currency = parsed.currency
            if (!referenceNumber && parsed.referenceNumber) referenceNumber = parsed.referenceNumber
            if (parsed.bankName) bankName = parsed.bankName
            if (!notes && parsed.notes) notes = parsed.notes
        }

        // Validate Amount
        if (!amount || amount <= 0) {
            return NextResponse.json({
                error: 'No se pudo detectar un monto válido en el depósito o correo',
                parsed: parsedDetails,
                received_body: body
            }, { status: 400 })
        }

        // If reference is still empty, format as "cyber transf HHMM"
        if (!referenceNumber) {
            const timeHHMM = body.time || getChileTimeHHMM(body.date)
            referenceNumber = `cyber transf ${timeHHMM}`
        }

        // Ensure "cyber transf" prefix if user only sent time e.g. "1719"
        if (/^\d{3,4}$/.test(referenceNumber.trim())) {
            referenceNumber = `cyber transf ${referenceNumber.trim()}`
        }

        // Formatear fecha en hora local de Chile (America/Santiago) para evitar desfase UTC en la noche (después de las 21:00)
        const dateInput = body.date || new Date()
        let chileDateStr: string
        try {
            chileDateStr = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Santiago',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(new Date(dateInput))
        } catch {
            chileDateStr = new Date().toISOString().split('T')[0]
        }

        // 3. Handle Deduplication & Uniqueness
        // A) Comprobación 1: Por Número de Operación bancaria (si está presente)
        const opNumber = parsedDetails?.operationNumber
        if (opNumber) {
            const { data: opMatch } = await supabaseAdmin
                .from('bank_deposits')
                .select('id, amount, reference_number, notes, created_at')
                .eq('currency', currency)
                .ilike('notes', `%Op: ${opNumber}%`)
                .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
                .limit(1)

            if (opMatch && opMatch.length > 0) {
                return NextResponse.json({
                    success: true,
                    message: `Depósito ya registrado previamente con N° de Operación ${opNumber} (duplicado ignorado)`,
                    deposit: opMatch[0],
                    is_duplicate: true
                }, { status: 200 })
            }
        }

        // B) Comprobación 2: Por Referencia y Monto en una ventana de las últimas 36 horas
        // (Esto evita el desfase de día UTC vs Chile y reintentos del webhook)
        const thirtySixHoursAgo = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
        let finalReference = referenceNumber
        const { data: existingDeps, error: searchError } = await supabaseAdmin
            .from('bank_deposits')
            .select('id, amount, reference_number, notes, deposit_date, created_at')
            .eq('currency', currency)
            .gte('created_at', thirtySixHoursAgo)
            .ilike('reference_number', `${referenceNumber}%`)

        if (searchError) {
            console.error('Error checking existing deposits:', searchError)
        }

        if (existingDeps && existingDeps.length > 0) {
            // Check if exact same deposit already exists (idempotency)
            const exactMatch = existingDeps.find(d => 
                Number(d.amount) === amount && d.reference_number.toLowerCase() === referenceNumber.toLowerCase()
            )
            if (exactMatch) {
                return NextResponse.json({
                    success: true,
                    message: 'Depósito ya registrado previamente (duplicado ignorado)',
                    deposit: exactMatch,
                    is_duplicate: true
                }, { status: 200 })
            }

            // Si es un depósito legítimo diferente pero con el mismo minuto (diferente monto o cliente), agregar sufijo -2, -3...
            let counter = 2
            while (existingDeps.some(d => d.reference_number.toLowerCase() === `${referenceNumber}-${counter}`.toLowerCase())) {
                counter++
            }
            finalReference = `${referenceNumber}-${counter}`
        }

        // 4. Insert into bank_deposits table
        const { data: insertedDeposit, error: insertError } = await supabaseAdmin
            .from('bank_deposits')
            .insert([{
                amount,
                currency,
                reference_number: finalReference,
                bank_name: bankName,
                notes: notes || null,
                status: 'available',
                deposit_date: chileDateStr
            }])
            .select()
            .single()

        if (insertError) {
            // Si la base de datos rechaza por restricción única, devolver éxito idempotente
            if (insertError.code === '23505' || insertError.message?.toLowerCase().includes('unique')) {
                return NextResponse.json({
                    success: true,
                    message: 'Depósito ya registrado previamente (duplicado ignorado por restricción única)',
                    is_duplicate: true
                }, { status: 200 })
            }
            console.error('Error inserting bank deposit:', insertError)
            return NextResponse.json({
                error: 'Error al registrar el depósito en base de datos',
                details: insertError.message
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'Depósito bancario registrado exitosamente',
            deposit: insertedDeposit,
            parsed_info: parsedDetails
        }, { status: 201 })

    } catch (error: any) {
        console.error('Webhook error in bank-deposits:', error)
        return NextResponse.json({
            error: error.message || 'Error interno del servidor'
        }, { status: 500 })
    }
}
