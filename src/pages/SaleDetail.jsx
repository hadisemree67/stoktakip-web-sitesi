import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/utils';
import { ArrowLeft, Printer } from 'lucide-react';
import { CURRENCY_SYMBOLS } from '../lib/currency';

const SaleDetail = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const [sale, setSale] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [companyName, setCompanyName] = useState('');

    useEffect(() => {
        fetchDetail();
        fetchUserCompany();
    }, [id]);

    const fetchUserCompany = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.company_name) {
            setCompanyName(user.user_metadata.company_name);
        }
    };

    useEffect(() => {
        if (!loading && sale && searchParams.get('print') === 'true') {
            const timer = setTimeout(() => {
                window.print();
                // Optional: Clear URL param after print
                // setSearchParams(params => { params.delete('print'); return params; });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [loading, sale, searchParams]);

    const fetchDetail = async () => {
        setLoading(true);

        // Fetch Sale Info
        const { data: saleData } = await supabase
            .from('sales')
            .select(`
        *,
        customers (name, email, phone, address),
        sales_locations (name, address)
      `)
            .eq('id', id)
            .single();

        // Fetch Items
        const { data: itemsData } = await supabase
            .from('sale_items')
            .select(`
        *,
        products (name, sku_or_barcode, brand)
      `)
            .eq('sale_id', id);

        setSale(saleData);
        setItems(itemsData || []);
        setLoading(false);
    };

    if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;
    if (!sale) return <div className="p-8 text-center">Satış bulunamadı.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between no-print">
                <Link to="/sales" className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
                    <ArrowLeft size={20} /> Listeye Dön
                </Link>
                <button onClick={() => window.print()} className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors">
                    <Printer size={20} /> Yazdır
                </button>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg print:shadow-none print:border print:border-slate-200" id="invoice">
                {companyName && (
                    <div className="text-center mb-6 pb-4 border-b-2 border-slate-800">
                        <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-wide">{companyName}</h1>
                    </div>
                )}
                <div className="flex justify-between items-start border-b border-slate-100 pb-8 mb-8">
                    <div>
                        <h2 className="text-xl font-bold text-slate-700 mb-2">Satış Fişi</h2>
                        <p className="text-slate-500 text-sm">#{sale.id}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg text-slate-800">{sale.sales_locations?.name}</p>
                        <p className="text-slate-500 text-sm max-w-xs">{sale.sales_locations?.address}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <h3 className="text-xs uppercase font-bold text-slate-400 mb-2">Müşteri</h3>
                        <p className="font-semibold text-slate-800">{sale.customers?.name || 'Misafir Müşteri'}</p>
                        {sale.customers && (
                            <div className="text-sm text-slate-500 mt-1">
                                <p>{sale.customers.email}</p>
                                <p>{sale.customers.phone}</p>
                                <p className="mt-1">{sale.customers.address}</p>
                            </div>
                        )}
                    </div>
                    <div className="text-right">
                        <h3 className="text-xs uppercase font-bold text-slate-400 mb-2">Tarih</h3>
                        <p className="font-medium text-slate-800">{formatDate(sale.created_at)}</p>
                    </div>
                </div>

                <table className="w-full text-left text-sm mb-8">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-y border-slate-200">
                        <tr>
                            <th className="py-3 px-4">Ürün</th>
                            <th className="py-3 px-4 text-center">Adet</th>
                            <th className="py-3 px-4 text-right">Birim Fiyat (TL)</th>
                            <th className="py-3 px-4 text-right">Toplam</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.map((item) => (
                            <tr key={item.id}>
                                <td className="py-3 px-4">
                                    <span className="block font-medium text-slate-800">{item.products?.name}</span>
                                    <span className="text-xs text-slate-500">{item.products?.sku_or_barcode}</span>
                                    {item.original_currency && item.original_currency !== 'TL' && (
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            {item.original_price} {CURRENCY_SYMBOLS[item.original_currency]} (Kur: {item.exchange_rate})
                                        </div>
                                    )}
                                </td>
                                <td className="py-3 px-4 text-center">{item.quantity}</td>
                                <td className="py-3 px-4 text-right">{formatCurrency(item.unit_price)}</td>
                                <td className="py-3 px-4 text-right font-medium text-slate-800">{formatCurrency(item.quantity * item.unit_price)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>


                <div className="flex justify-end border-t border-slate-100 pt-6">
                    <div className="w-64">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-600">Ara Toplam</span>
                            <span className="font-medium">{formatCurrency(sale.total_amount)}</span>
                        </div>
                        <div className="flex justify-between items-center py-4">
                            <span className="text-lg font-bold text-slate-900">Genel Toplam</span>
                            <div className="text-right">
                                {items.some(i => i.original_currency && i.original_currency !== 'TL') && (
                                    <div className="text-sm text-slate-500 font-semibold mb-1">
                                        {Object.entries(items.reduce((acc, item) => {
                                            const curr = item.original_currency || 'TL';
                                            if (curr !== 'TL') {
                                                acc[curr] = (acc[curr] || 0) + (item.original_price * item.quantity);
                                            }
                                            return acc;
                                        }, {})).map(([curr, amount]) => (
                                            <span key={curr} className="block">
                                                {amount.toFixed(2)} {CURRENCY_SYMBOLS[curr]} =
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <span className="text-xl font-bold text-blue-600">{formatCurrency(sale.total_amount)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaleDetail;
