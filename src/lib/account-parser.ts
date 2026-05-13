
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

    // Step 2: strip formatting separators between digits
    let prev = ""
    while (prev !== normalized) {
        prev = normalized
        normalized = normalized.replace(/(\d)[.\-](\d)/g, "$1$2")
    }

    // --- Detect phone number (Pago Móvil) ---
    const phoneMatch = normalized.match(/\b(04(?:12|14|16|22|24|26)\d{7})\b/)
    const phone = phoneMatch ? phoneMatch[1] : null

    // --- Detect cedula: 6-9 digit number NOT starting with 04xx or 01xx (bank codes) ---
    const cedulaMatch = normalized.match(/\b((?!04\d{2}|01\d{2})\d{6,9})\b/)
    const cedula = cedulaMatch ? cedulaMatch[1] : null

    // --- Detect 20-digit account number ---
    const accountMatch = normalized.match(/\b(\d{20})\b/)
    const accountNumber = accountMatch ? accountMatch[1] : null

    // --- Detect bank ---
    const BANK_TEXT_MAP: Array<[RegExp, string]> = [
        [/\b(bdv|banco\s*de\s*venezuela)\b/i,           "Banco de Venezuela (BDV)"],
        [/\b(bvc|venezolano\s*de\s*cr[eé]dito)\b/i,    "Banco Venezolano de Crédito (BVC)"],
        [/\bmercantil\b/i,                              "Banco Mercantil"],
        [/\b(provincial|bbva)\b/i,                      "Banco Provincial (BBVA)"],
        [/\bbancaribe\b/i,                              "Bancaribe"],
        [/\bexterior\b/i,                               "Banco Exterior"],
        [/\bcaroni\b/i,                                 "Banco Caroní"],
        [/\bbanesco\b/i,                                "Banesco Banco Universal"],
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
    let matchedBankText = ""

    if (!bankName) {
        for (const [pattern, name] of BANK_TEXT_MAP) {
            const m = normalized.match(pattern)
            if (m) {
                bankName = name
                matchedBankText = m[0]
                break
            }
        }
    }

    // --- Detect person name (alias) ---
    const KEYWORDS = /\b(c[eé]dula|tel[eé]fono|banco|cuenta|pago|m[oó]vil|venezuela|ves|c\.i\.?|ci|n[uú]mero|nro|titular|nombre)\b/gi
    let nameSource = normalized
    if (matchedBankText) nameSource = nameSource.replace(new RegExp(matchedBankText, "i"), "")
    const nameCandidate = nameSource
        .replace(/\b\d+\b/g, "")
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
