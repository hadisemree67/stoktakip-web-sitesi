import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, ArrowRight, ArrowDown, ArrowUp, ArrowRightLeft } from 'lucide-react';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { formatDate } from '../lib/utils';

const StockMovements = () => {
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form Data
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [formData, setFormData] = useState({
        product_id: '',
        from_warehouse_id: '',
        to_warehouse_id: '',
        type: 'in', // in, out, transfer
        quantity: 1,
        note: ''
    });

    useEffect(() => {
        fetchMovements();
        fetchOptions();
    }, []);

    const fetchOptions = async () => {
        const { data: p } = await supabase.from('products').select('id, name');
        const { data: w } = await supabase.from('warehouses').select('id, name');
        setProducts(p || []);
        setWarehouses(w || []);
        if (p?.[0]) setFormData(prev => ({ ...prev, product_id: p[0].id }));
        if (w?.[0]) setFormData(prev => ({ ...prev, from_warehouse_id: w[0].id, to_warehouse_id: w[0].id }));
    };

    const fetchMovements = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('stock_movements')
            .select(`
        *,
        products (name),
        from_warehouse:from_warehouse_id (name),
        to_warehouse:to_warehouse_id (name)
      `)
            .order('created_at', { ascending: false });

        if (error) toast.error('Hareketler yüklenemedi');
        else setMovements(data || []);
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Call the database function to handle logic safely
        // We assume a 'handle_stock_movement' RPC exists
        const payload = {
            p_product_id: formData.product_id,
            p_quantity: Number(formData.quantity),
            p_type: formData.type,
            p_from_warehouse_id: formData.type === 'in' ? null : formData.from_warehouse_id,
            p_to_warehouse_id: formData.type === 'out' ? null : formData.to_warehouse_id,
            p_note: formData.note
        };

        const { error } = await supabase.rpc('handle_stock_movement', payload);

        if (error) {
            toast.error('İşlem başarısız: ' + error.message);
        } else {
            toast.success('Stok hareketi kaydedildi');
            setIsModalOpen(false);
            setFormData(prev => ({ ...prev, quantity: 1, note: '' }));
            fetchMovements();
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'in': return <ArrowDown className="text-green-600" size={18} />;
            case 'out': return <ArrowUp className="text-red-600" size={18} />;
            case 'transfer': return <ArrowRightLeft className="text-blue-600" size={18} />;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Stok Hareketleri</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={20} /> Yeni Hareket
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Tarih</th>
                                <th className="px-6 py-4">Tip</th>
                                <th className="px-6 py-4">Ürün</th>
                                <th className="px-6 py-4">Kaynak / Hedef</th>
                                <th className="px-6 py-4 text-right">Miktar</th>
                                <th className="px-6 py-4">Not</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-8">Yükleniyor...</td></tr>
                            ) : movements.map((m) => (
                                <tr key={m.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap">{formatDate(m.created_at)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase
                      ${m.type === 'in' ? 'bg-green-100 text-green-700' :
                                                m.type === 'out' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {getTypeIcon(m.type)}
                                            {m.type === 'in' ? 'Giriş' : m.type === 'out' ? 'Çıkış' : 'Transfer'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium">{m.products?.name}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {m.type === 'in' ? '-' : m.from_warehouse?.name}
                                            <ArrowRight size={14} className="text-slate-400" />
                                            {m.type === 'out' ? '-' : m.to_warehouse?.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold">{m.quantity}</td>
                                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{m.note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Yeni Stok Hareketi"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Hareket Tipi</label>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            {['in', 'out', 'transfer'].map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, type: t }))}
                                    className={`flex-1 py-1.5 capitalize text-sm font-medium rounded-md transition-all ${formData.type === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {t === 'in' ? 'Giriş' : t === 'out' ? 'Çıkış' : 'Transfer'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ürün</label>
                        <select
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.product_id}
                            onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                        >
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    {formData.type !== 'in' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Çıkış Yapılacak Depo</label>
                            <select
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.from_warehouse_id}
                                onChange={(e) => setFormData({ ...formData, from_warehouse_id: e.target.value })}
                            >
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    )}

                    {formData.type !== 'out' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Giriş Yapılacak Depo</label>
                            <select
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.to_warehouse_id}
                                onChange={(e) => setFormData({ ...formData, to_warehouse_id: e.target.value })}
                            >
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Miktar</label>
                        <input
                            type="number"
                            required
                            min="1"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Not (Opsiyonel)</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.note}
                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                        Kaydet
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default StockMovements;
