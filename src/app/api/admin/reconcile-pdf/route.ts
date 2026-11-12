import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json(
                { error: 'No se ha proporcionado ningún archivo PDF' },
                { status: 400 }
            )
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Parse PDF content
        const parser = new PDFParse({ data: buffer })
        const textResult = await parser.getText()
        const rawText = (textResult.text || '').replace(/[\u00A0\u202F]/g, ' ')

        // Extract monetary amounts with standard Latin American / Venezuelan banking formats
        // Matches amounts with 2 decimals e.g.:
        // 10.026,27 | 10026,27 | 10,026.27 | 10026.27 | 1.533.739,27 | Bs. 49.635,00
        const regex = /(?:^|[^\d/:\-])(?:Bs\.?|VES|USD|COP|CLP|PEN|\$)?\s*([+-]?(?:[1-9]\d{0,2}(?:\.\d{3})+,\d{2}|\d+,\d{2}|[1-9]\d{0,2}(?:,\d{3})+\.\d{2}|\d+\.\d{2}))\s*(?:Bs\.?|VES|USD|COP|CLP|PEN|\$)?(?=[^\d/:]|$)/gmi

        const amounts: number[] = []
        let match: RegExpExecArray | null

        while ((match = regex.exec(rawText)) !== null) {
            const raw = match[1].replace('+', '').trim()

            // Exclude phone numbers or hyphenated codes e.g. 0212-501 or similar
            if (rawText.includes(raw + '-') || rawText.includes('-' + raw)) {
                continue
            }

            let numStr = raw
            if (numStr.includes(',') && numStr.includes('.')) {
                if (numStr.lastIndexOf(',') > numStr.lastIndexOf('.')) {
                    // 10.026,27
                    numStr = numStr.replace(/\./g, '').replace(',', '.')
                } else {
                    // 10,026.27
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

        return NextResponse.json({
            success: true,
            totalFound: amounts.length,
            amounts,
            filename: file.name
        })
    } catch (error: any) {
        console.error('Error procesando PDF bancario:', error)
        return NextResponse.json(
            { error: error.message || 'Error al procesar el archivo PDF' },
            { status: 500 }
        )
    }
}
