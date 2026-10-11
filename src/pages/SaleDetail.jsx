import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/utils';
import { ArrowLeft, Printer, FileText, CheckCircle2, Clock } from 'lucide-react';
import { CURRENCY_SYMBOLS } from '../lib/currency';
import toast from 'react-hot-toast';

const SaleDetail = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const [sale, setSale] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [companyName, setCompanyName] = useState('STOK VE SATIŞ YÖNETİMİ');

    useEffect(() => {
        fetchDetail();
        fetchUserCompany();
    }, [id]);

    const fetchUserCompany = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.company_name) {
            setCompanyName(user.user_metadata.company_name);
        } else if (user?.user_metadata?.full_name) {
            setCompanyName(user.user_metadata.full_name);
        }
    };

    useEffect(() => {
        if (!loading && sale && searchParams.get('print') === 'true') {
            const timer = setTimeout(() => {
                window.print();
            }, 600);
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
                customers (name, type, email, phone, address),
                sales_locations (name, address)
            `)
            .eq('id', id)
            .single();

        // Fetch Items
        const { data: itemsData } = await supabase
            .from('sale_items')
            .select(`
                *,
                products (name, sku_or_barcode, brand, category)
            `)
            .eq('sale_id', id);

        setSale(saleData);
        setItems(itemsData || []);
        setLoading(false);
    };

    const handleMarkAsPaid = async () => {
        try {
            const { error } = await supabase
                .from('sales')
                .update({
                    payment_status: 'paid',
                    paid_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) {
                toast.error('Ödeme durumu güncellenemedi: ' + error.message);
            } else {
                toast.success('Alacak tahsil edildi olarak işaretlendi!');
                fetchDetail();
            }
        } catch (err) {
            toast.error(err.message);
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-500 font-medium">Fatura yükleniyor...</div>;
    if (!sale) return <div className="p-12 text-center text-red-500 font-medium">Satış kaydı bulunamadı.</div>;

    const invoiceNo = `STK-${sale.id.slice(0, 8).toUpperCase()}`;

    const getPaymentMethodLabel = (method) => {
        if (method === 'kredi_karti') return '💳 Kredi Kartı';
        if (method === 'havale') return '🏦 Havale / EFT';
        if (method === 'veresiye') return '⏳ Veresiye (Açık Hesap / Alacak)';
        return '💵 Nakit';
    };

    const isUnpaid = sale.payment_method === 'veresiye' && sale.payment_status === 'unpaid';

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            {/* Üst İşlem Butonları (Yazdırmada Gizlenir) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
                <Link to="/sales" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors font-medium text-sm py-1">
                    <ArrowLeft size={18} /> Satış Listesine Dön
                </Link>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                    {isUnpaid && (
                        <button
                            onClick={handleMarkAsPaid}
                            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-sm font-bold text-sm transition-all cursor-pointer"
                        >
                            <CheckCircle2 size={18} /> Tahsil Edildi Olarak İşaretle
                        </button>
                    )}
                    <button
                        onClick={() => window.print()}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl shadow-sm font-semibold text-sm transition-all cursor-pointer"
                    >
                        <Printer size={18} /> Faturayı Yazdır / PDF İndir
                    </button>
                </div>
            </div>

            {/* Fatura / Bilgi Fişi Belgesi */}
            <div
                className="bg-white p-8 sm:p-12 rounded-2xl shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0"
                id="invoice"
            >
                {/* 1. Fatura Başlığı & Firma Bilgisi */}
                <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-6 mb-8 gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <FileText size={28} />
                            <span className="text-xs font-bold tracking-widest uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                RESMİ SATIŞ FİŞİ & FATURA
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight uppercase">
                            {companyName}
                        </h1>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1">
                            {sale.sales_locations?.name ? `${sale.sales_locations.name} Şubesi` : 'Merkez'}
                            {sale.sales_locations?.address ? ` — ${sale.sales_locations.address}` : ''}
                        </p>
                    </div>

                    <div className="sm:text-right space-y-1">
                        <div className="bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                            <span className="text-xs text-slate-500 block">FATURA / BELGE NO:</span>
                            <span className="text-sm font-bold font-mono text-slate-900">{invoiceNo}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Tarih: <strong className="text-slate-800">{formatDate(sale.created_at)}</strong>
                        </p>
                    </div>
                </div>

                {/* 2. Müşteri & Satış Bilgileri Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-100 mb-8">
                    <div>
                        <h3 className="text-xs uppercase font-bold text-slate-400 mb-2 tracking-wider">MÜŞTERİ BİLGİLERİ</h3>
                        <p className="text-base font-bold text-slate-900">
                            {sale.customers?.name || 'MİSAFİR MÜŞTERİ'}
                        </p>
                        {sale.customers?.type && (
                            <span className="inline-block text-[10px] font-semibold uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded mt-1">
                                {sale.customers.type === 'şirket' ? 'Kurumsal Müşteri' : 'Bireysel Müşteri'}
                            </span>
                        )}
                        {sale.customers && (
                            <div className="text-xs text-slate-600 space-y-0.5 mt-2">
                                {sale.customers.phone && <p>📞 Tel: {sale.customers.phone}</p>}
                                {sale.customers.email && <p>✉️ E-posta: {sale.customers.email}</p>}
                                {sale.customers.address && <p>📍 Adres: {sale.customers.address}</p>}
                            </div>
                        )}
                    </div>

                    <div className="sm:text-right space-y-1">
                        <h3 className="text-xs uppercase font-bold text-slate-400 mb-2 tracking-wider">İŞLEM DETAYLARI</h3>
                        <p className="text-xs text-slate-600">
                            Satış Kanalı: <strong className="text-slate-800">{sale.sales_locations?.name || 'Standart'}</strong>
                        </p>
                        <p className="text-xs text-slate-600">
                            Ödeme Yöntemi: <strong className="text-slate-900">{getPaymentMethodLabel(sale.payment_method)}</strong>
                        </p>
                        <p className="text-xs text-slate-600">
                            Ödeme Durumu: {isUnpaid ? (
                                <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-bold">⏳ Bekliyor (Veresiye)</span>
                            ) : (
                                <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold">
                                    ✅ Ödendi {sale.paid_at ? `(${formatDate(sale.paid_at)})` : ''}
                                </span>
                            )}
                        </p>
                        <p className="text-xs text-slate-400 pt-2 font-mono">
                            Sistem ID: {sale.id}
                        </p>
                    </div>
                </div>

                {/* 3. Ürünler Tablosu */}
                <div className="overflow-x-auto mb-8">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900 text-white text-xs uppercase font-semibold">
                            <tr>
                                <th className="py-3 px-3 rounded-l-lg">#</th>
                                <th className="py-3 px-4">Ürün Açıklaması</th>
                                <th className="py-3 px-3 text-center">Barkod / SKU</th>
                                <th className="py-3 px-3 text-center">Miktar</th>
                                <th className="py-3 px-4 text-right">Birim Fiyat</th>
                                <th className="py-3 px-4 text-right rounded-r-lg">Tutar (TL)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {items.map((item, index) => (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                    <td className="py-3.5 px-3 text-xs text-slate-400 font-mono">{index + 1}</td>
                                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                                        {item.products?.name || 'Ürün'}
                                        {item.products?.brand && (
                                            <span className="text-xs text-slate-400 font-normal ml-2">({item.products.brand})</span>
                                        )}
                                        {item.original_currency && item.original_currency !== 'TL' && (
                                            <div className="text-[11px] text-blue-600 font-medium mt-0.5">
                                                Orijinal: {item.original_price} {CURRENCY_SYMBOLS[item.original_currency]} (Uygulanan Kur: {item.exchange_rate} ₺)
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-3.5 px-3 text-center text-xs text-slate-500 font-mono">
                                        {item.products?.sku_or_barcode || '-'}
                                    </td>
                                    <td className="py-3.5 px-3 text-center font-bold text-slate-900">
                                        {item.quantity} Adet
                                    </td>
                                    <td className="py-3.5 px-4 text-right">
                                        {formatCurrency(item.unit_price)}
                                    </td>
                                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                                        {formatCurrency(item.quantity * item.unit_price)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 4. Alt Toplamlar & Vergi Özeti */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-8 pt-4 border-t border-slate-200 mb-12">
                    <div className="text-xs text-slate-500 max-w-sm space-y-2">
                        <p className="font-semibold text-slate-700">Önemli Notlar:</p>
                        <p>• Bu belge teslim edilen ürünlerin satış bilgi fişi ve irsaliyesidir.</p>
                        <p>• Ürünler eksiksiz ve hasarsız olarak teslim alınmıştır.</p>
                    </div>

                    <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex justify-between items-center text-xs text-slate-600">
                            <span>Kalem Sayısı:</span>
                            <span className="font-bold text-slate-900">{items.length} Kalem</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-600">
                            <span>Toplam Ürün Adedi:</span>
                            <span className="font-bold text-slate-900">
                                {items.reduce((sum, i) => sum + i.quantity, 0)} Adet
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-600 border-t border-slate-200 pt-2">
                            <span>Ara Toplam:</span>
                            <span className="font-semibold text-slate-900">{formatCurrency(sale.total_amount)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>KDV (Dahil):</span>
                            <span>%20 Dahil</span>
                        </div>

                        {/* Varsa Döviz Eşdeğerleri */}
                        {items.some(i => i.original_currency && i.original_currency !== 'TL') && (
                            <div className="pt-2 border-t border-slate-200 text-xs text-blue-700">
                                <span className="block font-semibold mb-0.5">Dövizli Toplamlar:</span>
                                {Object.entries(items.reduce((acc, item) => {
                                    const curr = item.original_currency || 'TL';
                                    if (curr !== 'TL') {
                                        acc[curr] = (acc[curr] || 0) + (item.original_price * item.quantity);
                                    }
                                    return acc;
                                }, {})).map(([curr, amount]) => (
                                    <div key={curr} className="flex justify-between font-bold">
                                        <span>{curr}:</span>
                                        <span>{amount.toFixed(2)} {CURRENCY_SYMBOLS[curr]}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900 text-slate-900">
                            <span className="text-sm font-extrabold uppercase">Genel Toplam:</span>
                            <span className="text-xl font-extrabold text-blue-700">{formatCurrency(sale.total_amount)}</span>
                        </div>
                    </div>
                </div>

                {/* 5. Kaşe ve İmza Alanları */}
                <div className="grid grid-cols-2 gap-12 pt-8 border-t border-slate-200 text-center text-xs text-slate-600">
                    <div>
                        <p className="font-bold text-slate-800 mb-12">TESLİM EDEN (FİRMA YETKİLİSİ)</p>
                        <p className="border-t border-dashed border-slate-400 pt-2 mx-12">İmza / Kaşe</p>
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 mb-12">TESLİM ALAN (ALICI / MÜŞTERİ)</p>
                        <p className="border-t border-dashed border-slate-400 pt-2 mx-12">İmza</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaleDetail;
