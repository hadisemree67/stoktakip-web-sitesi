import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
    Search, DollarSign, Users, CheckCircle2, Clock,
    ArrowUpRight, ArrowDownRight, Phone, Calendar,
    FileText, User, ChevronRight, AlertCircle, Printer,
    CreditCard, Building2, Wallet, Plus, X, ArrowLeft
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';

const VeresiyeDefteri = () => {
    const [searchParams] = useSearchParams();
    const targetCustomerId = searchParams.get('customerId') || searchParams.get('customer');

    // Veriler
    const [customers, setCustomers] = useState([]);
    const [sales, setSales] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filtreleme & Arama
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('with_debt'); // 'with_debt', 'all', 'payments_history'
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [activeTab, setActiveTab] = useState('sales'); // 'sales', 'payments'

    // Ödeme Alma Modalı State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentCustomerId, setPaymentCustomerId] = useState('');
    const [paymentSaleId, setPaymentSaleId] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('nakit');
    const [paymentNote, setPaymentNote] = useState('');
    const [submittingPayment, setSubmittingPayment] = useState(false);

    useEffect(() => {
        fetchLedgerData();
    }, []);

    // Query parametresinden gelen müşteriyi otomatik seç
    useEffect(() => {
        if (targetCustomerId && customers.length > 0) {
            const found = customers.find(c => String(c.id) === String(targetCustomerId));
            if (found) {
                setSelectedCustomer(found);
            }
        }
    }, [targetCustomerId, customers]);

    const fetchLedgerData = async () => {
        setLoading(true);
        try {
            // Paralel sorgulama ile hızlı veri çekimi
            const [custRes, salesRes, paymentsRes] = await Promise.all([
                supabase.from('customers').select('*').order('name', { ascending: true }),
                supabase.from('sales')
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
                        sale_items (
                            quantity,
                            unit_price,
                            products (name)
                        )
                    `)
                    .eq('payment_method', 'veresiye')
                    .order('created_at', { ascending: false }),
                supabase.from('customer_payments')
                    .select(`
                        id,
                        customer_id,
                        sale_id,
                        amount,
                        payment_method,
                        note,
                        created_at,
                        customers (name, phone)
                    `)
                    .order('created_at', { ascending: false })
            ]);

            setCustomers(custRes.data || []);
            setSales(salesRes.data || []);
            setPayments(paymentsRes.data || []);

            // Eğer bir müşteri seçiliyse güncel verisini yenile
            if (selectedCustomer) {
                const updatedCust = (custRes.data || []).find(c => c.id === selectedCustomer.id);
                if (updatedCust) setSelectedCustomer(updatedCust);
            }
        } catch (err) {
            console.error('Veresiye defteri yüklenirken hata:', err);
            toast.error('Veriler yüklenemedi: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Müşteri bazlı borç ve alacak hesaplamaları
    const customerStats = useMemo(() => {
        const stats = {};

        // Önce her müşteriyi 0 ile başlat
        customers.forEach(c => {
            stats[c.id] = {
                totalSales: 0,
                totalPaid: 0,
                remainingDebt: 0,
                unpaidSalesCount: 0,
                salesList: [],
                paymentsList: []
            };
        });

        // Veresiye Satışlarını eşle
        sales.forEach(sale => {
            if (!sale.customer_id) return;
            if (!stats[sale.customer_id]) {
                stats[sale.customer_id] = {
                    totalSales: 0,
                    totalPaid: 0,
                    remainingDebt: 0,
                    unpaidSalesCount: 0,
                    salesList: [],
                    paymentsList: []
                };
            }

            const total = Number(sale.total_amount) || 0;
            // Kolonlar yoksa payment_status'e göre hesapla
            let paid = 0;
            if (sale.paid_amount !== undefined && sale.paid_amount !== null) {
                paid = Number(sale.paid_amount) || 0;
            } else if (sale.payment_status === 'paid') {
                paid = total;
            }

            const remaining = Math.max(0, total - paid);

            stats[sale.customer_id].totalSales += total;
            stats[sale.customer_id].totalPaid += paid;
            stats[sale.customer_id].remainingDebt += remaining;

            if (remaining > 0) {
                stats[sale.customer_id].unpaidSalesCount += 1;
            }

            stats[sale.customer_id].salesList.push({
                ...sale,
                calculatedTotal: total,
                calculatedPaid: paid,
                calculatedRemaining: remaining
            });
        });

        // Tahsilatları eşle
        payments.forEach(pay => {
            if (!pay.customer_id) return;
            if (stats[pay.customer_id]) {
                stats[pay.customer_id].paymentsList.push(pay);
            }
        });

        return stats;
    }, [customers, sales, payments]);

    // Genel Toplamlar
    const overallStats = useMemo(() => {
        let totalDebt = 0;
        let totalCollected = 0;
        let debtorCount = 0;

        Object.values(customerStats).forEach(s => {
            totalDebt += s.remainingDebt;
            totalCollected += s.totalPaid;
            if (s.remainingDebt > 0) debtorCount++;
        });

        return { totalDebt, totalCollected, debtorCount };
    }, [customerStats]);

    // Filtrelenmiş Müşteriler
    const filteredCustomers = useMemo(() => {
        return customers.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.phone && c.phone.includes(searchTerm));

            if (!matchesSearch) return false;

            const cDebt = customerStats[c.id]?.remainingDebt || 0;
            if (filterType === 'with_debt') return cDebt > 0;
            return true;
        }).sort((a, b) => {
            // Borcu en çok olan en üstte gözüksün
            const debtA = customerStats[a.id]?.remainingDebt || 0;
            const debtB = customerStats[b.id]?.remainingDebt || 0;
            return debtB - debtA;
        });
    }, [customers, searchTerm, filterType, customerStats]);

    // Ödeme Alma / Tahsilat İşlemi
    const handleMakePayment = async (e) => {
        e.preventDefault();
        const amountNum = parseFloat(paymentAmount);

        if (!paymentCustomerId) {
            return toast.error('Lütfen bir müşteri seçin!');
        }
        if (isNaN(amountNum) || amountNum <= 0) {
            return toast.error('Lütfen geçerli bir ödeme tutarı girin!');
        }

        const targetCustStats = customerStats[paymentCustomerId];
        const currentDebt = targetCustStats?.remainingDebt || 0;

        if (currentDebt <= 0 && !paymentSaleId) {
            return toast.error('Bu müşterinin şu anda bekleyen veresiye borcu bulunmuyor.');
        }

        setSubmittingPayment(true);
        const toastId = toast.loading('Ödeme kaydediliyor ve borçtan düşülüyor...');

        try {
            // 1. Önce Veritabanı Fonksiyonunu (RPC) Dene
            let rpcSuccess = false;
            try {
                const { data, error } = await supabase.rpc('record_customer_payment', {
                    p_customer_id: paymentCustomerId,
                    p_amount: amountNum,
                    p_payment_method: paymentMethod,
                    p_note: paymentNote.trim() || null,
                    p_sale_id: paymentSaleId || null
                });

                if (!error) {
                    rpcSuccess = true;
                }
            } catch (rpcErr) {
                console.log('RPC henüz eklenmemiş, fallback uygulanıyor...');
            }

            // 2. Fallback: Eğer RPC henüz çalıştırılmadıysa istemci tarafında borçtan düş
            if (!rpcSuccess) {
                // A) Tahsilat tablosuna ekle
                try {
                    await supabase.from('customer_payments').insert([{
                        customer_id: paymentCustomerId,
                        sale_id: paymentSaleId || null,
                        amount: amountNum,
                        payment_method: paymentMethod,
                        note: paymentNote.trim() || null
                    }]);
                } catch (payErr) {
                    console.log('customer_payments insert note:', payErr);
                }

                // B) İlgili satışların borcunu en eskiden yeniye doğru kapat
                let remainingPay = amountNum;
                const custSales = (targetCustStats?.salesList || [])
                    .filter(s => paymentSaleId ? s.id === paymentSaleId : s.calculatedRemaining > 0)
                    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                for (const s of custSales) {
                    if (remainingPay <= 0) break;

                    const curRemaining = s.calculatedRemaining;
                    if (remainingPay >= curRemaining) {
                        // Satışı tamamen kapat
                        await supabase.from('sales').update({
                            paid_amount: s.calculatedTotal,
                            remaining_amount: 0,
                            payment_status: 'paid',
                            paid_at: new Date().toISOString()
                        }).eq('id', s.id);

                        remainingPay -= curRemaining;
                    } else {
                        // Kısmi ödeme yap
                        const newPaid = s.calculatedPaid + remainingPay;
                        await supabase.from('sales').update({
                            paid_amount: newPaid,
                            remaining_amount: Math.max(0, s.calculatedTotal - newPaid),
                            payment_status: 'partial'
                        }).eq('id', s.id);

                        remainingPay = 0;
                    }
                }
            }

            toast.dismiss(toastId);
            toast.success(`${formatCurrency(amountNum)} tutarında tahsilat kaydedildi ve borçtan düşüldü!`, { duration: 4000 });
            
            // Modalı kapat ve verileri yenile
            setIsPaymentModalOpen(false);
            setPaymentAmount('');
            setPaymentNote('');
            setPaymentSaleId(null);
            fetchLedgerData();

        } catch (err) {
            toast.dismiss(toastId);
            toast.error('Ödeme işlemi başarısız: ' + err.message);
        } finally {
            setSubmittingPayment(false);
        }
    };

    // Hızlı Ödeme Modalını Aç
    const openPaymentModal = (customer, specificSale = null) => {
        setPaymentCustomerId(customer.id);
        setSelectedCustomer(customer);
        setPaymentSaleId(specificSale ? specificSale.id : null);
        
        if (specificSale) {
            setPaymentAmount(specificSale.calculatedRemaining.toString());
            setPaymentNote(`Fiş #${specificSale.id.slice(0, 8).toUpperCase()} ödemesi`);
        } else {
            const currentDebt = customerStats[customer.id]?.remainingDebt || 0;
            setPaymentAmount(currentDebt > 0 ? currentDebt.toString() : '');
            setPaymentNote('');
        }

        setIsPaymentModalOpen(true);
    };

    // Müşteri Ekstresini WhatsApp veya Panoya Kopyalama
    const handleCopyStatement = (customer) => {
        const stats = customerStats[customer.id];
        if (!stats) return;

        let text = `📋 *VERESİYE HESAP EKSTRESİ*\n`;
        text += `👤 *Müşteri:* ${customer.name}\n`;
        if (customer.phone) text += `📞 *Tel:* ${customer.phone}\n`;
        text += `📅 *Tarih:* ${formatDate(new Date())}\n`;
        text += `--------------------------------\n`;
        text += `💰 *Toplam Alışveriş:* ${formatCurrency(stats.totalSales)}\n`;
        text += `✅ *Toplam Ödenen:* ${formatCurrency(stats.totalPaid)}\n`;
        text += `⚠️ *GÜNCEL KALAN BORÇ:* ${formatCurrency(stats.remainingDebt)}\n`;
        text += `--------------------------------\n`;
        text += `*Açık Fişler:*\n`;

        const openSales = stats.salesList.filter(s => s.calculatedRemaining > 0);
        if (openSales.length === 0) {
            text += `Açık borç bulunmamaktadır. Teşekkür ederiz!`;
        } else {
            openSales.forEach((s, idx) => {
                text += `${idx + 1}) ${formatDate(s.created_at)} - Tutar: ${formatCurrency(s.calculatedTotal)} | Kalan: ${formatCurrency(s.calculatedRemaining)}\n`;
            });
        }

        navigator.clipboard.writeText(text);
        toast.success('Hesap ekstresi panoya kopyalandı! WhatsApp veya SMS ile gönderebilirsiniz.');
    };

    if (loading) return <div className="p-12 text-center text-slate-500 font-medium">Veresiye Defteri yükleniyor...</div>;

    const selectedCustStats = selectedCustomer ? customerStats[selectedCustomer.id] : null;

    return (
        <div className="space-y-6 pb-8">
            {/* 1. Üst Başlık & Eylemler */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <span>📒</span> Veresiye Defteri
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        Müşteri açık hesapları, veresiye satışları ve parça parça tahsilat takibi
                    </p>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => {
                            if (customers.length === 0) return toast.error('Önce müşteri eklemelisiniz.');
                            const firstDebtor = customers.find(c => (customerStats[c.id]?.remainingDebt || 0) > 0);
                            openPaymentModal(firstDebtor || customers[0]);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer w-full sm:w-auto"
                    >
                        <Plus size={18} />
                        <span>Hızlı Tahsilat / Ödeme Al</span>
                    </button>
                </div>
            </div>

            {/* 2. Finansal Özet Kartları */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Toplam Açık Veresiye */}
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between opacity-90 mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider">Toplam Açık Alacak</span>
                        <div className="p-2 bg-white/20 rounded-xl">
                            <Clock size={20} />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            {formatCurrency(overallStats.totalDebt)}
                        </h2>
                        <p className="text-xs text-amber-100 font-medium mt-1">
                            Piyasada bekleyen toplam veresiye bakiyesi
                        </p>
                    </div>
                </div>

                {/* Borçlu Müşteri Sayısı */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Borçlu Müşteriler</span>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Users size={20} />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            {overallStats.debtorCount} <span className="text-base font-semibold text-slate-500">Müşteri</span>
                        </h2>
                        <p className="text-xs text-slate-400 font-medium mt-1">
                            Kayıtlı toplam {customers.length} müşteriden
                        </p>
                    </div>
                </div>

                {/* Toplam Tahsil Edilen */}
                <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm bg-gradient-to-br from-white to-emerald-50/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Toplam Tahsil Edilen</span>
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                            <CheckCircle2 size={20} />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
                            {formatCurrency(overallStats.totalCollected)}
                        </h2>
                        <p className="text-xs text-slate-400 font-medium mt-1">
                            Bugüne kadar veresiyeden tahsil edilen para
                        </p>
                    </div>
                </div>
            </div>

            {/* 3. Ana İçerik: Müşteri Arama & Detay Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* SOL SÜTUN: Müşteri Listesi & Arama (5 Kolon) */}
                <div className={`lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden ${selectedCustomer ? 'hidden lg:flex' : 'flex'}`}>
                    {/* Arama & Sekmeler */}
                    <div className="p-4 border-b border-slate-100 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Müşteri adı veya telefon ara..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Filtre Sekmeleri */}
                        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setFilterType('with_debt')}
                                className={`flex-1 py-1.5 rounded-lg transition-all ${filterType === 'with_debt' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Borcu Olanlar ({customers.filter(c => (customerStats[c.id]?.remainingDebt || 0) > 0).length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterType('all')}
                                className={`flex-1 py-1.5 rounded-lg transition-all ${filterType === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Tümü ({customers.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterType('payments_history')}
                                className={`flex-1 py-1.5 rounded-lg transition-all ${filterType === 'payments_history' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Tahsilatlar ({payments.length})
                            </button>
                        </div>
                    </div>

                    {/* Liste İçeriği */}
                    <div className="overflow-y-auto max-h-[600px] divide-y divide-slate-100">
                        {filterType === 'payments_history' ? (
                            /* Son Tahsilatlar Listesi */
                            payments.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-xs">Henüz tahsilat kaydı bulunmuyor.</div>
                            ) : (
                                payments.map((pay) => (
                                    <div key={pay.id} className="p-3.5 hover:bg-slate-50 transition-colors flex justify-between items-center text-xs">
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm">{pay.customers?.name || 'Müşteri'}</p>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                                <span>{formatDate(pay.created_at)}</span>
                                                <span className="capitalize">• {pay.payment_method}</span>
                                            </div>
                                            {pay.note && <p className="text-[11px] text-slate-500 italic mt-0.5">"{pay.note}"</p>}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-emerald-700 font-extrabold text-sm block">
                                                +{formatCurrency(pay.amount)}
                                            </span>
                                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                                                Tahsil Edildi
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )
                        ) : (
                            /* Müşteriler Listesi */
                            filteredCustomers.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-xs">
                                    {filterType === 'with_debt' ? 'Borcu olan müşteri bulunmuyor.' : 'Müşteri bulunamadı.'}
                                </div>
                            ) : (
                                filteredCustomers.map((c) => {
                                    const stats = customerStats[c.id];
                                    const hasDebt = (stats?.remainingDebt || 0) > 0;
                                    const isSelected = selectedCustomer?.id === c.id;

                                    return (
                                        <div
                                            key={c.id}
                                            onClick={() => setSelectedCustomer(c)}
                                            className={`p-3.5 cursor-pointer transition-all flex items-center justify-between border-l-4 ${
                                                isSelected
                                                    ? 'bg-indigo-50/60 border-l-indigo-600'
                                                    : hasDebt
                                                    ? 'hover:bg-slate-50 border-l-amber-500'
                                                    : 'hover:bg-slate-50 border-l-transparent'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0 pr-3">
                                                <div className="flex items-center gap-1.5">
                                                    <h4 className="font-bold text-slate-900 text-sm truncate">{c.name}</h4>
                                                    {c.type === 'şirket' && (
                                                        <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold uppercase">Kurumsal</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {c.phone ? `📞 ${c.phone}` : 'Telefon yok'}
                                                    {stats?.unpaidSalesCount > 0 && (
                                                        <span className="ml-2 text-amber-700 font-semibold">• {stats.unpaidSalesCount} Açık Borç Kaydı</span>
                                                    )}
                                                </p>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className={`text-sm font-extrabold block ${hasDebt ? 'text-amber-700' : 'text-slate-400'}`}>
                                                    {formatCurrency(stats?.remainingDebt || 0)}
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                                                    hasDebt ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {hasDebt ? 'Borçlu' : 'Borcu Yok'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )
                        )}
                    </div>
                </div>

                {/* SAĞ SÜTUN: Seçili Müşterinin Veresiye Defteri & Ekstresi (7 Kolon) */}
                <div className={`lg:col-span-7 flex flex-col gap-4 ${selectedCustomer ? 'flex' : 'hidden lg:flex'}`}>
                    {selectedCustomer ? (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            {/* Mobilde Geri Dön Butonu */}
                            <div className="lg:hidden p-3 bg-slate-100 border-b border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setSelectedCustomer(null)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer"
                                >
                                    <ArrowLeft size={16} /> Müşteri Listesine Dön
                                </button>
                            </div>

                            {/* Müşteri Başlık Kartı */}
                            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-black">{selectedCustomer.name}</h3>
                                        <span className="text-[10px] uppercase font-bold bg-white/20 px-2 py-0.5 rounded">
                                            {selectedCustomer.type || 'Müşteri'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-300 space-x-3 mt-1">
                                        {selectedCustomer.phone && <span>📞 {selectedCustomer.phone}</span>}
                                        {selectedCustomer.email && <span>✉️ {selectedCustomer.email}</span>}
                                    </div>
                                </div>

                                <div className="sm:text-right bg-white/10 p-3 rounded-xl border border-white/10 w-full sm:w-auto">
                                    <span className="text-[11px] text-amber-300 font-bold block uppercase tracking-wider">GÜNCEL KALAN BORÇ</span>
                                    <span className="text-2xl font-black text-white">
                                        {formatCurrency(selectedCustStats?.remainingDebt || 0)}
                                    </span>
                                </div>
                            </div>

                            {/* Müşteri Hızlı İşlem Butonları */}
                            <div className="p-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openPaymentModal(selectedCustomer)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                    >
                                        <Plus size={16} />
                                        <span>Ödeme Al / Borç Düş</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleCopyStatement(selectedCustomer)}
                                        className="bg-white hover:bg-slate-100 text-slate-700 font-semibold px-3 py-2 rounded-xl border border-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
                                        title="Ekstre metnini WhatsApp veya SMS için kopyala"
                                    >
                                        <FileText size={16} />
                                        <span>Ekstreyi Kopyala</span>
                                    </button>
                                </div>

                                <div className="text-slate-500 text-xs">
                                    Toplam Alışveriş: <strong className="text-slate-800">{formatCurrency(selectedCustStats?.totalSales || 0)}</strong>
                                </div>
                            </div>

                            {/* Sekmeler: Veresiye Alışverişleri vs. Yapılan Ödemeler */}
                            <div className="flex border-b border-slate-100 text-xs font-bold bg-white">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('sales')}
                                    className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
                                        activeTab === 'sales'
                                            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Veresiye Alışverişleri ({selectedCustStats?.salesList.length || 0})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('payments')}
                                    className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
                                        activeTab === 'payments'
                                            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Tahsilat / Ödeme Geçmişi ({selectedCustStats?.paymentsList.length || 0})
                                </button>
                            </div>

                            {/* Sekme 1: Veresiye Alışverişleri */}
                            {activeTab === 'sales' && (
                                <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                                    {selectedCustStats?.salesList.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 text-xs">
                                            Bu müşteriye ait veresiye satışı bulunmuyor.
                                        </div>
                                    ) : (
                                        selectedCustStats?.salesList.map((sale) => {
                                            const isPaid = sale.calculatedRemaining <= 0;
                                            return (
                                                <div
                                                    key={sale.id}
                                                    className={`p-3.5 rounded-xl border transition-all text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                                                        isPaid
                                                            ? 'bg-slate-50/60 border-slate-200 opacity-75'
                                                            : 'bg-white border-amber-200 shadow-xs'
                                                    }`}
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Link
                                                                to={`/sales/${sale.id}`}
                                                                className="font-mono font-bold text-indigo-600 hover:underline"
                                                            >
                                                                #{sale.id.slice(0, 8).toUpperCase()}
                                                            </Link>
                                                            <span className="text-slate-400">• {formatDate(sale.created_at)}</span>
                                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                                                isPaid
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : sale.calculatedPaid > 0
                                                                    ? 'bg-blue-100 text-blue-800'
                                                                    : 'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {isPaid ? '✅ Tamamen Ödendi' : sale.calculatedPaid > 0 ? '🟡 Kısmi Ödendi' : '⏳ Bekliyor'}
                                                            </span>
                                                        </div>

                                                        {/* Kalemler */}
                                                        <div className="text-[11px] text-slate-600">
                                                            {sale.sale_items?.map((it, i) => (
                                                                <span key={i} className="mr-2">
                                                                    {it.quantity}x {it.products?.name || 'Ürün'}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Tutarlar & Fişi Kapat Butonu */}
                                                    <div className="flex items-center gap-3 self-end sm:self-center">
                                                        <div className="text-right">
                                                            <div className="text-slate-400 text-[10px]">
                                                                Tutar: {formatCurrency(sale.calculatedTotal)}
                                                            </div>
                                                            <div className={`font-black text-sm ${isPaid ? 'text-slate-400' : 'text-amber-800'}`}>
                                                                Kalan: {formatCurrency(sale.calculatedRemaining)}
                                                            </div>
                                                        </div>

                                                        {!isPaid && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openPaymentModal(selectedCustomer, sale)}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer shadow-xs"
                                                                title="Sadece bu fişin borcunu öde"
                                                            >
                                                                Öde
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* Sekme 2: Yapılan Ödemeler / Tahsilat Geçmişi */}
                            {activeTab === 'payments' && (
                                <div className="p-4 space-y-2.5 max-h-[500px] overflow-y-auto">
                                    {selectedCustStats?.paymentsList.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 text-xs">
                                            Henüz bu müşteriye ait kaydedilmiş ödeme bulunmuyor.
                                        </div>
                                    ) : (
                                        selectedCustStats?.paymentsList.map((pay) => (
                                            <div
                                                key={pay.id}
                                                className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl text-xs flex justify-between items-center"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-extrabold text-emerald-800 text-sm">
                                                            +{formatCurrency(pay.amount)}
                                                        </span>
                                                        <span className="text-[10px] bg-white border border-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase">
                                                            {pay.payment_method}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                        {formatDate(pay.created_at)}
                                                        {pay.note && <span className="ml-2 italic text-slate-700">— "{pay.note}"</span>}
                                                    </p>
                                                </div>
                                                <span className="text-emerald-600 text-xs font-bold">Tahsil Edildi</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Müşteri Seçilmediğinde Gösterilecek Boş Durum */
                        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[350px]">
                            <div className="p-4 bg-slate-100 text-slate-500 rounded-2xl mb-3">
                                <User size={36} />
                            </div>
                            <h3 className="font-bold text-slate-700 text-base">Müşteri Seçin</h3>
                            <p className="text-xs text-slate-400 max-w-xs mt-1">
                                Sol taraftaki listeden bir müşteri seçerek veresiye alışverişlerini, güncel borcunu ve ödeme geçmişini inceleyebilirsiniz.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. Ödeme Alma / Tahsilat Modalı */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => {
                    if (!submittingPayment) {
                        setIsPaymentModalOpen(false);
                        setPaymentSaleId(null);
                    }
                }}
                title={paymentSaleId ? 'Fişe Özel Ödeme Al' : 'Veresiye Tahsilatı / Borç Düşme'}
            >
                <form onSubmit={handleMakePayment} className="space-y-4 text-xs">
                    {/* Müşteri Seçimi / Bilgisi */}
                    <div>
                        <label className="block font-semibold text-slate-600 mb-1">Müşteri</label>
                        <select
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={paymentCustomerId}
                            onChange={(e) => {
                                setPaymentCustomerId(e.target.value);
                                const found = customers.find(c => c.id === e.target.value);
                                if (found) setSelectedCustomer(found);
                            }}
                            disabled={!!paymentSaleId}
                        >
                            <option value="">Müşteri Seçiniz...</option>
                            {customers.map(c => {
                                const debt = customerStats[c.id]?.remainingDebt || 0;
                                return (
                                    <option key={c.id} value={c.id}>
                                        {c.name} {debt > 0 ? `(Borç: ${formatCurrency(debt)})` : '(Borcu Yok)'}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Güncel Borç Bilgi Kutusu */}
                    {paymentCustomerId && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex justify-between items-center text-amber-900">
                            <div>
                                <span className="text-[11px] block font-semibold text-amber-700">MÜŞTERİNİN TOPLAM BORCU:</span>
                                <span className="text-lg font-black">{formatCurrency(customerStats[paymentCustomerId]?.remainingDebt || 0)}</span>
                            </div>
                            {customerStats[paymentCustomerId]?.remainingDebt > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setPaymentAmount(customerStats[paymentCustomerId].remainingDebt.toString())}
                                    className="text-[11px] bg-white border border-amber-300 text-amber-900 px-2 py-1 rounded-lg font-bold hover:bg-amber-100 transition-colors"
                                >
                                    Tümünü Kapat
                                </button>
                            )}
                        </div>
                    )}

                    {/* Ödeme Tutarı */}
                    <div>
                        <label className="block font-semibold text-slate-600 mb-1">
                            Alınan Ödeme Tutarı (₺) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-base font-black text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            required
                        />
                    </div>

                    {/* Ödeme Yöntemi */}
                    <div>
                        <label className="block font-semibold text-slate-600 mb-1.5">Tahsilat Yöntemi</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('nakit')}
                                className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                                    paymentMethod === 'nakit'
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <Wallet size={16} /> Nakit
                            </button>

                            <button
                                type="button"
                                onClick={() => setPaymentMethod('kredi_karti')}
                                className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                                    paymentMethod === 'kredi_karti'
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <CreditCard size={16} /> Kart
                            </button>

                            <button
                                type="button"
                                onClick={() => setPaymentMethod('havale')}
                                className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                                    paymentMethod === 'havale'
                                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <Building2 size={16} /> Havale
                            </button>
                        </div>
                    </div>

                    {/* Açıklama / Not */}
                    <div>
                        <label className="block font-semibold text-slate-600 mb-1">Açıklama / Not (Opsiyonel)</label>
                        <input
                            type="text"
                            placeholder="Örn: Elden teslim etti / Kısmi ödeme"
                            className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                        />
                    </div>

                    {/* Gönder Butonu */}
                    <button
                        type="submit"
                        disabled={submittingPayment}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold py-3 rounded-xl text-sm shadow-md transition-all cursor-pointer mt-2"
                    >
                        {submittingPayment ? 'İşleniyor...' : 'Tahsilatı Onayla & Borçtan Düş'}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default VeresiyeDefteri;
