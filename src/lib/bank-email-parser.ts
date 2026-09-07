/**
 * Parser universal para correos de notificación de transferencias bancarias chilenas.
 * Soporta BancoEstado, Banco de Chile, BCI, Falabella, Santander, Scotiabank, Itaú, etc.
 */

export interface ParsedBankEmail {
    amount: number
    currency: string
    timeHHMM: string
    referenceNumber: string
    bankName: string
    clientName?: string
    operationNumber?: string
    rawDate?: string
    notes?: string
}

export function parseChileanAmount(amountStr: string): number {
    if (!amountStr) return 0
    // Limpiar símbolos y espacios: "$ 95.000" -> "95000"
    // En Chile: separador de miles es '.' y decimales ','
    const clean = amountStr.replace(/[^0-9.,]/g, '').trim()
    if (!clean) return 0

    // Si tiene puntos como miles: "95.000" -> "95000"
    if (clean.includes('.') && !clean.includes(',')) {
        return parseFloat(clean.replace(/\./g, '')) || 0
    }
    // Si tiene comas decimales: "95.000,50" -> "95000.50"
    const standardFormat = clean.replace(/\./g, '').replace(',', '.')
    return parseFloat(standardFormat) || 0
}

export function getChileTimeHHMM(dateInput?: string | Date): string {
    const d = dateInput ? new Date(dateInput) : new Date()
    try {
        const formatter = new Intl.DateTimeFormat('es-CL', {
            timeZone: 'America/Santiago',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
        const parts = formatter.formatToParts(d)
        const hour = parts.find(p => p.type === 'hour')?.value || '00'
        const minute = parts.find(p => p.type === 'minute')?.value || '00'
        return `${hour}${minute}`
    } catch {
        const h = String(d.getHours()).padStart(2, '0')
        const m = String(d.getMinutes()).padStart(2, '0')
        return `${h}${m}`
    }
}

/**
 * Normaliza y limpia texto HTML o texto plano
 */
function cleanText(input: string): string {
    if (!input) return ''
    return input
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim()
}

export function parseUSAmount(amountStr: string): number {
    if (!amountStr) return 0
    const clean = amountStr.replace(/[^0-9.]/g, '').trim()
    return parseFloat(clean) || 0
}

export function parseBankEmail(params: {
    subject?: string
    body?: string
    text?: string
    html?: string
    from?: string
    date?: string | Date
}): ParsedBankEmail {
    const rawContent = `${params.subject || ''} ${params.body || ''} ${params.text || ''} ${params.html || ''}`
    const text = cleanText(rawContent)
    const from = (params.from || '').toLowerCase()
    const subject = params.subject || ''

    let amount = 0
    let currency = 'CLP'
    let timeHHMM = ''
    let bankName = 'Banco Estado'
    let clientName = ''
    let operationNumber = ''
    let referenceNumber = ''

    // DETECCIÓN ESPECIAL: ZELLE / BANK OF AMERICA / US BANKS
    const isZelleOrUS = from.includes('bankofamerica') || 
                        from.includes('ealerts.bankofamerica.com') ||
                        from.includes('chase.com') ||
                        from.includes('wellsfargo.com') ||
                        from.includes('zelle') ||
                        text.toLowerCase().includes('zelle') ||
                        /sent\s+you\s+\$/i.test(subject) ||
                        /sent\s+you\s+\$/i.test(text)

    if (isZelleOrUS) {
        currency = 'USD'
        bankName = from.includes('bankofamerica') ? 'Bank of America' : 
                   from.includes('chase') ? 'Chase' :
                   from.includes('wellsfargo') ? 'Wells Fargo' : 'Zelle'

        // Extraer emisor y monto de Zelle: ej. "Celina Nunez De Hurtado sent you $20.00"
        const zelleMatch = subject.match(/^([A-Za-zÁÉÍÓÚÑa-záéíóúñ\s]+?)\s+sent\s+you\s+\$([0-9,]+(?:\.[0-9]{1,2})?)/i) 
            || text.match(/([A-Za-zÁÉÍÓÚÑa-záéíóúñ\s]{2,40}?)\s+sent\s+you\s+\$([0-9,]+(?:\.[0-9]{1,2})?)/i)

        if (zelleMatch) {
            clientName = zelleMatch[1].trim()
            amount = parseFloat(zelleMatch[2].replace(/,/g, '')) || 0
        } else {
            const usAmountMatch = text.match(/\$\s*([0-9,]+(?:\.[0-9]{2})?)/)
            if (usAmountMatch) {
                amount = parseFloat(usAmountMatch[1].replace(/,/g, '')) || 0
            }
        }

        // Generar referencia: "zelle [primer_nombre]" ej. "zelle celina"
        const firstName = clientName ? clientName.split(' ')[0].toLowerCase() : 'deposito'
        referenceNumber = `zelle ${firstName}`
        timeHHMM = getChileTimeHHMM(params.date)

        return {
            amount,
            currency: 'USD',
            timeHHMM,
            referenceNumber,
            bankName,
            clientName: clientName || undefined,
            operationNumber: undefined,
            notes: clientName ? `Zelle de ${clientName}` : 'Transferencia Zelle'
        }
    }

    // 1. EXTRAER MONTO (CHILE / CLP)
    const amountPatterns = [
        /(?:monto\s*transferido|monto\s*transferencia|monto\s*recibido|monto\s*de\s*la\s*transferencia|monto\s*total|monto)\s*[:]?\s*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]+)?|[0-9]+)/i,
        /transferencia\s*(?:exitosa|por|de)\s*[^\$0-9]*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})+)/i,
        /has\s*recibido\s*(?:una\s*transferencia|un\s*pago)[^\$0-9]*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})+)/i,
        /\$\s*([0-9]{1,3}(?:\.[0-9]{3})+)/,
        /total\s*[:]?\s*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})+)/i
    ]

    for (const pattern of amountPatterns) {
        const match = text.match(pattern)
        if (match && match[1]) {
            const parsed = parseChileanAmount(match[1])
            if (parsed > 0) {
                amount = parsed
                break
            }
        }
    }

    // 2. EXTRAER HORA DE LA TRANSFERENCIA
    // Buscar formato HH:MM:SS o HH:MM en el texto
    const timeMatch = text.match(/(?:hora|hoy|\d{2}[\/\-]\d{2}[\/\-]\d{4})\s*[:\s]*(\d{1,2}):(\d{2})(?::\d{2})?/i) 
        || text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/)

    if (timeMatch && timeMatch[1] && timeMatch[2]) {
        const h = timeMatch[1].padStart(2, '0')
        const m = timeMatch[2].padStart(2, '0')
        timeHHMM = `${h}${m}`
    } else {
        timeHHMM = getChileTimeHHMM(params.date)
    }

    // 3. EXTRAER NÚMERO DE OPERACIÓN / COMPROBANTE
    const opPatterns = [
        /(?:n[úu]mero\s*de\s*operaci[oó]n|n[°º]\s*de\s*operaci[oó]n|n[°º]\s*operaci[oó]n|comprobante|c[oó]digo\s*de\s*operaci[oó]n|c[oó]digo\s*de\s*transferencia|id\s*de\s*transacci[oó]n|n[úu]mero\s*de\s*comprobante)\s*[:]?\s*(\w+)/i,
        /operaci[oó]n\s*[:]?\s*(\w+)/i
    ]

    for (const pattern of opPatterns) {
        const match = text.match(pattern)
        if (match && match[1] && match[1].toLowerCase() !== 'de') {
            operationNumber = match[1].trim()
            break
        }
    }

    // 4. EXTRAER NOMBRE DEL CLIENTE / EMISOR
    const clientPatterns = [
        /recibiste\s+una\s+transferencia\s+de\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,40}?)(?:-|\.|$|\shola)/i,
        /(?:cliente|de\s*nuestro\(a\)\s*cliente)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,40}?)(?:,|\sha\s|con\s|hacia|\.|$)/i,
        /transferencia\s+de\s+fondos\s+de\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,40}?)\s+(?:hacia|a\s+tu|al)/i,
        /(?:origen|emisor|ordenante|transferido\s*por)\s*[:]?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,40}?)(?:rut|banco|cuenta|\.|$)/i
    ]

    for (const pattern of clientPatterns) {
        const match = text.match(pattern)
        if (match && match[1]) {
            const candidate = match[1].trim()
            if (candidate.length > 2 && !candidate.toLowerCase().includes('cyber') && !candidate.toLowerCase().includes('banco') && !candidate.toLowerCase().includes('comprobante')) {
                clientName = candidate
                break
            }
        }
    }

    // 5. DETECTAR BANCO DE ORIGEN / DESTINO
    const combinedSearch = `${from} ${text}`.toLowerCase()
    if (combinedSearch.includes('machbank') || combinedSearch.includes('mach') || combinedSearch.includes('somosmach')) {
        bankName = 'MACH'
    } else if (combinedSearch.includes('tenpo')) {
        bankName = 'Tenpo'
    } else if (combinedSearch.includes('bancoestado') || combinedSearch.includes('banco estado')) {
        bankName = 'Banco Estado'
    } else if (combinedSearch.includes('bancochile') || combinedSearch.includes('banco de chile') || combinedSearch.includes('edwards')) {
        bankName = 'Banco de Chile'
    } else if (combinedSearch.includes('falabella') || combinedSearch.includes('cmr')) {
        bankName = 'Banco Falabella'
    } else if (combinedSearch.includes('bci')) {
        bankName = 'Banco BCI'
    } else if (combinedSearch.includes('santander')) {
        bankName = 'Banco Santander'
    } else if (combinedSearch.includes('scotiabank')) {
        bankName = 'Scotiabank'
    } else if (combinedSearch.includes('itau') || combinedSearch.includes('itaú')) {
        bankName = 'Banco Itaú'
    } else if (combinedSearch.includes('mercadopago') || combinedSearch.includes('mercado pago')) {
        bankName = 'Mercado Pago'
    } else if (combinedSearch.includes('coopeuch')) {
        bankName = 'Coopeuch'
    }

    // 6. GENERAR REFERENCIA
    // Formato exacto requerido: "cyber transf 1719"
    referenceNumber = `cyber transf ${timeHHMM}`

    // 7. ARMAR COMENTARIOS / NOTAS
    const notesParts: string[] = []
    if (clientName) notesParts.push(`Cliente: ${clientName}`)
    if (operationNumber) notesParts.push(`Op: ${operationNumber}`)
    if (bankName) notesParts.push(`Banco: ${bankName}`)

    return {
        amount,
        currency: 'CLP',
        timeHHMM,
        referenceNumber,
        bankName,
        clientName: clientName || undefined,
        operationNumber: operationNumber || undefined,
        notes: notesParts.join(' | ') || undefined
    }
}
