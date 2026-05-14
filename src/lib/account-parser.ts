
export const VENEZUELA_BANKS: Record<string, string> = {
    "0102": "Banco de Venezuela (BDV)",
    "0104": "Banco Venezolano de Crédito (BVC)",
    "0105": "Banco Mercantil",
    "0108": "Banco Provincial (BBVA)",
    "0114": "Bancaribe",
    "0115": "Banco Exterior",
    "0128": "Banco Caroní",
    "0134": "Banesco Banco Universal",
    "0137": "Sofitasa",
    "0138": "Banco Plaza",
    "0146": "Bangente",
    "0151": "Banco Fondo Común (BFC)",
    "0156": "100% Banco",
    "0157": "Del Sur Banco Universal",
    "0163": "Banco del Tesoro",
    "0166": "Banco Agrícola de Venezuela",
    "0168": "Bancrecer",
    "0169": "Mi Banco",
    "0171": "Banco Activo",
    "0172": "Bancamiga",
    "0174": "Banplus",
    "0175": "Banco Bicentenario del Pueblo",
    "0177": "BANFANB",
    "0191": "Banco Nacional de Crédito (BNC)",
}

export function parseVenezuelanAccountText(text: string) {
    // Step 1: normalize whitespace
    let normalized = text.replace(/\s+/g, " ").trim()

    // Step 2: strip formatting separators between digits (dots and dashes are safe to join globally)
    let prev = ""
    while (prev !== normalized) {
        prev = normalized
        normalized = normalized.replace(/(\d)[.\-](\d)/g, "$1$2")
    }

    let detectionSource = normalized

    // --- Detect 20-digit account number (allowing internal spaces) ---
    // We look for 20 digits total. We only reject if immediately followed by another digit (part of a longer number)
    const accountMatch = detectionSource.match(/\b(\d(?:[ ]*\d){19})\b(?!\d)/)
    const accountNumber = accountMatch ? accountMatch[1].replace(/\s+/g, "") : null
    if (accountMatch) {
        detectionSource = detectionSource.replace(accountMatch[0], " ")
    }

    // --- Detect phone number (Pago Móvil) ---
    const phoneMatch = detectionSource.match(/\b(04(?:12|14|16|22|24|26)(?:[ ]*\d){7})\b(?!\d)/)
    const phone = phoneMatch ? phoneMatch[1].replace(/\s+/g, "") : null
    if (phoneMatch) {
        detectionSource = detectionSource.replace(phoneMatch[0], " ")
    }

    // --- Detect cedula / RIF ---
    const cedulaMatch = detectionSource.match(/\b(?:[VEJG][\-\s]*)?((?!04\d{2}|01\d{2})\d(?:[ ]*\d){5,8})\b(?!\d)/i)
    const cedula = cedulaMatch ? cedulaMatch[1].replace(/\s+/g, "") : null
    if (cedulaMatch) {
        detectionSource = detectionSource.replace(cedulaMatch[0], " ")
    }

    // --- Detect bank ---
    const BANK_TEXT_MAP: Array<[RegExp, string]> = [
        [/\b(bdv|banco\s*de\s*venezuela|venezuela)\b/i,           "Banco de Venezuela (BDV)"],
        [/\b(bvc|venezolano\s*de\s*cr[eé]dito)\b/i,    "Banco Venezolano de Crédito (BVC)"],
        [/\bmercantil\b/i,                              "Banco Mercantil"],
        [/\b(provincial|bbva)\b/i,                      "Banco Provincial (BBVA)"],
        [/\bbancaribe\b/i,                              "Bancaribe"],
        [/\bexterior\b/i,                               "Banco Exterior"],
        [/\bcaroni\b/i,                                 "Banco Caroní"],
        [/\bbanesco(\s+banco\s+universal)?\b/i,        "Banesco Banco Universal"],
        [/\bsofitasa\b/i,                               "Sofitasa"],
        [/\bplaza\b/i,                                  "Banco Plaza"],
        [/\bbangente\b/i,                               "Bangente"],
        [/\b(bfc|fondo\s*com[uú]n)\b/i,                "Banco Fondo Común (BFC)"],
        [/\b100\s*%?\s*banco\b/i,                       "100% Banco"],
        [/\bdel\s*sur\b/i,                              "Del Sur Banco Universal"],
        [/\btesoro\b/i,                                 "Banco del Tesoro"],
        [/\bagr[ií]cola\b/i,                            "Banco Agrícola de Venezuela"],
        [/\bbancrecer\b/i,                              "Bancrecer"],
        [/\bmi\s*banco\b/i,                             "Mi Banco"],
        [/\bactivo\b/i,                                 "Banco Activo"],
        [/\bbancamiga\b/i,                              "Bancamiga"],
        [/\bbanplus\b/i,                                "Banplus"],
        [/\bbicentenario\b/i,                           "Banco Bicentenario del Pueblo"],
        [/\bbanfanb\b/i,                                "BANFANB"],
        [/\b(bnc|nacional\s*de\s*cr[eé]dito)\b/i,      "Banco Nacional de Crédito (BNC)"],
    ]

    const bankCodeMatch = normalized.match(/\b(01\d{2})\b/)
    const explicitBankCode = bankCodeMatch ? bankCodeMatch[1] : null
    const accountBankCode = accountNumber ? accountNumber.substring(0, 4) : null
    const resolvedBankCode = explicitBankCode || accountBankCode
    let bankName: string | null = resolvedBankCode ? (VENEZUELA_BANKS[resolvedBankCode] || null) : null

    if (!bankName) {
        for (const [pattern, name] of BANK_TEXT_MAP) {
            const m = normalized.match(pattern)
            if (m) {
                bankName = name
                break
            }
        }
    }

    // --- Detect person name (alias) ---
    // Expanded keywords to include common bank names and account types to clean the alias
    const KEYWORDS = /\b(c[eé]dula|tel[eé]fono|banco|cuenta|pago|m[oó]vil|venezuela|ves|c\.i\.?|ci|n[uú]mero|nro|titular|nombre|rif|beneficiario|datos|cliente|alias|universal|corriente|ahorro|ahorros|bol[ií]vares|bs|banesco|mercantil|provincial|bbva|bdv|bnc|bancaribe|exterior|activo|bancamiga|tesoro|bicentenario)\b/gi
    let nameSource = detectionSource
    const nameCandidate = nameSource
        .replace(/\b[VEJG]?[\-\s]*\d+\b/gi, "") // Remove any remaining numbers
        .replace(KEYWORDS, "")
        .replace(/[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()

    const nameParts = nameCandidate.split(" ").filter(w => w.length >= 2)
    const alias = nameParts.length >= 2 ? nameParts.join(" ") : null

    if (!phone && !cedula && !bankName && !accountNumber && !alias) return null

    const isMobile = !!phone

    return {
        alias: alias || "",
        bank_name: bankName || "",
        account_number: isMobile ? (phone || "") : (accountNumber || ""),
        details: {
            id_number: cedula || "",
            venezuela_type: isMobile ? "Pago Móvil" : "Cuenta",
        }
    }
}
