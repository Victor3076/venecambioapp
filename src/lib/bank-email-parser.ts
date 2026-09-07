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

    let amount = 0
    let timeHHMM = ''
    let bankName = 'Banco Estado'
    let clientName = ''
    let operationNumber = ''

    // 1. EXTRAER MONTO
    const amountPatterns = [
        /(?:monto\s*transferido|monto\s*transferencia|monto\s*recibido|monto)\s*[:]?\s*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]+)?|[0-9]+)/i,
        /has\s*recibido\s*una\s*transferencia[^\$]*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})+)/i,
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
        /(?:n[úu]mero\s*de\s*operaci[oó]n|n[°º]\s*de\s*operaci[oó]n|n[°º]\s*operaci[oó]n|comprobante|c[oó]digo\s*de\s*operaci[oó]n)\s*[:]?\s*(\w+)/i,
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
        /(?:cliente|de\s*nuestro\(a\)\s*cliente)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,40}?)(?:,|\sha\s|con\s|hacia|\.|$)/i,
        /transferencia\s+de\s+fondos\s+de\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,40}?)\s+(?:hacia|a\s+tu|al)/i,
        /(?:origen|emisor|ordenante)\s*[:]?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,40}?)(?:rut|banco|cuenta|\.|$)/i
    ]

    for (const pattern of clientPatterns) {
        const match = text.match(pattern)
        if (match && match[1]) {
            const candidate = match[1].trim()
            if (candidate.length > 2 && !candidate.toLowerCase().includes('cyber') && !candidate.toLowerCase().includes('banco')) {
                clientName = candidate
                break
            }
        }
    }

    // 5. DETECTAR BANCO DE ORIGEN / DESTINO
    if (from.includes('bancoestado') || text.includes('bancoestado') || text.includes('banco estado')) {
        bankName = 'Banco Estado'
    } else if (from.includes('bancochile') || text.includes('banco de chile')) {
        bankName = 'Banco de Chile'
    } else if (from.includes('bci') || text.includes('bci') || text.includes('mach')) {
        bankName = 'Banco BCI'
    } else if (from.includes('falabella') || text.includes('banco falabella')) {
        bankName = 'Banco Falabella'
    } else if (from.includes('santander') || text.includes('santander')) {
        bankName = 'Banco Santander'
    } else if (from.includes('scotiabank') || text.includes('scotiabank')) {
        bankName = 'Scotiabank'
    } else if (from.includes('itau') || text.includes('itaú') || text.includes('itau')) {
        bankName = 'Banco Itaú'
    }

    // 6. GENERAR REFERENCIA
    // Formato exacto requerido: "cyber transf 1719"
    const referenceNumber = `cyber transf ${timeHHMM}`

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
