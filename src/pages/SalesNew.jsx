import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, ShoppingCart, DollarSign, Warehouse, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { getManualRates, saveManualRates, CURRENCY_SYMBOLS } from '../lib/currency';

const SalesNew = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Data Options
    const [customers, setCustomers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);

    // Form State
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [defaultSaleType, setDefaultSaleType] = useState('retail'); // 'retail' or 'wholesale'
    const [paymentMethod, setPaymentMethod] = useState('nakit'); // 'nakit', 'kredi_karti', 'havale', 'veresiye'

    // Manuel Döviz Kurları (Kullanıcı tarafından anlık düzenlenebilir)
    const [rates, setRates] = useState(() => getManualRates());

    // Ürün kartlarında anlık düzenlenebilir fiyatlar { [productId]: { retail: number, wholesale: number } }
    const [customPrices, setCustomPrices] = useState({});

    // Depodaki anlık stok miktarları { [productId]: quantity }
    const [stockMap, setStockMap] = useState({});

    // Product Search & Cart
    // cart item: { cartKey, product, priceType: 'retail'|'wholesale', quantity, unit_price (TL), original_currency, original_price, exchange_rate }
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState([]);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    // Seçili depo değiştikçe o depoya ait stokları anında getir
    useEffect(() => {
        if (selectedWarehouseId) {
            fetchStocks(selectedWarehouseId);
        } else {
            setStockMap({});
        }
    }, [selectedWarehouseId]);

    const fetchStocks = async (warehouseId) => {
        const { data: stocks, error } = await supabase
            .from('stock_levels')
            .select('product_id, quantity')
            .eq('warehouse_id', warehouseId);

        if (!error && stocks) {
            const map = {};
            stocks.forEach(s => {
                map[s.product_id] = s.quantity;
            });
            setStockMap(map);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        const [c, l, w, p] = await Promise.all([
            supabase.from('customers').select('id, name'),
            supabase.from('sales_locations').select('id, name'),
            supabase.from('warehouses').select('id, name'),
            supabase.from('products').select('id, name, unit_price, wholesale_price, sku_or_barcode, currency')
        ]);

        const prodList = p.data || [];
        setCustomers(c.data || []);
        setLocations(l.data || []);
        setWarehouses(w.data || []);
        setProducts(prodList);

        // Başlangıç fiyatlarını doldur
        const initialPrices = {};
        prodList.forEach(prod => {
            initialPrices[prod.id] = {
                retail: Number(prod.unit_price) || 0,
                wholesale: Number(prod.wholesale_price) || Number(prod.unit_price) || 0
            };
        });
        setCustomPrices(initialPrices);

        if (l.data?.[0]) setSelectedLocationId(l.data[0].id);
        if (w.data?.[0]) {
            setSelectedWarehouseId(w.data[0].id);
            fetchStocks(w.data[0].id);
        }
        setLoading(false);
    };

    // Kur değiştiğinde kaydet ve sepetteki ilgili dövizli ürünlerin TL fiyatlarını güncelle
    const handleRateChange = (currency, val) => {
        const numVal = parseFloat(val) || 0;
        const newRates = { ...rates, [currency]: numVal };
        setRates(newRates);
        saveManualRates(newRates);

        // Sepetteki dövizli ürünleri otomatik yeniden hesapla
        setCart(prevCart => prevCart.map(item => {
            if (item.original_currency === currency) {
                const finalPriceTL = item.original_price * numVal;
                return {
                    ...item,
                    exchange_rate: numVal,
                    unit_price: finalPriceTL
                };
            }
            return item;
        }));
    };

    // Ürün kartındaki fiyat kutusunu değiştirme
    const handleCardPriceChange = (productId, type, val) => {
        setCustomPrices(prev => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                [type]: val
            }
        }));
    };

    // Sepete Ürün Ekleme (STOK KONTROLLÜ)
    const addToCart = (product, specificType = null) => {
        if (!selectedWarehouseId) {
            return toast.error('Lütfen önce sağ taraftan stoktan düşülecek depoyu seçin!');
        }

        const availableStock = stockMap[product.id] !== undefined ? stockMap[product.id] : 0;

        if (availableStock <= 0) {
            return toast.error(`"${product.name}" için seçili depoda hiç stok yok! (Mevcut: 0)`, { id: 'no-stock-toast' });
        }

        const priceType = specificType || defaultSaleType;
        const cartKey = `${product.id}_${priceType}`;

        // Bu üründen sepetteki toplam miktar (Perakende + Toptan toplamı)
        const totalInCart = cart
            .filter(item => item.product.id === product.id)
            .reduce((sum, item) => sum + item.quantity, 0);

        if (totalInCart >= availableStock) {
            return toast.error(`Maksimum stok miktarına ulaşıldı! "${product.name}" için depodaki mevcut stok: ${availableStock} adet.`, { id: 'max-stock-toast' });
        }

        const currency = product.currency || 'TL';
        const cardPrice = customPrices[product.id]?.[priceType];
        const originalPrice = (cardPrice !== undefined && cardPrice !== '')
            ? Number(cardPrice)
            : (priceType === 'retail' ? Number(product.unit_price) || 0 : Number(product.wholesale_price) || Number(product.unit_price) || 0);

        let rate = 1;
        if (currency !== 'TL') {
            rate = rates[currency] || (currency === 'USD' ? 38.50 : 41.50);
        }

        const finalPriceTL = currency === 'TL' ? originalPrice : (originalPrice * rate);

        const existing = cart.find(item => item.cartKey === cartKey);

        if (existing) {
            setCart(cart.map(item =>
                item.cartKey === cartKey
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
            toast.success(`"${product.name}" miktarı artırıldı (${totalInCart + 1} / ${availableStock})`);
            return;
        }

        setCart([...cart, {
            cartKey,
            product,
            priceType,
            quantity: 1,
            unit_price: finalPriceTL, // TL karşılığı
            original_currency: currency,
            original_price: originalPrice, // Orijinal para birimindeki fiyat (örn 1.8 USD)
            exchange_rate: rate
        }]);

        toast.success(`"${product.name}" eklendi (Kalan Stok: ${availableStock - totalInCart - 1})`);
    };

    // Sepetteki satırın fiyat tipini değiştir (Perakende <-> Toptan)
    const toggleItemPriceType = (cartKey) => {
        setCart(cart.map(item => {
            if (item.cartKey !== cartKey) return item;

            const newType = item.priceType === 'retail' ? 'wholesale' : 'retail';
            const cardPrice = customPrices[item.product.id]?.[newType];
            const originalPrice = (cardPrice !== undefined && cardPrice !== '')
                ? Number(cardPrice)
                : (newType === 'retail'
                    ? (Number(item.product.unit_price) || 0)
                    : (Number(item.product.wholesale_price) || Number(item.product.unit_price) || 0));

            const finalPriceTL = item.original_currency === 'TL'
                ? originalPrice
                : (originalPrice * item.exchange_rate);

            return {
                ...item,
                cartKey: `${item.product.id}_${newType}`,
                priceType: newType,
                original_price: originalPrice,
                unit_price: finalPriceTL
            };
        }));
    };

    // Sepetteki ürünün orijinal birim fiyatını (TL, USD veya EUR) doğrudan düzenleme
    const updateItemOriginalPrice = (cartKey, newPrice) => {
        const val = parseFloat(newPrice);
        const originalPrice = isNaN(val) ? 0 : val;

        setCart(cart.map(item => {
            if (item.cartKey !== cartKey) return item;

            const finalPriceTL = item.original_currency === 'TL'
                ? originalPrice
                : (originalPrice * item.exchange_rate);

            return {
                ...item,
                original_price: originalPrice,
                unit_price: finalPriceTL
            };
        }));
    };

    const removeFromCart = (cartKey) => {
        setCart(cart.filter(item => item.cartKey !== cartKey));
    };

    // Sepet Miktarı Değiştirme (STOK AŞIM KORUMALI)
    const updateQuantity = (cartKey, qty) => {
        const val = parseInt(qty);
        if (isNaN(val) || val < 1) return;

        const targetItem = cart.find(i => i.cartKey === cartKey);
        if (!targetItem) return;

        const availableStock = stockMap[targetItem.product.id] !== undefined ? stockMap[targetItem.product.id] : 0;

        // Diğer satırlardaki aynı ürün miktarı (örn bir satır perakende, diğeri toptan)
        const otherQtyInCart = cart
            .filter(i => i.product.id === targetItem.product.id && i.cartKey !== cartKey)
            .reduce((sum, i) => sum + i.quantity, 0);

        const maxAllowed = Math.max(0, availableStock - otherQtyInCart);

        if (val > maxAllowed) {
            toast.error(`Maksimum stok aşılamaz! "${targetItem.product.name}" için mevcut depo stoğu: ${availableStock} adet.`);
            setCart(cart.map(item =>
                item.cartKey === cartKey ? { ...item, quantity: Math.max(1, maxAllowed) } : item
            ));
            return;
        }

        setCart(cart.map(item =>
            item.cartKey === cartKey ? { ...item, quantity: val } : item
        ));
    };

    const calculateTotal = () => {
        return cart.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return toast.error('Sepet boş!');
        if (!selectedLocationId) return toast.error('Lütfen satış lokasyonu seçin.');
        if (!selectedWarehouseId) return toast.error('Lütfen stoktan düşülecek depoyu seçin.');
        if (paymentMethod === 'veresiye' && !selectedCustomerId) {
            return toast.error('Veresiye (alacak) satışı yapabilmek için lütfen bir müşteri seçin!');
        }

        setSubmitting(true);
        const toastId = toast.loading('Stok kontrol ediliyor...');

        // 1. Kümülatif Stok Kontrolü
        try {
            const aggregatedQuantities = {};
            for (const item of cart) {
                aggregatedQuantities[item.product.id] = (aggregatedQuantities[item.product.id] || 0) + item.quantity;
            }

            for (const [productId, totalQty] of Object.entries(aggregatedQuantities)) {
                const { data: stockData } = await supabase
                    .from('stock_levels')
                    .select('quantity')
                    .eq('product_id', productId)
                    .eq('warehouse_id', selectedWarehouseId)
                    .maybeSingle();

                const currentStock = stockData?.quantity || 0;

                if (currentStock < totalQty) {
                    const prodName = cart.find(i => i.product.id === productId)?.product.name || 'Ürün';
                    throw new Error(`"${prodName}" için yetersiz stok! (Mevcut Depo: ${currentStock}, Sepetteki Toplam Satış: ${totalQty})`);
                }
            }
        } catch (err) {
            toast.dismiss(toastId);
            toast.error(err.message, { duration: 5000 });
            setSubmitting(false);
            return;
        }

        toast.loading('Satış kaydediliyor...', { id: toastId });

        // 2. Satışı Oluştur
        const payloadItems = cart.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            original_currency: item.original_currency || 'TL',
            original_price: item.original_price,
            exchange_rate: item.exchange_rate,
            price_type: item.priceType
        }));

        const paymentStatus = paymentMethod === 'veresiye' ? 'unpaid' : 'paid';

        // 1. Yeni imza ile çağırmayı dene
        let saleRes = await supabase.rpc('handle_new_sale', {
            p_customer_id: selectedCustomerId || null,
            p_sales_location_id: selectedLocationId,
            p_warehouse_id: selectedWarehouseId,
            p_items: payloadItems,
            p_payment_method: paymentMethod,
            p_payment_status: paymentStatus
        });

        // Eğer veritabanı fonksiyonu henüz güncellenmediyse eski imza ile fallback yap
        if (saleRes.error) {
            saleRes = await supabase.rpc('handle_new_sale', {
                p_customer_id: selectedCustomerId || null,
                p_sales_location_id: selectedLocationId,
                p_warehouse_id: selectedWarehouseId,
                p_items: payloadItems
            });
        }

        toast.dismiss(toastId);

        if (saleRes.error) {
            toast.error('Satış işlemi başarısız: ' + saleRes.error.message);
        } else {
            const saleId = saleRes.data?.id;

            // Tablo kolonları mevcutsa doğrudan güncelle
            if (saleId) {
                try {
                    await supabase.from('sales').update({
                        payment_method: paymentMethod,
                        payment_status: paymentStatus,
                        paid_at: paymentStatus === 'paid' ? new Date().toISOString() : null
                    }).eq('id', saleId);
                } catch (e) {
                    console.log('Payment method update note:', e);
                }
            }

            toast.success(paymentMethod === 'veresiye' ? 'Veresiye satış kaydedildi!' : 'Satış başarıyla tamamlandı!');
            setCart([]);
            if (saleId) {
                navigate(`/sales/${saleId}?print=true`);
            } else {
                navigate('/sales');
            }
        }
        setSubmitting(false);
    };

    // Döviz toplamlarını hesapla
    const getAggregatedTotals = () => {
        const totals = {};
        let hasForeign = false;

        cart.forEach(item => {
            const currency = item.original_currency || 'TL';
            if (currency !== 'TL') {
                if (!totals[currency]) totals[currency] = 0;
                totals[currency] += (item.original_price || item.unit_price) * item.quantity;
                hasForeign = true;
            }
        });

        if (!hasForeign) return null;

        return Object.entries(totals).map(([curr, amount]) => (
            <div key={curr} className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block mb-1">
                Döviz Toplamı: {amount.toFixed(2)} {CURRENCY_SYMBOLS[curr]}
            </div>
        ));
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku_or_barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeWarehouseName = warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Seçilmedi';

    if (loading) return <div className="p-8 text-center text-slate-500">Yükleniyor...</div>;

    return (
        <div className="space-y-4">
            {/* Üst Bar: Güncel Döviz Kurları (Elle Değiştirilebilir) */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 sm:p-4 rounded-xl shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold tracking-wide">GÜNCEL DÖVİZ KURLARI (MANUEL)</h2>
                        <p className="text-xs text-slate-400">Kendi kurunuzu yazın; satışta fiyatlar anında güncellenir.</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                        <span className="text-xs font-bold text-emerald-400">USD ($) Kuru:</span>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-20 bg-white text-slate-900 font-bold px-2 py-0.5 rounded text-sm outline-none text-right"
                            value={rates.USD || ''}
                            onChange={(e) => handleRateChange('USD', e.target.value)}
                        />
                        <span className="text-xs text-slate-300 font-medium">₺</span>
                    </div>

                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                        <span className="text-xs font-bold text-sky-400">EUR (€) Kuru:</span>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-20 bg-white text-slate-900 font-bold px-2 py-0.5 rounded text-sm outline-none text-right"
                            value={rates.EUR || ''}
                            onChange={(e) => handleRateChange('EUR', e.target.value)}
                        />
                        <span className="text-xs text-slate-300 font-medium">₺</span>
                    </div>
                </div>
            </div>

            {/* Mobil Ekranlar İçin Yüzen Sepet Butonu */}
            {cart.length > 0 && (
                <div className="lg:hidden fixed bottom-16 left-3 right-3 z-30 animate-in slide-in-from-bottom duration-200">
                    <button
                        type="button"
                        onClick={() => {
                            document.getElementById('cart-section')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full bg-slate-950/95 backdrop-blur-md hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-2xl shadow-2xl flex items-center justify-between transition-all active:scale-98 border border-slate-700 cursor-pointer"
                    >
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <span className="bg-indigo-600 text-white px-2.5 py-0.5 rounded-full text-xs font-black">
                                {cart.reduce((s, i) => s + i.quantity, 0)} Adet
                            </span>
                            <span>Sepete Git & Satışı Tamamla</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-extrabold text-emerald-400 text-sm">
                            <span>{formatCurrency(calculateTotal())}</span>
                            <span>↓</span>
                        </div>
                    </button>
                </div>
            )}

            {/* Ana Alan: Sol Ürün Seçici / Sağ Sepet */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 lg:h-[calc(100vh-160px)]">
                {/* Sol: Ürün Listesi */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                            {/* Hızlı Ekleme Modu & Aktif Depo Göstergesi */}
                            <div className="flex flex-wrap items-center gap-2 text-sm w-full sm:w-auto">
                                <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100 text-xs font-bold">
                                    <Warehouse size={14} />
                                    <span>Aktif Depo: {activeWarehouseName}</span>
                                </div>

                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                                    <span className="font-semibold text-slate-500 px-1.5">Mod:</span>
                                    <button
                                        type="button"
                                        onClick={() => setDefaultSaleType('retail')}
                                        className={`px-2.5 py-1 rounded font-bold transition-all ${defaultSaleType === 'retail' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Perakende
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDefaultSaleType('wholesale')}
                                        className={`px-2.5 py-1 rounded font-bold transition-all ${defaultSaleType === 'wholesale' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Toptan
                                    </button>
                                </div>
                            </div>

                            <div className="relative flex-1 w-full sm:w-auto">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Ürün Ara (İsim, Barkod)..."
                                    className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Ürün Kartları Grid */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                            {filteredProducts.map(product => {
                                const currency = product.currency || 'TL';
                                const currencySymbol = CURRENCY_SYMBOLS[currency] || '₺';

                                const currentRetail = customPrices[product.id]?.retail ?? (product.unit_price || 0);
                                const currentWholesale = customPrices[product.id]?.wholesale ?? (product.wholesale_price || product.unit_price || 0);

                                // Stok Miktarı Hesaplamaları
                                const availableStock = stockMap[product.id] !== undefined ? stockMap[product.id] : 0;
                                const inCartCount = cart
                                    .filter(item => item.product.id === product.id)
                                    .reduce((sum, item) => sum + item.quantity, 0);

                                const remainingStock = Math.max(0, availableStock - inCartCount);
                                const isOutOfStock = availableStock <= 0;
                                const isMaxInCart = inCartCount >= availableStock && availableStock > 0;

                                return (
                                    <div
                                        key={product.id}
                                        className={`border rounded-xl p-3.5 bg-white transition-all flex flex-col justify-between ${
                                            isOutOfStock
                                                ? 'border-red-200 bg-red-50/20'
                                                : isMaxInCart
                                                ? 'border-amber-200 bg-amber-50/20'
                                                : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
                                        }`}
                                    >
                                        <div>
                                            {/* Üst Kısım: Başlık & Stok Rozeti */}
                                            <div className="flex justify-between items-start gap-1 mb-1">
                                                <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{product.name}</h4>
                                                {currency !== 'TL' && (
                                                    <span className="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.5 rounded font-extrabold whitespace-nowrap">
                                                        {currency} (x{rates[currency]})
                                                    </span>
                                                )}
                                            </div>

                                            {/* STOK MİKTARI ROZETİ */}
                                            <div className="flex justify-between items-center mb-2">
                                                {isOutOfStock ? (
                                                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-md">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                                                        Stok: 0 (Tükendi)
                                                    </span>
                                                ) : (
                                                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                                                        remainingStock <= 2 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${remainingStock <= 2 ? 'bg-amber-600' : 'bg-emerald-600'}`}></span>
                                                        Stok: {availableStock} Adet
                                                        {inCartCount > 0 && (
                                                            <span className="font-normal text-[11px] text-slate-600 ml-1">
                                                                ({inCartCount} sepette)
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                                <span className="text-[11px] text-slate-400 font-mono">{product.sku_or_barcode || 'Barkodsuz'}</span>
                                            </div>

                                            {/* Doğrudan Düzenlenebilir Fiyat Alanları (Adamına göre fiyat yazılabilir) */}
                                            <div className="space-y-1.5 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <div className="flex items-center justify-between gap-1 text-xs">
                                                    <span className="text-slate-600 font-semibold">Perakende:</span>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            className="w-20 px-1.5 py-0.5 border border-slate-300 rounded text-right font-bold text-blue-700 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                            value={currentRetail}
                                                            onChange={(e) => handleCardPriceChange(product.id, 'retail', e.target.value)}
                                                            placeholder="0"
                                                        />
                                                        <span className="font-semibold text-slate-600">{currencySymbol}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-1 text-xs">
                                                    <span className="text-slate-600 font-semibold">Toptan:</span>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            className="w-20 px-1.5 py-0.5 border border-slate-300 rounded text-right font-bold text-orange-700 bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                                                            value={currentWholesale}
                                                            onChange={(e) => handleCardPriceChange(product.id, 'wholesale', e.target.value)}
                                                            placeholder="0"
                                                        />
                                                        <span className="font-semibold text-slate-600">{currencySymbol}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Ekleme Butonları (Stok Yok veya Dolu ise Korumalı) */}
                                        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                disabled={isOutOfStock || isMaxInCart}
                                                onClick={() => addToCart(product, 'retail')}
                                                className={`text-xs font-bold py-1.5 px-2 rounded-lg transition-all text-center ${
                                                    isOutOfStock
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                                        : isMaxInCart
                                                        ? 'bg-amber-100 text-amber-700 cursor-not-allowed border border-amber-200'
                                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer'
                                                }`}
                                            >
                                                {isOutOfStock ? 'Stok Yok' : isMaxInCart ? 'Maks Stok' : '+ Perakende'}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isOutOfStock || isMaxInCart}
                                                onClick={() => addToCart(product, 'wholesale')}
                                                className={`text-xs font-bold py-1.5 px-2 rounded-lg transition-all text-center ${
                                                    isOutOfStock
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                                        : isMaxInCart
                                                        ? 'bg-amber-100 text-amber-700 cursor-not-allowed border border-amber-200'
                                                        : 'bg-orange-600 hover:bg-orange-700 text-white shadow-sm cursor-pointer'
                                                }`}
                                            >
                                                {isOutOfStock ? 'Stok Yok' : isMaxInCart ? 'Maks Stok' : '+ Toptan'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Sağ: Sepet ve Ödeme */}
                <div id="cart-section" className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden scroll-mt-20">
                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h2 className="font-bold text-base text-slate-800 flex items-center gap-2">
                            <ShoppingCart size={18} /> Satış Sepeti
                        </h2>
                        {cart.length > 0 && (
                            <button
                                onClick={() => setCart([])}
                                className="text-xs text-red-500 hover:text-red-700 font-medium cursor-pointer"
                            >
                                Sepeti Temizle
                            </button>
                        )}
                    </div>

                    <div className="p-3 space-y-2 border-b border-slate-100 text-xs">
                        <div>
                            <label className="block font-semibold text-slate-500 uppercase mb-1">Müşteri</label>
                            <select
                                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                                value={selectedCustomerId}
                                onChange={(e) => setSelectedCustomerId(e.target.value)}
                            >
                                <option value="">Misafir Müşteri</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block font-semibold text-slate-500 uppercase mb-1">Satış Kanalı</label>
                                <select
                                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                                    value={selectedLocationId}
                                    onChange={(e) => setSelectedLocationId(e.target.value)}
                                >
                                    <option value="">Seçiniz...</option>
                                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block font-semibold text-slate-500 uppercase mb-1">Düşülecek Depo</label>
                                <select
                                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-indigo-700"
                                    value={selectedWarehouseId}
                                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                                >
                                    <option value="">Depo Seçiniz...</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* ÖDEME YÖNTEMİ SEÇİCİ */}
                        <div className="pt-2 border-t border-slate-100">
                            <label className="block font-semibold text-slate-500 uppercase mb-1.5">Ödeme Türü</label>
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('nakit')}
                                    className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                                        paymentMethod === 'nakit'
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <span>💵</span> Nakit
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('kredi_karti')}
                                    className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                                        paymentMethod === 'kredi_karti'
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <span>💳</span> Kredi Kartı
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('havale')}
                                    className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                                        paymentMethod === 'havale'
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <span>🏦</span> Havale / EFT
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('veresiye')}
                                    className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                                        paymentMethod === 'veresiye'
                                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <span>⏳</span> Veresiye (Alacak)
                                </button>
                            </div>
                            {paymentMethod === 'veresiye' && (
                                <div className="mt-1.5 p-1.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium">
                                    ⚠️ <strong>Veresiye Satış:</strong> Bu tutar müşterinin açık hesabına alacak olarak kaydedilecektir.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sepet Kalemleri */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                        {cart.length === 0 ? (
                            <div className="text-center text-slate-400 py-12 text-sm">
                                Sepetiniz boş. Soldaki ürünlerden ekleyin.
                            </div>
                        ) : (
                            cart.map((item) => {
                                const currencySymbol = CURRENCY_SYMBOLS[item.original_currency || 'TL'] || '₺';
                                const itemStock = stockMap[item.product.id] !== undefined ? stockMap[item.product.id] : 0;

                                return (
                                    <div
                                        key={item.cartKey}
                                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-colors space-y-2.5"
                                    >
                                        <div className="flex justify-between items-start gap-1">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 line-clamp-1">{item.product.name}</p>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    {/* Perakende / Toptan Rozet Butonu */}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleItemPriceType(item.cartKey)}
                                                        title="Tıklayarak Toptan/Perakende arasında geçiş yapın"
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${item.priceType === 'retail' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                                                    >
                                                        {item.priceType === 'retail' ? 'PERAKENDE' : 'TOPTAN'} ⟲
                                                    </button>

                                                    <span className="text-[10px] font-bold text-slate-500">
                                                        Depo Stoğu: {itemStock}
                                                    </span>

                                                    {item.original_currency !== 'TL' && (
                                                        <span className="text-[10px] font-semibold text-slate-500">
                                                            (Kur: {item.exchange_rate} ₺)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => removeFromCart(item.cartKey)}
                                                className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {/* Miktar, Birim Fiyat (Orijinal Para Biriminde Doğrudan Düzenlenebilir) ve Tutar */}
                                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-500">Adet:</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={itemStock}
                                                    className="w-14 p-1 text-center border border-slate-300 rounded-md font-bold bg-white outline-none focus:ring-1 focus:ring-blue-500"
                                                    value={item.quantity}
                                                    onChange={(e) => updateQuantity(item.cartKey, e.target.value)}
                                                />
                                                <span className="text-[10px] font-bold text-slate-400">/ {itemStock}</span>
                                            </div>

                                            {/* Direkt Fiyat Düzenleme Kutusu (Örn: 2.1 $, 1.8 $, 350 ₺) */}
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-500 font-medium">Birim:</span>
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className="w-20 p-1 pr-5 text-right border border-slate-300 rounded-md font-bold text-slate-900 bg-white outline-none focus:ring-1 focus:ring-blue-500"
                                                        value={item.original_price}
                                                        onChange={(e) => updateItemOriginalPrice(item.cartKey, e.target.value)}
                                                    />
                                                    <span className="absolute right-1 text-slate-500 text-xs font-bold pointer-events-none">
                                                        {currencySymbol}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <span className="font-extrabold text-slate-900 block text-sm">
                                                    {formatCurrency(item.quantity * item.unit_price)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Alt Toplam & Fatura Çıkarma Butonu */}
                    <div className="p-3 bg-slate-50 border-t border-slate-200">
                        <div className="flex flex-col items-end mb-2">
                            {getAggregatedTotals()}
                            <div className="flex justify-between items-center w-full">
                                <span className="text-slate-600 font-semibold text-sm">Genel Toplam:</span>
                                <span className="text-xl font-extrabold text-blue-700">{formatCurrency(calculateTotal())}</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleCheckout}
                            disabled={submitting || cart.length === 0}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow transition-all disabled:opacity-50 text-sm cursor-pointer"
                        >
                            {submitting ? 'İşleniyor...' : 'Satışı Tamamla ve Fatura Çıkar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesNew;
