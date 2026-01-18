import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Package, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, ArrowRightLeft } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
    const [stats, setStats] = useState({
        customerCount: 0,
        productCount: 0,
        stockCount: 0,
        todaySales: 0,
    });
    const [salesData, setSalesData] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [recentSales, setRecentSales] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // 1. Counts
            const customers = await supabase.from('customers').select('*', { count: 'exact', head: true });
            const products = await supabase.from('products').select('*', { count: 'exact', head: true });

            const { data: stockLevels } = await supabase.from('stock_levels').select('quantity');
            const totalStock = stockLevels?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;

            const { data: todaySalesData } = await supabase
                .from('sales')
                .select('total_amount')
                .gte('created_at', today.toISOString());

            const totalTodaySales = todaySalesData?.reduce((acc, curr) => acc + (curr.total_amount || 0), 0) || 0;

            setStats({
                customerCount: customers.count || 0,
                productCount: products.count || 0,
                stockCount: totalStock,
                todaySales: totalTodaySales,
            });

            // 2. Sales Chart (Last 7 Days)
            const last7Days = new Date();
            last7Days.setDate(last7Days.getDate() - 7);

            const { data: rawSales } = await supabase
                .from('sales')
                .select('created_at, total_amount')
                .gte('created_at', last7Days.toISOString())
                .order('created_at', { ascending: true });

            // Group by date
            const groupedSales = {};
            rawSales?.forEach(sale => {
                const date = new Date(sale.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                groupedSales[date] = (groupedSales[date] || 0) + sale.total_amount;
            });

            const chartData = Object.keys(groupedSales).map(date => ({
                name: date,
                satis: groupedSales[date]
            }));
            setSalesData(chartData);

            // 3. Low Stock Items (Arbitrary < 10 threshold)
            const { data: lowStock } = await supabase
                .from('stock_levels')
                .select(`
          quantity,
          products (name, sku_or_barcode),
          warehouses (name)
        `)
                .lt('quantity', 10)
                .limit(5);

            setLowStockItems(lowStock || []);

            // 4. Recent Sales
            const { data: recent } = await supabase
                .from('sales')
                .select(`
          id,
          total_amount,
          created_at,
          customers (name)
        `)
                .order('created_at', { ascending: false })
                .limit(5);

            setRecentSales(recent || []);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">Genel Bakış</h1>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Toplam Müşteri"
                    value={stats.customerCount}
                    icon={Users}
                    color="bg-blue-500"
                />
                <StatCard
                    title="Toplam Ürün"
                    value={stats.productCount}
                    icon={Package}
                    color="bg-purple-500"
                />
                <StatCard
                    title="Toplam Stok"
                    value={stats.stockCount}
                    icon={ArrowRightLeft}
                    color="bg-orange-500"
                />
                <StatCard
                    title="Bugünkü Satış"
                    value={formatCurrency(stats.todaySales)}
                    icon={TrendingUp}
                    color="bg-green-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Satış Grafiği (Son 7 Gün)</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesData}>
                                <defs>
                                    <linearGradient id="colorSatis" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    cursor={{ stroke: '#94a3b8' }}
                                />
                                <Area type="monotone" dataKey="satis" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorSatis)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Low Stock & Recent Sales */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">Kritik Stok Seviyesi</h3>
                            <AlertTriangle size={20} className="text-red-500" />
                        </div>
                        <div className="space-y-3">
                            {lowStockItems.length === 0 ? (
                                <p className="text-slate-500 text-sm">Kritik stok uyarısı yok.</p>
                            ) : (
                                lowStockItems.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-slate-800 text-sm">{item.products?.name}</p>
                                            <p className="text-xs text-slate-500">{item.warehouses?.name}</p>
                                        </div>
                                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                                            {item.quantity} adet
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">Son Satışlar</h3>
                            <ArrowUpRight size={20} className="text-green-500" />
                        </div>
                        <div className="space-y-3">
                            {recentSales.map((sale) => (
                                <div key={sale.id} className="flex justify-between items-center border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                    <div>
                                        <p className="font-medium text-slate-800 text-sm">{sale.customers?.name || 'Bilinmeyen Müşteri'}</p>
                                        <p className="text-xs text-slate-500">{formatDate(sale.created_at)}</p>
                                    </div>
                                    <span className="font-semibold text-slate-800 text-sm">
                                        {formatCurrency(sale.total_amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
        <div>
            <p className="text-slate-500 text-sm mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
            <Icon size={24} className={`text-${color.split('-')[1]}-600`} />
        </div>
    </div>
);

export default Dashboard;
