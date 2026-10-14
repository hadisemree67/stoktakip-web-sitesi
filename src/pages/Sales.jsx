import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Eye, Calendar, User, CheckCircle2, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

const Sales = () => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'veresiye_unpaid'

    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('sales')
            .select(`
                id,
                customer_id,
                total_amount,
                paid_amount,
                remaining_amount,
                payment_method,
                payment_status,
                paid_at,
                created_at,
                customers (name, phone),
                sales_locations (name)
            `)
            .order('created_at', { ascending: false });

        if (!error) {
            setSales(data || []);
        } else {
            // Fallback: Eğer veritabanında henüz payment_method kolonu yoksa
            const { data: fbData, error: fbError } = await supabase
                .from('sales')
                .select(`
                    id,
                    customer_id,
                    total_amount,
                    created_at,
                    customers (name, phone),
                    sales_locations (name)
                `)
                .order('created_at', { ascending: false });

            if (fbError) {
                toast.error('Satışlar yüklenemedi: ' + fbError.message);
            } else {
                setSales((fbData || []).map(s => ({
                    ...s,
                    payment_method: 'nakit',
                    payment_status: 'paid'
                })));
            }
        }
        setLoading(false);
    };

    // Alacağı Tahsil Et
    const handleCollectPayment = async (saleId) => {
        try {
            const currentSale = sales.find(s => s.id === saleId);
            const total = Number(currentSale?.total_amount) || 0;

            const { error } = await supabase
                .from('sales')
                .update({
                    payment_status: 'paid',
                    paid_at: new Date().toISOString(),
                    paid_amount: total,
                    remaining_amount: 0
                })
                .eq('id', saleId);

            if (error) {
                toast.error('Tahsilat kaydedilemedi: ' + error.message);
            } else {
                if (currentSale?.customer_id) {
                    try {
                        await supabase.from('customer_payments').insert([{
                            customer_id: currentSale.customer_id,
                            sale_id: saleId,
                            amount: total,
                            payment_method: 'nakit',
                            note: 'Satış fişi üzerinden tahsil edildi'
                        }]);
                    } catch (e) {
                        console.log('Customer payment log note:', e);
                    }
                }
                toast.success('Alacak başarıyla tahsil edildi olarak işaretlendi!');
                fetchSales();
            }
        } catch (err) {
            toast.error(err.message);
        }
    };

    const getPaymentBadge = (method, status) => {
        if (method === 'veresiye') {
            return status === 'unpaid' ? (
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    ⏳ Veresiye (Alacak)
                </span>
            ) : (
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    ✅ Veresiye (Tahsil Edildi)
                </span>
            );
        }
        if (method === 'kredi_karti') {
            return <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">💳 Kredi Kartı</span>;
        }
        if (method === 'havale') {
            return <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full">🏦 Havale</span>;
        }
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">💵 Nakit</span>;
    };

    const filteredSales = sales.filter(s => {
        if (filter === 'veresiye_unpaid') {
            return s.payment_method === 'veresiye' && s.payment_status === 'unpaid';
        }
        return true;
    });

    const unpaidCount = sales.filter(s => s.payment_method === 'veresiye' && s.payment_status === 'unpaid').length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Satışlar</h1>
                    <p className="text-xs text-slate-500">Tüm geçmiş satışlar, ödeme yöntemleri ve tahsilat takibi</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 text-xs font-bold">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${filter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Tümü ({sales.length})
                        </button>
                        <button
                            onClick={() => setFilter('veresiye_unpaid')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${filter === 'veresiye_unpaid' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Bekleyen Alacaklar ({unpaidCount})
                        </button>
                    </div>

                    <Link
                        to="/sales/new"
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium text-sm shadow-sm"
                    >
                        <Plus size={18} /> Yeni Satış Oluştur
                    </Link>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Satış ID</th>
                                <th className="px-6 py-4">Tarih</th>
                                <th className="px-6 py-4">Müşteri</th>
                                <th className="px-6 py-4">Ödeme Türü & Durumu</th>
                                <th className="px-6 py-4">Lokasyon</th>
                                <th className="px-6 py-4 text-right">Tutar</th>
                                <th className="px-6 py-4 text-center">İşlem / Detay</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="7" className="text-center py-8">Yükleniyor...</td></tr>
                            ) : filteredSales.length === 0 ? (
                                <tr><td colSpan="7" className="text-center py-8">Kayıtlı satış bulunamadı.</td></tr>
                            ) : (
                                filteredSales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{sale.id.slice(0, 8)}...</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-slate-400" />
                                                {formatDate(sale.created_at)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium">
                                            <div className="flex items-center gap-2">
                                                <User size={14} className="text-slate-400" />
                                                <div>
                                                    <span className="text-slate-900 font-bold">{sale.customers?.name || 'Misafir'}</span>
                                                    {sale.customers?.phone && (
                                                        <span className="block text-[11px] text-slate-400 font-normal">📞 {sale.customers.phone}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getPaymentBadge(sale.payment_method, sale.payment_status)}
                                        </td>
                                        <td className="px-6 py-4">{sale.sales_locations?.name || '-'}</td>
                                        <td className="px-6 py-4 text-right font-extrabold text-slate-800">
                                            {formatCurrency(sale.total_amount)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {sale.payment_method === 'veresiye' && sale.payment_status === 'unpaid' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCollectPayment(sale.id)}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                                        title="Alındı olarak işaretle"
                                                    >
                                                        <CheckCircle2 size={13} />
                                                        Tahsil Et
                                                    </button>
                                                )}
                                                <Link 
                                                    to={`/sales/${sale.id}`} 
                                                    className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg inline-flex items-center gap-1 transition-colors text-xs font-semibold"
                                                    title="Fatura / Detay Görüntüle"
                                                >
                                                    <Eye size={16} /> Fiş
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Sales;
