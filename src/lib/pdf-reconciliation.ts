/**
 * Utilidad client-side para extracción de texto y montos monetarios desde archivos PDF bancarios.
 * Se ejecuta completamente en el navegador sin dependencias nativas del servidor.
 */

declare global {
    interface Window {
        pdfjsLib?: any
    }
}

async function loadPdfJs(): Promise<any> {
    if (typeof window === 'undefined') {
        throw new Error('La lectura de PDFs solo está disponible en el navegador.')
    }

    if (window.pdfjsLib) {
        return window.pdfjsLib
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = '/vendor/pdfjs/pdf.min.js'
        script.async = true

        const setupLib = () => {
            const lib = window.pdfjsLib
            if (lib) {
                lib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js'
                resolve(lib)
            } else {
                reject(new Error('No se pudo inicializar la librería de PDF.'))
            }
        }

        script.onload = setupLib

        script.onerror = () => {
            // Fallback a CDN en caso de que la ruta local no esté disponible
            const fallbackScript = document.createElement('script')
            fallbackScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
            fallbackScript.async = true
            fallbackScript.onload = () => {
                const lib = window.pdfjsLib
                if (lib) {
                    lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
                    resolve(lib)
                } else {
                    reject(new Error('No se pudo inicializar la librería de PDF.'))
                }
            }
            fallbackScript.onerror = () => reject(new Error('No fue posible cargar el lector de PDF.'))
            document.head.appendChild(fallbackScript)
        }

        document.head.appendChild(script)
    })
}

function parseAmount(numStr: string): number | null {
    let clean = numStr.replace(/[\u00A0\u202F]/g, ' ').replace('+', '').trim()

    if (clean.includes(',') && clean.includes('.')) {
        if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
            // Formato venezolano: 1.234,56
            clean = clean.replace(/\./g, '').replace(',', '.')
        } else {
            // Formato internacional: 1,234.56
            clean = clean.replace(/,/g, '')
        }
    } else if (clean.includes(',')) {
        clean = clean.replace(',', '.')
    }

    const val = parseFloat(clean)
    if (isNaN(val) || Math.abs(val) <= 0.001) return null
    return Math.round(Math.abs(val) * 100) / 100
}

/**
 * Extrae los montos reales de las transferencias salientes (débitos) presentes en el PDF.
 * - Omite comisiones bancarias (BDV, Banesco, etc.)
 * - Omite créditos / depósitos entrantes (solo busca salidas a beneficiarios)
 * - En tablas con columna Monto y Saldo (ej. BDV), extrae SOLO el Monto y descarta el Saldo.
 */
export async function extractAmountsFromBankPdf(file: File): Promise<number[]> {
    const pdfjsLib = await loadPdfJs()
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
    const pdfDoc = await loadingTask.promise

    const validAmounts: number[] = []

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum)
        const textContent = await page.getTextContent()

        // Agrupar elementos por fila visual utilizando una tolerancia de 8 píxeles.
        // En extractos bancarios (BDV, Banesco), las filas están separadas por más de 20px,
        // por lo que 8px agrupa exactamente la línea de una misma transacción sin fragmentarla.
        const items = (textContent.items as any[])
            .map(it => ({
                str: (it.str || '').trim(),
                x: it.transform ? Math.round(it.transform[4]) : 0,
                y: it.transform ? Math.round(it.transform[5]) : 0
            }))
            .filter(it => it.str)

        // Ordenar de arriba a abajo
        items.sort((a, b) => b.y - a.y)

        const rows: { y: number; items: { x: number; y: number; str: string }[] }[] = []
        for (const item of items) {
            let row = rows.find(r => Math.abs(r.y - item.y) <= 8)
            if (!row) {
                row = { y: item.y, items: [] }
                rows.push(row)
            }
            row.items.push(item)
        }

        for (const r of rows) {
            // Ordenar items de izquierda a derecha
            r.items.sort((a, b) => a.x - b.x)
            const rowText = r.items.map(it => it.str).join(' ').trim()
            const upper = rowText.toUpperCase()

            // Extraer montos numéricos presentes en esta fila
            const amountRegex = /(?:^|[^\d/:\-])([+-]?(?:[1-9]\d{0,2}(?:\.\d{3})+,\d{2}|\d+,\d{2}|[1-9]\d{0,2}(?:,\d{3})+\.\d{2}|\d+\.\d{2}))(?=[^\d/:]|$)/g
            const rowAmounts: number[] = []
            let m: RegExpExecArray | null

            while ((m = amountRegex.exec(rowText)) !== null) {
                const raw = m[1].replace('+', '').trim()
                if (rowText.includes(raw + '-') || rowText.includes('-' + raw)) continue
                const parsed = parseAmount(raw)
                if (parsed !== null && parsed > 0.001) {
                    rowAmounts.push(parsed)
                }
            }

            if (rowAmounts.length === 0) continue

            // 1. OMITIR COMISIONES BANCARIAS
            // Detecta comisiones en BDV, Banesco, etc.
            // Ejemplos en BDV:
            // - "COMISION PAGOMOVILBDV"
            // - "COBRO COMISION PAG MOVIL BDV A BDV"
            // - "COM TRANSF EN LINEA OT BCOS NAT NA"
            // Las operaciones reales dicen: "OPERACION PAGOMOVIL BDV", "TRASPASO OTRAS CTAS", etc.
            const isCommission = upper.includes("COMISION") ||
                                 upper.includes("COMISIÓN") ||
                                 upper.includes("COBRO COM") ||
                                 upper.includes("COM TRANSF") ||
                                 /\bCOM\s+/.test(upper) ||
                                 upper.includes("IVA COMIS")

            if (isCommission) {
                continue
            }

            // 2. OMITIR CRÉDITOS / ENTRADAS (solo interesan egresos / débitos a beneficiarios)
            if (upper.includes("CREDITO") || upper.includes("CRÉDITO")) {
                continue
            }

            // 3. DISTINGUIR MONTO VS SALDO:
            // En extractos bancarios con columnas Monto y Saldo (como BDV):
            // La fila termina con: [..., Monto, Saldo].
            // Por lo tanto, el Monto de la operación es el penúltimo valor numérico.
            // En extractos con una sola columna de monto (como Banesco): se toma ese valor único.
            let targetAmount: number
            if (rowAmounts.length >= 2) {
                targetAmount = rowAmounts[rowAmounts.length - 2]
            } else {
                targetAmount = rowAmounts[0]
            }

            if (targetAmount && targetAmount > 0) {
                validAmounts.push(targetAmount)
            }
        }
    }

    return validAmounts
}
