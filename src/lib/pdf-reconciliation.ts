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

/**
 * Extrae todos los montos de transacciones bancarias presentes en el PDF.
 */
export async function extractAmountsFromBankPdf(file: File): Promise<number[]> {
    const pdfjsLib = await loadPdfJs()
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
    const pdfDoc = await loadingTask.promise

    let fullText = ""
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
            .map((item: any) => item.str || "")
            .join(" ")
        fullText += pageText + "\n"
    }

    const normalizedText = fullText.replace(/[\u00A0\u202F]/g, ' ')

    // Regex para capturar montos con 2 decimales (estándar bancario)
    // Soporta formatos venezolanos (1.533.739,27 / 49.635,00) e internacionales (1,533,739.27 / 49635.00)
    const regex = /(?:^|[^\d/:\-])(?:Bs\.?|VES|USD|COP|CLP|PEN|\$)?\s*([+-]?(?:[1-9]\d{0,2}(?:\.\d{3})+,\d{2}|\d+,\d{2}|[1-9]\d{0,2}(?:,\d{3})+\.\d{2}|\d+\.\d{2}))\s*(?:Bs\.?|VES|USD|COP|CLP|PEN|\$)?(?=[^\d/:]|$)/gmi

    const amounts: number[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(normalizedText)) !== null) {
        const raw = match[1].replace('+', '').trim()

        // Excluir teléfonos o códigos con guion (ej. 0212-501)
        if (normalizedText.includes(raw + '-') || normalizedText.includes('-' + raw)) {
            continue
        }

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
