import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, ShoppingCart, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { fetchExchangeRate, CURRENCY_SYMBOLS } from '../lib/currency';

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
    const [saleType, setSaleType] = useState('retail'); // 'retail' or 'wholesale'

    // Product Search & Cart
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState([]); // { product, quantity, unit_price, original_currency, original_price, exchange_rate }

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [rates, setRates] = useState({}); // Cache specific rates for this session if needed

    useEffect(() => {
        fetchData();
    }, []);

    // Update prices when saleType changes, but respect exchange rates
    useEffect(() => {
        const updateCartPrices = async () => {
            const newCart = [];
            for (const item of cart) {
                const basePrice = saleType === 'retail'
                    ? (item.product.unit_price)
                    : (item.product.wholesale_price || item.product.unit_price);

                // If foreign, we need to recalculate based on rate (or keep existing rate)
                // Simplification: Re-use existing exchange logic or just keep the unit_price as TL equivalent
                // Better: Re-calculate TL price based on original currency price and potentially updated rate

                // For now, let's just update the unit_price if it's TL, otherwise re-convert
                if (item.original_currency === 'TL') {
                    newCart.push({ ...item, unit_price: basePrice, original_price: basePrice });
                } else {
                    newCart.push(item); // Keep foreign currency items as is for now to avoid re-fetching rate constantly
                }
            }
            setCart(newCart);
        };
        updateCartPrices();
    }, [saleType]);

    const fetchData = async () => {
        setLoading(true);
        const [c, l, w, p] = await Promise.all([
            supabase.from('customers').select('id, name'),
            supabase.from('sales_locations').select('id, name'),
            supabase.from('warehouses').select('id, name'),
            supabase.from('products').select('id, name, unit_price, wholesale_price, sku_or_barcode, currency')
        ]);

        setCustomers(c.data || []);
        setLocations(l.data || []);
        setWarehouses(w.data || []);
        setProducts(p.data || []);

        if (l.data?.[0]) setSelectedLocationId(l.data[0].id);
        if (w.data?.[0]) setSelectedWarehouseId(w.data[0].id);
        setLoading(false);
    };

    const addToCart = async (product) => {
        const existing = cart.find(item => item.product.id === product.id);

        if (existing) {
            setCart(cart.map(item =>
                item.product.id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
            toast.success('Miktar artırıldı');
            return;
        }

        const currency = product.currency || 'TL';
        let originalPrice = saleType === 'retail' ? product.unit_price : (product.wholesale_price || product.unit_price);
        let finalPriceTL = originalPrice;
        let rate = 1;

        if (currency !== 'TL') {
            const toastId = toast.loading(`${currency} kuru çekiliyor...`);
            rate = await fetchExchangeRate(currency, 'TRY');
            toast.dismiss(toastId);

            if (!rate) {
                toast.error('Kur bilgisi alınamadı, işlem iptal edildi.');
                return;
            }
            finalPriceTL = originalPrice * rate;
        }

        setCart([...cart, {
            product,
            quantity: 1,
            unit_price: finalPriceTL, // Always in TL
            original_currency: currency,
            original_price: originalPrice,
            exchange_rate: rate
        }]);

        toast.success(`Ürün eklendi (${currency !== 'TL' ? rate + ' kurundan çevrildi' : 'TL'})`);
    };

    const removeFromCart = (productId) => {
        setCart(cart.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId, qty) => {
        const val = parseInt(qty);
        if (val < 1) return;
        setCart(cart.map(item =>
            item.product.id === productId ? { ...item, quantity: val } : item
        ));
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku_or_barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const calculateTotal = () => {
        return cart.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return toast.error('Sepet boş!');
        if (!selectedLocationId) return toast.error('Lütfen satış lokasyonu seçin.');
        if (!selectedWarehouseId) return toast.error('Lütfen stoktan düşülecek depoyu seçin.');

        setSubmitting(true);
        const toastId = toast.loading('Stok kontrol ediliyor...');

        // 1. Frontend Stock Check
        try {
            for (const item of cart) {
                const { data: stockData, error } = await supabase
                    .from('stock_levels')
                    .select('quantity')
                    .eq('product_id', item.product.id)
                    .eq('warehouse_id', selectedWarehouseId)
                    .single();

                const currentStock = stockData?.quantity || 0;

                if (currentStock < item.quantity) {
                    throw new Error(`"${item.product.name}" için yetersiz stok! (Mevcut: ${currentStock}, İstenen: ${item.quantity})`);
                }
            }
        } catch (err) {
            toast.dismiss(toastId);
            setSubmitting(false);
            return toast.error(err.message);
        }

        toast.dismiss(toastId);
        // Continue to submission...

        const payload = {
            p_customer_id: selectedCustomerId || null,
            p_sales_location_id: selectedLocationId,
            p_warehouse_id: selectedWarehouseId,
            p_items: cart.map(item => ({
                product_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.unit_price, // TL Price
                original_currency: item.original_currency,
                original_price: item.original_price,
                exchange_rate: item.exchange_rate
            }))
        };

        const { data, error } = await supabase.rpc('handle_new_sale', payload);

        if (error) {
            console.error(error);
            toast.error('Satış hatası: ' + error.message);
        } else {
            toast.success('Satış başarıyla oluşturuldu!');
            if (data?.id) {
                navigate(`/sales/${data.id}?print=true`);
            } else {
                navigate('/sales');
            }
        }
        setSubmitting(false);
    };

    // Calculate aggregated totals by currency
    const getAggregatedTotals = () => {
        const totals = {};
        let hasForeign = false;

        cart.forEach(item => {
            const currency = item.original_currency || 'TL';
            if (!totals[currency]) totals[currency] = 0;
            totals[currency] += (item.original_price || item.unit_price) * item.quantity;
            if (currency !== 'TL') hasForeign = true;
        });

        if (!hasForeign) return null;

        return Object.entries(totals).filter(([curr]) => curr !== 'TL').map(([curr, amount]) => (
            <div key={curr} className="text-sm font-semibold text-blue-600">
                {amount.toFixed(2)} {CURRENCY_SYMBOLS[curr]} ≈
            </div>
        ));
    };

    if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-100px)]">
            {/* Left: Product Selector */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 space-y-3">
                    <div className="flex gap-4">
                        <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${saleType === 'retail' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input type="radio" name="saleType" checked={saleType === 'retail'} onChange={() => setSaleType('retail')} className="hidden" />
                            <span className="font-semibold">Perakende</span>
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${saleType === 'wholesale' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input type="radio" name="saleType" checked={saleType === 'wholesale'} onChange={() => setSaleType('wholesale')} className="hidden" />
                            <span className="font-semibold">Toptan</span>
                        </label>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Ürün Ara (İsim, Barkod)..."
                            className="pl-10 pr-4 py-3 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {filteredProducts.slice(0, 50).map(product => {
                            const originalPrice = saleType === 'retail' ? product.unit_price : (product.wholesale_price || product.unit_price);
                            const currencySymbol = CURRENCY_SYMBOLS[product.currency || 'TL'] || '₺';

                            return (
                                <div
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    className="border border-slate-200 rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group relative"
                                >
                                    {product.currency && product.currency !== 'TL' && (
                                        <span className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                            {product.currency}
                                        </span>
                                    )}
                                    <h4 className="font-semibold text-slate-800 mb-1">{product.name}</h4>
                                    <p className="text-xs text-slate-500 mb-2">{product.sku_or_barcode}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className={`font-bold ${saleType === 'wholesale' ? 'text-orange-600' : 'text-blue-600'}`}>
                                            {originalPrice} {currencySymbol}
                                        </span>
                                        <button className="bg-blue-100 text-blue-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Right: Cart & Checkout */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <ShoppingCart size={20} /> Satış Sepeti
                    </h2>
                </div>

                <div className="p-4 space-y-4 border-b border-slate-100">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Müşteri</label>
                        <select
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                            value={selectedCustomerId}
                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                        >
                            <option value="">Misafir Müşteri</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Satış Lokasyonu</label>
                        <select
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                            value={selectedLocationId}
                            onChange={(e) => setSelectedLocationId(e.target.value)}
                        >
                            <option value="">Seçiniz...</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Stoktan Düşülecek Depo</label>
                        <select
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                            value={selectedWarehouseId}
                            onChange={(e) => setSelectedWarehouseId(e.target.value)}
                        >
                            <option value="">Seçiniz...</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="text-center text-slate-400 py-10">Sepet boş</div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.product.id} className="flex gap-3 items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-800">{item.product.name}</p>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-700">
                                            {formatCurrency(item.unit_price)}
                                        </span>
                                        {item.original_currency !== 'TL' && (
                                            <span className="text-[10px] text-slate-500">
                                                ({item.original_price} {CURRENCY_SYMBOLS[item.original_currency]} x {item.exchange_rate})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-12 p-1 text-center border border-slate-300 rounded text-sm bg-white"
                                        value={item.quantity}
                                        onChange={(e) => updateQuantity(item.product.id, e.target.value)}
                                    />
                                    <button
                                        onClick={() => removeFromCart(item.product.id)}
                                        className="text-red-500 hover:text-red-700 p-1"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <div className="flex flex-col items-end mb-4">
                        {getAggregatedTotals()}
                        <div className="flex justify-between items-center w-full mt-1">
                            <span className="text-slate-600 font-medium">Toplam Tutar</span>
                            <span className="text-2xl font-bold text-slate-900">{formatCurrency(calculateTotal())}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleCheckout}
                        disabled={submitting || cart.length === 0}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                    >
                        {submitting ? 'İşleniyor...' : 'Satışı Tamamla ve Yazdır'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SalesNew;

