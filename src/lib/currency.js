/**
 * Fetches the current exchange rate from the API.
 * Uses frankfurter.app which is free and requires no API key.
 * 
 * @param {string} fromCurrency - The currency to convert from (e.g. 'USD')
 * @param {string} toCurrency - The currency to convert to (default 'TRY')
 * @returns {Promise<number>} - The exchange rate (e.g. 30.50)
 */
export const fetchExchangeRate = async (fromCurrency, toCurrency = 'TRY') => {
    if (fromCurrency === 'TL' || fromCurrency === 'TRY') return 1;

    try {
        // Simple caching mechanism in localStorage to avoid spamming the API
        // Cache valid for 1 hour
        const cacheKey = `rate_${fromCurrency}_${toCurrency}`;
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
            const { rate, timestamp } = JSON.parse(cached);
            const hour = 1000 * 60 * 60;
            if (Date.now() - timestamp < hour) {
                return rate;
            }
        }

        const response = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`);

        if (!response.ok) {
            throw new Error(`Exchange rate API error: ${response.statusText}`);
        }

        const data = await response.json();
        const rate = data.rates[toCurrency];

        // Update cache
        localStorage.setItem(cacheKey, JSON.stringify({
            rate,
            timestamp: Date.now()
        }));

        return rate;
    } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
        // Fallback or rethrow? 
        // For now, let's return null so the UI knows it failed
        return null;
    }
};

export const CURRENCY_SYMBOLS = {
    'TL': '₺',
    'USD': '$',
    'EUR': '€'
};
