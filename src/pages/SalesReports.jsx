import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    BarChart3,
    Calendar,
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingBag,
    User,
    Package
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend
} from 'recharts';
import { formatCurrency, formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

const SalesReports = () => {
    const [loading, setLoading] = useState(false);
    const [dateRange, setDateRange] = useState('month'); // today, week, month, year, custom
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalProfit: 0,
        totalSalesCount: 0,
        totalItemsSold: 0,
        margin: 0
    });

    const [chartData, setChartData] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [topCustomers, setTopCustomers] = useState([]);

    useEffect(() => {
        fetchReportData();
    }, [dateRange, customStart, customEnd]); // Re-fetch when filters change

    const getDateFilter = () => {
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);

        // Set end of today
        end.setHours(23, 59, 59, 999);

        switch (dateRange) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(end.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                break;
            case 'week':
                start.setDate(start.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                break;
            case 'month':
                start.setMonth(start.getMonth() - 1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'year':
                start.setFullYear(start.getFullYear() - 1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'custom':
                if (customStart) start.setTime(new Date(customStart).getTime());
                if (customEnd) end.setTime(new Date(customEnd).getTime());
                // Fix for specific end date to include the whole day
                end.setHours(23, 59, 59, 999);
                break;
        }
        return { start, end };
    };

    const fetchReportData = async () => {
        if (dateRange === 'custom' && (!customStart || !customEnd)) return;

        setLoading(true);
        const { start, end } = getDateFilter();

        try {
            // 1. Fetch Sales within date range
            const { data: sales, error: salesError } = await supabase
                .from('sales')
                .select(`
          id,
          total_amount,
          created_at,
          customers (id, name),
          sale_items (
            quantity,
            unit_price,
            product:products (name, purchase_price)
          )
        `)
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString())
                .order('created_at', { ascending: true });

            if (salesError) throw salesError;

            // 2. Process Data
            let revenue = 0;
            let profit = 0;
            let count = 0;
            let itemsSold = 0;

            const salesByDate = {};
            const productStats = {};
            const customerStats = {};

            sales.forEach(sale => {
                revenue += sale.total_amount;
                count += 1;

                // Date grouping for chart
                const dateKey = new Date(sale.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                if (!salesByDate[dateKey]) salesByDate[dateKey] = { name: dateKey, ciro: 0, kar: 0 };
                salesByDate[dateKey].ciro += sale.total_amount;

                // Items processing
                sale.sale_items.forEach(item => {
                    itemsSold += item.quantity;

                    // Profit calc: (Create Price - Buy Price) * Qty
                    // Fallback to 0 if purchase_price is null
                    const buyPrice = item.product?.purchase_price || 0;
                    const itemProfit = (item.unit_price - buyPrice) * item.quantity;
                    profit += itemProfit;

                    salesByDate[dateKey].kar += itemProfit;

                    // Product Stats
                    const prodName = item.product?.name || 'Bilinmeyen Ürün';
                    if (!productStats[prodName]) productStats[prodName] = { name: prodName, qty: 0, revenue: 0, profit: 0 };
                    productStats[prodName].qty += item.quantity;
                    productStats[prodName].revenue += item.quantity * item.unit_price;
                    productStats[prodName].profit += itemProfit;
                });

                // Customer Stats
                const custName = sale.customers?.name || 'Misafir';
                if (!customerStats[custName]) customerStats[custName] = { name: custName, count: 0, total: 0 };
                customerStats[custName].count += 1;
                customerStats[custName].total += sale.total_amount;
            });

            setStats({
                totalRevenue: revenue,
                totalProfit: profit,
                totalSalesCount: count,
                totalItemsSold: itemsSold,
                margin: revenue > 0 ? (profit / revenue) * 100 : 0
            });

            setChartData(Object.values(salesByDate));

            setTopProducts(Object.values(productStats).sort((a, b) => b.revenue - a.revenue).slice(0, 10));
            setTopCustomers(Object.values(customerStats).sort((a, b) => b.total - a.total).slice(0, 10));

        } catch (error) {
            console.error(error);
            toast.error('Rapor verisi alınamadı');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <BarChart3 className="text-blue-600" />
                    Satış Raporları
                </h1>

                {/* Date Filters */}
                <div className="flex flex-wrap gap-2 bg-white p-1 rounded-lg border border-slate-200">
                    {[
                        { id: 'today', label: 'Bugün' },
                        { id: 'yesterday', label: 'Dün' },
                        { id: 'week', label: 'Bu Hafta' },
                        { id: 'month', label: 'Bu Ay' },
                        { id: 'year', label: 'Bu Yıl' }
                    ].map(filter => (
                        <button
                            key={filter.id}
                            onClick={() => { setDateRange(filter.id); setCustomStart(''); setCustomEnd(''); }}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateRange === filter.id
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                    <div className="flex items-center gap-2 px-2 border-l border-slate-200 ml-1 pl-3">
                        <span className="text-xs text-slate-400 font-semibold uppercase">Özel:</span>
                        <input
                            type="date"
                            className="text-xs border rounded p-1 outline-none focus:border-blue-500"
                            value={customStart}
                            onChange={(e) => { setCustomStart(e.target.value); setDateRange('custom'); }}
                        />
                        <span className="text-slate-400">-</span>
                        <input
                            type="date"
                            className="text-xs border rounded p-1 outline-none focus:border-blue-500"
                            value={customEnd}
                            onChange={(e) => { setCustomEnd(e.target.value); setDateRange('custom'); }}
                        />
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <SummaryCard
                    title="Toplam Ciro"
                    value={formatCurrency(stats.totalRevenue)}
                    icon={DollarSign}
                    color="blue"
                />
                <SummaryCard
                    title="Toplam Kâr"
                    value={formatCurrency(stats.totalProfit)}
                    icon={TrendingUp}
                    color="green"
                    subValue={`%${stats.margin.toFixed(1)} Marj`}
                />
                <SummaryCard
                    title="Satış Sayısı"
                    value={stats.totalSalesCount}
                    icon={ShoppingBag}
                    color="purple"
                />
                <SummaryCard
                    title="Satılan Ürün"
                    value={stats.totalItemsSold}
                    icon={Package}
                    color="orange"
                />
                <SummaryCard
                    title="Ort. Sepet"
                    value={formatCurrency(stats.totalSalesCount ? stats.totalRevenue / stats.totalSalesCount : 0)}
                    icon={TrendingDown}
                    color="indigo"
                />
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Ciro ve Kâr Analizi</h3>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="ciro" name="Ciro" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                <Area type="monotone" dataKey="kar" name="Kâr" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">En İyi Müşteriler</h3>
                    <div className="overflow-y-auto flex-1 pr-2 space-y-4">
                        {topCustomers.map((cust, i) => (
                            <div key={i} className="flex items-center justify-between pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{cust.name}</p>
                                        <p className="text-xs text-slate-500">{cust.count} Sipariş</p>
                                    </div>
                                </div>
                                <span className="font-bold text-slate-700 text-sm">{formatCurrency(cust.total)}</span>
                            </div>
                        ))}
                        {topCustomers.length === 0 && <p className="text-slate-400 text-center py-4">Veri yok</p>}
                    </div>
                </div>
            </div>

            {/* Top Products Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">En Çok Satan Ürünler</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Sıra</th>
                                <th className="px-6 py-4">Ürün Adı</th>
                                <th className="px-6 py-4 text-center">Satış Adedi</th>
                                <th className="px-6 py-4 text-right">Toplam Ciro</th>
                                <th className="px-6 py-4 text-right">Toplam Kâr</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {topProducts.map((prod, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 w-16 text-center text-slate-400 font-mono">{i + 1}</td>
                                    <td className="px-6 py-4 font-medium text-slate-900">{prod.name}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold">{prod.qty}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium">{formatCurrency(prod.revenue)}</td>
                                    <td className="px-6 py-4 text-right font-bold text-green-600">{formatCurrency(prod.profit)}</td>
                                </tr>
                            ))}
                            {topProducts.length === 0 && (
                                <tr><td colSpan="5" className="text-center py-8">Veri bulunamadı.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

const SummaryCard = ({ title, value, icon: Icon, color, subValue }) => (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-start mb-2">
            <div className={`p-2 rounded-lg bg-${color}-50 text-${color}-600`}>
                <Icon size={20} />
            </div>
            {subValue && <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">{subValue}</span>}
        </div>
        <div>
            <p className="text-slate-500 text-xs font-medium uppercase mb-1">{title}</p>
            <h3 className="text-xl font-bold text-slate-800">{value}</h3>
        </div>
    </div>
);

export default SalesReports;
