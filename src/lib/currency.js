// Manuel döviz kuru yönetimi (Kullanıcı tarafından belirlenir)
export const DEFAULT_RATES = {
    'USD': 38.50,
    'EUR': 41.50,
    'TL': 1,
    'TRY': 1
};

export const getManualRates = () => {
    try {
        const stored = localStorage.getItem('manual_exchange_rates');
        if (stored) {
            return { ...DEFAULT_RATES, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error('Error loading manual rates:', e);
    }
    return { ...DEFAULT_RATES };
};

export const saveManualRates = (rates) => {
    try {
        localStorage.setItem('manual_exchange_rates', JSON.stringify(rates));
    } catch (e) {
        console.error('Error saving manual rates:', e);
    }
};

/**
 * Kullanıcının belirlediği manuel döviz kurunu döner.
 * İnternet bağımlılığı olmadan kullanıcının girdiği kuru esas alır.
 */
export const fetchExchangeRate = async (fromCurrency) => {
    if (fromCurrency === 'TL' || fromCurrency === 'TRY') return 1;
    const rates = getManualRates();
    return rates[fromCurrency] || DEFAULT_RATES[fromCurrency] || 1;
};

export const CURRENCY_SYMBOLS = {
    'TL': '₺',
    'USD': '$',
    'EUR': '€'
};
