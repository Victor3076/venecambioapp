/**
 * Utilidad client-side para extracción de texto y montos monetarios desde archivos PDF bancarios.
 * Se ejecuta completamente en el navegador.
 * - Estrategia 1: extracción de texto directo (pdfjs) → funciona para Banesco, Mercantil, etc.
 * - Estrategia 2: render a canvas + OCR (Tesseract.js) → fallback para BDV y PDFs imagen
 */

declare global {
    interface Window {
        pdfjsLib?: any
        Tesseract?: any
    }
}

// ─── Carga dinámica de pdfjs ─────────────────────────────────────────────────

async function loadPdfJs(): Promise<any> {
    if (typeof window === 'undefined') {
        throw new Error('La lectura de PDFs solo está disponible en el navegador.')
    }

    if (window.pdfjsLib) return window.pdfjsLib

    return new Promise((resolve, reject) => {
        const tryLoad = (src: string, workerSrc: string, onFail?: () => void) => {
            const script = document.createElement('script')
            script.src = src
            script.async = true
            script.onload = () => {
                const lib = window.pdfjsLib
                if (lib) {
                    lib.GlobalWorkerOptions.workerSrc = workerSrc
                    resolve(lib)
                } else {
                    reject(new Error('No se pudo inicializar la librería de PDF.'))
                }
            }
            script.onerror = onFail || (() => reject(new Error('No fue posible cargar el lector de PDF.')))
            document.head.appendChild(script)
        }

        tryLoad(
            '/vendor/pdfjs/pdf.min.js',
            '/vendor/pdfjs/pdf.worker.min.js',
            () => tryLoad(
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
            )
        )
    })
}

// ─── Carga dinámica de Tesseract.js ──────────────────────────────────────────

async function loadTesseract(): Promise<any> {
    if (typeof window === 'undefined') throw new Error('Solo disponible en el navegador.')

    if (window.Tesseract) return window.Tesseract

    return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        // Tesseract.js CDN — usamos v4 que es estable y funciona bien con script tag
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js'
        script.async = true
        script.onload = () => {
            if (window.Tesseract) resolve(window.Tesseract)
            else reject(new Error('No se pudo cargar Tesseract.js'))
        }
        script.onerror = () => reject(new Error('No se pudo cargar el motor OCR.'))
        document.head.appendChild(script)
    })
}

// ─── Extracción de montos desde texto ────────────────────────────────────────

function parseAmountsFromText(text: string): number[] {
    const normalizedText = text.replace(/[\u00A0\u202F]/g, ' ')

    // Regex para capturar montos con 2 decimales (estándar bancario venezolano)
    // Soporta: 10.026,27 | 49635,00 | 1.533.739,27 | 10026.27 | 1,026.27
    const regex = /(?:^|[^\d/:\-])(?:Bs\.?|VES|USD|COP|CLP|PEN|\$)?\s*([+-]?(?:[1-9]\d{0,2}(?:\.\d{3})+,\d{2}|\d+,\d{2}|[1-9]\d{0,2}(?:,\d{3})+\.\d{2}|\d+\.\d{2}))\s*(?:Bs\.?|VES|USD|COP|CLP|PEN|\$)?(?=[^\d/:]|$)/gmi

    const amounts: number[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(normalizedText)) !== null) {
        const raw = match[1].replace('+', '').trim()

        // Excluir teléfonos o códigos con guion (ej. 0212-501)
        if (normalizedText.includes(raw + '-') || normalizedText.includes('-' + raw)) continue

        let numStr = raw
        if (numStr.includes(',') && numStr.includes('.')) {
            if (numStr.lastIndexOf(',') > numStr.lastIndexOf('.')) {
                numStr = numStr.replace(/\./g, '').replace(',', '.')
            } else {
                numStr = numStr.replace(/,/g, '')
            }
        } else if (numStr.includes(',')) {
            numStr = numStr.replace(',', '.')
        }

        const val = parseFloat(numStr)
        if (!isNaN(val) && Math.abs(val) > 0.001) {
            amounts.push(Math.round(Math.abs(val) * 100) / 100)
        }
    }

    return amounts
}

// ─── Render de página PDF a DataURL de imagen ────────────────────────────────

async function renderPageToDataUrl(page: any, scale = 2): Promise<string> {
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    return canvas.toDataURL('image/png')
}

// ─── Función principal exportada ─────────────────────────────────────────────

/**
 * Extrae todos los montos monetarios de un PDF bancario.
 * Intenta extracción de texto primero; si no encuentra montos, hace OCR página a página.
 * 
 * @param file El archivo PDF a procesar
 * @param onProgress Callback opcional para reportar progreso ("ocr", pageNum, totalPages)
 */
export async function extractAmountsFromBankPdf(
    file: File,
    onProgress?: (stage: 'text' | 'ocr', page: number, total: number) => void
): Promise<{ amounts: number[]; usedOcr: boolean }> {
    const pdfjsLib = await loadPdfJs()
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
    const pdfDoc = await loadingTask.promise

    // ── Estrategia 1: Extracción de texto ─────────────────────────────────────
    let fullText = ''
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        onProgress?.('text', pageNum, pdfDoc.numPages)
        const page = await pdfDoc.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
            .map((item: any) => item.str || '')
            .join(' ')
        fullText += pageText + '\n'
    }

    const textAmounts = parseAmountsFromText(fullText)

    if (textAmounts.length > 0) {
        return { amounts: textAmounts, usedOcr: false }
    }

    // ── Estrategia 2: OCR (Tesseract) si no se encontraron montos ──────────────
    const Tesseract = await loadTesseract()

    // Configurar worker de Tesseract para español (locale del banco)
    const worker = await Tesseract.createWorker('spa', 1, {
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/worker.min.js',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4/tesseract-core.wasm.js',
        logger: () => { /* silenciar logs */ }
    })

    let ocrFullText = ''

    try {
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            onProgress?.('ocr', pageNum, pdfDoc.numPages)
            const page = await pdfDoc.getPage(pageNum)
            const dataUrl = await renderPageToDataUrl(page, 2.5)
            const { data: { text } } = await worker.recognize(dataUrl)
            ocrFullText += text + '\n'
        }
    } finally {
        await worker.terminate()
    }

    const ocrAmounts = parseAmountsFromText(ocrFullText)
    return { amounts: ocrAmounts, usedOcr: true }
}
