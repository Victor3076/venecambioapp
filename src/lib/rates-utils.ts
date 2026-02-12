export const pairConfig: Record<string, { decimals: number, isInverse?: boolean }> = {
    // PERU SOURCE
    PERU_VES: { decimals: 2 },
    PERU_CHILE: { decimals: 0 },
    PERU_COLOMBIA: { decimals: 0 },
    PERU_USA: { decimals: 2, isInverse: true },

    // CHILE SOURCE
    CHILE_VES: { decimals: 4 },
    CHILE_COLOMBIA: { decimals: 2 },
    CHILE_PERU: { decimals: 4 },
    CHILE_USA: { decimals: 0, isInverse: true },

    // COLOMBIA SOURCE
    COLOMBIA_VES: { decimals: 2, isInverse: true }, // Special Case: COP per VES
    COLOMBIA_CHILE: { decimals: 2 },
    COLOMBIA_PERU: { decimals: 5 },
    COLOMBIA_USA: { decimals: 0, isInverse: true },

    // USA SOURCE
    USA_VES: { decimals: 2 },
    USA_COLOMBIA: { decimals: 0 },
    USA_PERU: { decimals: 2 },
    USA_CHILE: { decimals: 0 },
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

    return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: config.decimals,
        maximumFractionDigits: config.decimals
    }).format(value);
}

// Helper to get the correct decimal precision for a currency pair
export const getRateDecimals = (targetCode: string, sourceCode: string): number => {
    const pairKey = `${sourceCode}_${targetCode}`;
    const config = pairConfig[pairKey] || { decimals: 2 };
    return config.decimals;
}
