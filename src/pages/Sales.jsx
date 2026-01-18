import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Eye, Calendar, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

const Sales = () => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('sales')
            .select(`
        id,
        total_amount,
        created_at,
         customers (name),
        sales_locations (name)
      `)
            .order('created_at', { ascending: false });

        if (error) toast.error('Satışlar yüklenemedi');
        else setSales(data || []);
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Satışlar</h1>
                <Link
                    to="/sales/new"
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={20} /> Yeni Satış Oluştur
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Satış ID</th>
                                <th className="px-6 py-4">Tarih</th>
                                <th className="px-6 py-4">Müşteri</th>
                                <th className="px-6 py-4">Lokasyon</th>
                                <th className="px-6 py-4 text-right">Tutar</th>
                                <th className="px-6 py-4 text-center">Detay</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-8">Yükleniyor...</td></tr>
                            ) : sales.length === 0 ? (
                                <tr><td colSpan="6" className="text-center py-8">Satış bulunamadı.</td></tr>
                            ) : (
                                sales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-slate-50">
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
                                                {sale.customers?.name || 'Misafir'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{sale.sales_locations?.name}</td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-800">
                                            {formatCurrency(sale.total_amount)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Link to={`/sales/${sale.id}`} className="text-blue-600 hover:bg-blue-50 p-2 rounded-full inline-block transition-colors">
                                                <Eye size={18} />
                                            </Link>
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
