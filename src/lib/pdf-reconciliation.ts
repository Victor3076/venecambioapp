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

        // Agrupar elementos por línea visual según coordenada vertical Y
        const linesMap: { y: number; items: { x: number; str: string }[] }[] = []
        const Y_TOLERANCE = 4 // píxeles de tolerancia en la misma fila

        for (const item of textContent.items as any[]) {
            const str = (item.str || '').trim()
            if (!str) continue

            const x = item.transform ? item.transform[4] : 0
            const y = item.transform ? item.transform[5] : 0

            let line = linesMap.find(l => Math.abs(l.y - y) <= Y_TOLERANCE)
            if (!line) {
                line = { y, items: [] }
                linesMap.push(line)
            }
            line.items.push({ x, str: item.str })
        }

        // Ordenar líneas de arriba hacia abajo (en PDF Y=0 está abajo)
        linesMap.sort((a, b) => b.y - a.y)

        for (const lineObj of linesMap) {
            // Ordenar items de izquierda a derecha
            lineObj.items.sort((a, b) => a.x - b.x)
            const lineText = lineObj.items.map(it => it.str).join(" ").trim()
            const upper = lineText.toUpperCase()

            // 1. OMITIR COMISIONES BANCARIAS
            // Ejemplos BDV: "COMISION PAGOMOVILBDV DEBITO", "COBRO COMISION PAG MOVIL BDV A BDV"
            if (upper.includes("COMISION") || upper.includes("COMISIÓN")) {
                continue
            }

            // 2. OMITIR CRÉDITOS / ENTRADAS (solo interesan egresos / débitos a beneficiarios)
            if (upper.includes("CREDITO") || upper.includes("CRÉDITO")) {
                continue
            }

            // 3. Extraer todos los números monetarios con 2 decimales en la línea
            const amountRegex = /(?:^|[^\d/:\-])([+-]?(?:[1-9]\d{0,2}(?:\.\d{3})+,\d{2}|\d+,\d{2}|[1-9]\d{0,2}(?:,\d{3})+\.\d{2}|\d+\.\d{2}))(?=[^\d/:]|$)/g
            const lineAmounts: number[] = []
            let m: RegExpExecArray | null

            while ((m = amountRegex.exec(lineText)) !== null) {
                const raw = m[1].replace('+', '').trim()
                if (lineText.includes(raw + '-') || lineText.includes('-' + raw)) continue
                const parsed = parseAmount(raw)
                if (parsed !== null && parsed > 0.001) {
                    lineAmounts.push(parsed)
                }
            }

            if (lineAmounts.length === 0) continue

            // 4. DISTINGUIR MONTO VS SALDO:
            // En extractos bancarios con columnas Monto y Saldo (como BDV):
            // La fila termina con: [..., Monto, Saldo].
            // Por lo tanto, el Monto de la operación es el penúltimo valor numérico.
            // En extractos con una sola columna de monto (como Banesco): se toma ese valor único.
            let targetAmount: number
            if (lineAmounts.length >= 2) {
                targetAmount = lineAmounts[lineAmounts.length - 2]
            } else {
                targetAmount = lineAmounts[0]
            }

            if (targetAmount && targetAmount > 0) {
                validAmounts.push(targetAmount)
            }
        }
    }

    return validAmounts
}
