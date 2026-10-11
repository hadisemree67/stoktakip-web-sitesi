import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    Users, Package, TrendingUp, AlertTriangle, ArrowUpRight,
    ArrowRightLeft, Wallet, CreditCard, Building2, Clock, CheckCircle2,
    Calendar, ArrowRight, X, Phone, User
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

const Dashboard = () => {
    const [period, setPeriod] = useState('today'); // 'today', 'week', 'month', 'all'
    const [stats, setStats] = useState({
        customerCount: 0,
        productCount: 0,
        stockCount: 0,
    });

    const [revenues, setRevenues] = useState({
        total: 0,
        cash: 0,
        card: 0,
        bank: 0,
        receivable: 0, // Bekleyen alacaklar
        collectedReceivable: 0, // Tahsil edilmiş veresiyeler
    });

    const [salesData, setSalesData] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [recentSales, setRecentSales] = useState([]);
    const [receivablesList, setReceivablesList] = useState([]);
    const [isReceivablesModalOpen, setIsReceivablesModalOpen] = useState(false);
    const [receivablesFilter, setReceivablesFilter] = useState('unpaid'); // 'unpaid', 'paid', 'all'
    const [collectingId, setCollectingId] = useState(null);
    const [collectMethod, setCollectMethod] = useState('nakit');

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, [period]);

    const getPeriodStartDate = (selectedPeriod) => {
        const now = new Date();
        if (selectedPeriod === 'today') {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            return start.toISOString();
        } else if (selectedPeriod === 'week') {
            const start = new Date(now);
            start.setDate(now.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            return start.toISOString();
        } else if (selectedPeriod === 'month') {
            const start = new Date(now);
            start.setDate(now.getDate() - 30);
            start.setHours(0, 0, 0, 0);
            return start.toISOString();
        }
        return null; // all
    };

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const startDate = getPeriodStartDate(period);
            const last7Days = new Date();
            last7Days.setDate(last7Days.getDate() - 7);

            // 1. Güvenli Satış Sorgusu (payment_method kolonu henüz yoksa bile çökmez)
            const getSalesInPeriod = async () => {
                let q = supabase.from('sales').select(`
                    id,
                    total_amount,
                    payment_method,
                    payment_status,
                    created_at,
                    customers (name, phone)
                `);
                if (startDate) q = q.gte('created_at', startDate);
                
                const res = await q;
                if (!res.error) return res.data || [];

                // Fallback: Kolon henüz eklenmediyse standart alanlarla çek
                let fallbackQ = supabase.from('sales').select('id, total_amount, created_at, customers (name, phone)');
                if (startDate) fallbackQ = fallbackQ.gte('created_at', startDate);
                const fbRes = await fallbackQ;
                return (fbRes.data || []).map(s => ({
                    ...s,
                    payment_method: 'nakit',
                    payment_status: 'paid'
                }));
            };

            // 2. Güvenli Veresiye Sorgusu
            const getVeresiyeList = async () => {
                const res = await supabase
                    .from('sales')
                    .select('id, total_amount, payment_method, payment_status, paid_at, created_at, customers (name, phone)')
                    .eq('payment_method', 'veresiye')
                    .order('created_at', { ascending: false });

                if (!res.error) return res.data || [];
                return [];
            };

            // 3. Güvenli Son Satışlar Sorgusu
            const getRecentSales = async () => {
                const res = await supabase
                    .from('sales')
                    .select('id, total_amount, payment_method, payment_status, created_at, customers (name)')
                    .order('created_at', { ascending: false })
                    .limit(6);

                if (!res.error) return res.data || [];

                const fbRes = await supabase
                    .from('sales')
                    .select('id, total_amount, created_at, customers (name)')
                    .order('created_at', { ascending: false })
                    .limit(6);

                return (fbRes.data || []).map(s => ({
                    ...s,
                    payment_method: 'nakit',
                    payment_status: 'paid'
                }));
            };

            // TÜM SORGULARI TEK SEFERDE PARALEL (PROMISE.ALL) ÇALIŞTIR - HIZ: <500ms
            const [
                customersRes,
                productsRes,
                stockLevelsRes,
                salesInPeriod,
                allVeresiye,
                chartSalesRes,
                lowStockRes,
                recent
            ] = await Promise.all([
                supabase.from('customers').select('*', { count: 'exact', head: true }),
                supabase.from('products').select('*', { count: 'exact', head: true }),
                supabase.from('stock_levels').select('quantity'),
                getSalesInPeriod(),
                getVeresiyeList(),
                supabase.from('sales').select('created_at, total_amount').gte('created_at', last7Days.toISOString()).order('created_at', { ascending: true }),
                supabase.from('stock_levels').select('quantity, products (name, sku_or_barcode), warehouses (name)').lt('quantity', 10).limit(5),
                getRecentSales()
            ]);

            // Genel Sayılar
            const totalStock = stockLevelsRes.data?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;
            setStats({
                customerCount: customersRes.count || 0,
                productCount: productsRes.count || 0,
                stockCount: totalStock,
            });

            // Hasılat Hesaplamaları
            let totalRev = 0;
            let cashRev = 0;
            let cardRev = 0;
            let bankRev = 0;
            let receivableRev = 0;
            let collectedRec = 0;

            salesInPeriod.forEach(sale => {
                const amount = Number(sale.total_amount) || 0;
                const method = sale.payment_method || 'nakit';
                const status = sale.payment_status || 'paid';

                if (method === 'veresiye') {
                    if (status === 'unpaid') {
                        receivableRev += amount;
                    } else {
                        collectedRec += amount;
                        totalRev += amount;
                    }
                } else {
                    totalRev += amount;
                    if (method === 'nakit') cashRev += amount;
                    else if (method === 'kredi_karti') cardRev += amount;
                    else if (method === 'havale') bankRev += amount;
                }
            });

            setRevenues({
                total: totalRev,
                cash: cashRev,
                card: cardRev,
                bank: bankRev,
                receivable: receivableRev,
                collectedReceivable: collectedRec,
            });

            setReceivablesList(allVeresiye || []);

            // Grafik Verisi
            const groupedSales = {};
            chartSalesRes.data?.forEach(sale => {
                const date = new Date(sale.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                groupedSales[date] = (groupedSales[date] || 0) + (Number(sale.total_amount) || 0);
            });

            const chartData = Object.keys(groupedSales).map(date => ({
                name: date,
                satis: groupedSales[date]
            }));
            setSalesData(chartData);

            // Kritik Stoklar ve Son Satışlar
            setLowStockItems(lowStockRes.data || []);
            setRecentSales(recent || []);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Alacağı Tahsil Edildi Olarak İşaretle
    const handleCollectPayment = async (saleId) => {
        try {
            const { error } = await supabase
                .from('sales')
                .update({
                    payment_status: 'paid',
                    paid_at: new Date().toISOString(),
                    // Tahsil edilen yöntem veresiye üzerinde not olarak veya doğrudan yöntem olarak güncellenebilir
                })
                .eq('id', saleId);

            if (error) {
                toast.error('Tahsilat kaydedilemedi: ' + error.message);
            } else {
                toast.success('Alacak başarıyla tahsil edildi olarak işaretlendi!');
                setCollectingId(null);
                fetchDashboardData();
            }
        } catch (err) {
            toast.error(err.message);
        }
    };

    const getPaymentBadge = (method, status) => {
        if (method === 'veresiye') {
            return status === 'unpaid'
                ? <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">⏳ Veresiye (Alacak)</span>
                : <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">✅ Veresiye (Tahsil Edildi)</span>;
        }
        if (method === 'kredi_karti') return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">💳 Kredi Kartı</span>;
        if (method === 'havale') return <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">🏦 Havale</span>;
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">💵 Nakit</span>;
    };

    const filteredReceivables = receivablesList.filter(item => {
        if (receivablesFilter === 'unpaid') return item.payment_status === 'unpaid';
        if (receivablesFilter === 'paid') return item.payment_status === 'paid';
        return true;
    });

    if (loading) return <div className="p-10 text-center text-slate-500 font-medium">Panel yükleniyor...</div>;

    return (
        <div className="space-y-6">
            {/* Üst Bar: Başlık & Periyot Filtre Butonları */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Finans ve Satış Paneli</h1>
                    <p className="text-xs text-slate-500">Günlük, haftalık ve aylık nakit akışı ve alacak takibi</p>
                </div>

                {/* Periyot Seçici */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 text-xs font-bold w-full sm:w-auto overflow-x-auto whitespace-nowrap">
                    <button
                        onClick={() => setPeriod('today')}
                        className={`px-3 py-1.5 rounded-lg shrink-0 transition-all ${period === 'today' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Bugün (Günlük)
                    </button>
                    <button
                        onClick={() => setPeriod('week')}
                        className={`px-3 py-1.5 rounded-lg shrink-0 transition-all ${period === 'week' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Bu Hafta
                    </button>
                    <button
                        onClick={() => setPeriod('month')}
                        className={`px-3 py-1.5 rounded-lg shrink-0 transition-all ${period === 'month' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Bu Ay
                    </button>
                    <button
                        onClick={() => setPeriod('all')}
                        className={`px-3 py-1.5 rounded-lg shrink-0 transition-all ${period === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Tüm Zamanlar
                    </button>
                </div>
            </div>

            {/* HASILAT KARTLARI (ÖDEME TÜRÜNE GÖRE DÖKÜM) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* 1. Toplam Hasılat */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Toplam Hasılat</span>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <TrendingUp size={18} />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-extrabold text-slate-900">{formatCurrency(revenues.total)}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Tahsil edilen toplam ciro</p>
                    </div>
                </div>

                {/* 2. Nakit Hasılat */}
                <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-between bg-gradient-to-b from-white to-emerald-50/20">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Nakit Hasılat</span>
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                            <Wallet size={18} />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-extrabold text-emerald-700">{formatCurrency(revenues.cash)}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Elden alınan nakit</p>
                    </div>
                </div>

                {/* 3. Kredi Kartı Hasılatı */}
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-between bg-gradient-to-b from-white to-blue-50/20">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Kredi Kartı</span>
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                            <CreditCard size={18} />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-extrabold text-blue-700">{formatCurrency(revenues.card)}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">POS & kart çekimleri</p>
                    </div>
                </div>

                {/* 4. Havale / EFT Hasılatı */}
                <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm flex flex-col justify-between bg-gradient-to-b from-white to-purple-50/20">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Havale / EFT</span>
                        <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                            <Building2 size={18} />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-extrabold text-purple-700">{formatCurrency(revenues.bank)}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Banka hesaplarına gelen</p>
                    </div>
                </div>

                {/* 5. Alacak (Veresiye) Hasılatı - TIKLANABİLİR KART */}
                <div
                    onClick={() => setIsReceivablesModalOpen(true)}
                    className="bg-amber-500 text-white p-4 rounded-xl shadow-md hover:bg-amber-600 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-100">Alacak Hasılatı</span>
                        <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                            <Clock size={18} />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-extrabold">{formatCurrency(revenues.receivable)}</h3>
                        <div className="flex items-center justify-between text-xs text-amber-100 font-semibold mt-1">
                            <span>Bekleyen Alacaklar</span>
                            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </div>
            </div>

            {/* İkincil Sayılar (Müşteri, Ürün, Stok) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase">Kayıtlı Müşteri</p>
                        <h4 className="text-xl font-bold text-slate-900 mt-0.5">{stats.customerCount} Kişi</h4>
                    </div>
                    <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
                        <Users size={22} />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase">Kayıtlı Ürün</p>
                        <h4 className="text-xl font-bold text-slate-900 mt-0.5">{stats.productCount} Kalem</h4>
                    </div>
                    <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
                        <Package size={22} />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase">Toplam Depo Stoğu</p>
                        <h4 className="text-xl font-bold text-slate-900 mt-0.5">{stats.stockCount} Adet</h4>
                    </div>
                    <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
                        <ArrowRightLeft size={22} />
                    </div>
                </div>
            </div>

            {/* Satış Grafiği & Kritik Stoklar / Son Satışlar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sol: Grafik */}
                <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-bold text-slate-800">Ciro Grafiği (Son 7 Gün)</h3>
                        <span className="text-xs text-slate-400">Günlük Satış Trendi</span>
                    </div>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesData}>
                                <defs>
                                    <linearGradient id="colorSatis" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    formatter={(value) => [formatCurrency(value), 'Satış']}
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="satis" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSatis)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Sağ: Son Satışlar ve Kritik Stoklar */}
                <div className="space-y-4">
                    {/* Son Satışlar */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                <ArrowUpRight size={16} className="text-emerald-600" /> Son Satışlar
                            </h3>
                            <Link to="/sales" className="text-xs text-indigo-600 hover:underline font-semibold">Tümünü Gör</Link>
                        </div>
                        <div className="space-y-2">
                            {recentSales.map((sale) => (
                                <div key={sale.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg text-xs">
                                    <div>
                                        <p className="font-bold text-slate-900">{sale.customers?.name || 'Misafir Müşteri'}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[10px] text-slate-400">{formatDate(sale.created_at)}</span>
                                            {getPaymentBadge(sale.payment_method, sale.payment_status)}
                                        </div>
                                    </div>
                                    <span className="font-extrabold text-slate-900 text-sm">
                                        {formatCurrency(sale.total_amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Kritik Stoklar */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                <AlertTriangle size={16} className="text-red-500" /> Kritik Stok Uyarısı
                            </h3>
                            <Link to="/stock" className="text-xs text-indigo-600 hover:underline font-semibold">Stok Yönetimi</Link>
                        </div>
                        <div className="space-y-2">
                            {lowStockItems.length === 0 ? (
                                <p className="text-slate-400 text-xs py-2 text-center">Kritik seviyede ürün yok.</p>
                            ) : (
                                lowStockItems.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center p-2 bg-red-50/40 rounded-lg text-xs">
                                        <div>
                                            <p className="font-bold text-slate-900">{item.products?.name}</p>
                                            <p className="text-[10px] text-slate-500">{item.warehouses?.name}</p>
                                        </div>
                                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-extrabold">
                                            {item.quantity} adet
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ALACAKLAR & VERESİYE YÖNETİMİ MODALI */}
            <Modal
                isOpen={isReceivablesModalOpen}
                onClose={() => setIsReceivablesModalOpen(false)}
                title="Veresiye (Alacak) Hesapları & Tahsilat"
            >
                <div className="space-y-4">
                    {/* Üst Bilgi ve Filtreler */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-amber-50 p-3.5 rounded-xl border border-amber-200">
                        <div>
                            <span className="text-xs font-semibold text-amber-800 block">TOPLAM BEKLEYEN ALACAK:</span>
                            <span className="text-2xl font-black text-amber-900">{formatCurrency(revenues.receivable)}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-amber-200 text-xs font-bold">
                            <button
                                onClick={() => setReceivablesFilter('unpaid')}
                                className={`px-2.5 py-1 rounded transition-colors ${receivablesFilter === 'unpaid' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                Bekleyenler ({receivablesList.filter(i => i.payment_status === 'unpaid').length})
                            </button>
                            <button
                                onClick={() => setReceivablesFilter('paid')}
                                className={`px-2.5 py-1 rounded transition-colors ${receivablesFilter === 'paid' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                Tahsil Edilenler ({receivablesList.filter(i => i.payment_status === 'paid').length})
                            </button>
                            <button
                                onClick={() => setReceivablesFilter('all')}
                                className={`px-2.5 py-1 rounded transition-colors ${receivablesFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                Tümü ({receivablesList.length})
                            </button>
                        </div>
                    </div>

                    {/* Alacaklar Tablosu */}
                    <div className="overflow-x-auto max-h-[400px]">
                        {filteredReceivables.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                Bu filtreye uygun veresiye kaydı bulunmuyor.
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 text-slate-600 uppercase font-bold sticky top-0">
                                    <tr>
                                        <th className="py-2.5 px-3">Müşteri</th>
                                        <th className="py-2.5 px-3">Tarih</th>
                                        <th className="py-2.5 px-3 text-right">Tutar</th>
                                        <th className="py-2.5 px-3 text-center">Durum</th>
                                        <th className="py-2.5 px-3 text-right">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredReceivables.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-3">
                                                <div className="font-bold text-slate-900">{sale.customers?.name || 'Müşteri'}</div>
                                                {sale.customers?.phone && (
                                                    <div className="text-[10px] text-slate-500">📞 {sale.customers.phone}</div>
                                                )}
                                                <Link to={`/sales/${sale.id}`} className="text-[10px] text-indigo-600 hover:underline">
                                                    Fiş: #{sale.id.slice(0, 8)}
                                                </Link>
                                            </td>
                                            <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                                                {formatDate(sale.created_at)}
                                            </td>
                                            <td className="py-3 px-3 text-right font-extrabold text-slate-900 text-sm">
                                                {formatCurrency(sale.total_amount)}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                {sale.payment_status === 'unpaid' ? (
                                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                                                        ⏳ Bekliyor
                                                    </span>
                                                ) : (
                                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                                                        ✅ Alındı ({formatDate(sale.paid_at || sale.created_at)})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                {sale.payment_status === 'unpaid' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCollectPayment(sale.id)}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg shadow-sm transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                                    >
                                                        <CheckCircle2 size={13} />
                                                        Alındı (Tahsil Et)
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-400 font-semibold text-[11px]">Tahsil Edildi</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Dashboard;
