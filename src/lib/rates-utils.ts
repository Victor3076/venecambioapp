export const pairConfig: Record<string, { decimals: number, isInverse?: boolean }> = {
    // PEN SOURCE
    PEN_VES: { decimals: 2 },
    PEN_CLP: { decimals: 0 },
    PEN_COP: { decimals: 0 },
    PEN_USD: { decimals: 2, isInverse: true },

    // CLP SOURCE
    CLP_VES: { decimals: 4 },
    CLP_COP: { decimals: 2 },
    CLP_PEN: { decimals: 4 },
    CLP_USD: { decimals: 0, isInverse: true },

    // COP SOURCE
    COP_VES: { decimals: 2, isInverse: true }, // Special Case: COP per VES
    COP_CLP: { decimals: 2 },
    COP_PEN: { decimals: 5 },
    COP_USD: { decimals: 0, isInverse: true },

    // USD SOURCE
    USD_VES: { decimals: 2 },
    USD_COP: { decimals: 0 },
    USD_PEN: { decimals: 2 },
    USD_CLP: { decimals: 0 },
}

export const calculateRate = (targetCode: string, sourceCode: string, toPrice: number, fromPrice: number, marginPercentage: number = 0) => {
    if (!fromPrice || !toPrice) return 0; // Return number, format later

    const pairKey = `${sourceCode}_${targetCode}`;
    const config = pairConfig[pairKey] || { decimals: 2, isInverse: false };

    let rate;
    if (config.isInverse) {
        // Inverse: Price_Source / Price_Target
        rate = fromPrice / toPrice;
    } else {
        // Normal: Price_Target / Price_Source
        rate = toPrice / fromPrice;
    }

    let adjustedRate;
    if (config.isInverse) {
        // For Inverse (Cost/Value): Rate * (1 + margin)
        // e.g. COP/VES: 3900 / 545 = 7.15 * 1.07 = 7.65
        adjustedRate = rate * (1 + marginPercentage / 100);
    } else {
        // For Normal (Yield): Rate * (1 - margin)
        // e.g. PEN/VES: 3.75 / 545 = oops wrong direction. 
        // Logic: 1 PEN = (Price_PEN / Price_VES) VES?
        // Wait, Normal logic in Admin was: toPrice / fromPrice.
        // 1 Source = (USDT_Source / USDT_Target) Target ? NO.
        // 1 USDT = 3.75 PEN. 1 USDT = 38.5 VES.
        // 1 PEN = (38.5 / 3.75) VES.
        // toPrice (Target) / fromPrice (Source). Correct.

        // Margin: User gets LESS VES for their PEN.
        // Rate * (1 - margin).
        adjustedRate = rate * (1 - marginPercentage / 100);
    }

    return adjustedRate;
}

export const formatRate = (value: number, targetCode: string, sourceCode: string) => {
    const pairKey = `${sourceCode}_${targetCode}`;
    const config = pairConfig[pairKey] || { decimals: 2 };

    // Exchange rates should use the full precision defined in pairConfig
    const displayDecimals = config.decimals;

    return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: displayDecimals,
        maximumFractionDigits: displayDecimals
    }).format(value);
}

// Formats a number with thousand separators and specific decimals based on currency
export const formatCurrency = (value: number | string, currencyCode?: string) => {
    const num = typeof value === 'string' ? parseFloat(value) || 0 : value;

    let decimals = 2; // Default for PEN, USD, VES
    if (currencyCode === 'CLP') {
        decimals = 0;
    } else if (currencyCode === 'COP') {
        decimals = 0;
    }

    return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}

// Parses a formatted string (e.g. "1.234,56") back to a float
export const parseFormattedNumber = (value: string): number => {
    if (!value) return 0;
    // Remove dots (thousands) and replace comma with dot (decimal)
    const clean = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
}

// Helper to get the correct decimal precision for a currency pair
export const getRateDecimals = (targetCode: string, sourceCode: string): number => {
    const pairKey = `${sourceCode}_${targetCode}`;
    const config = pairConfig[pairKey] || { decimals: 2 };
    return config.decimals;
}

export const isInversePair = (targetCode: string, sourceCode: string): boolean => {
    const pairKey = `${sourceCode}_${targetCode}`;
    return !!pairConfig[pairKey]?.isInverse;
}

export const normalizeCurrency = (code: string): string => {
    const mapping: Record<string, string> = {
        'VENEZUELA': 'VES',
        'PERU': 'PEN',
        'CHILE': 'CLP',
        'COLOMBIA': 'COP',
        'USA': 'USD',
        'ZELLE': 'USD'
    }
    return mapping[code.toUpperCase()] || code.toUpperCase()
}
