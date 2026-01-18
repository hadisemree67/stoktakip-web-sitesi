import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, Edit2, Trash2, Barcode } from 'lucide-react';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { formatCurrency } from '../lib/utils';

const Products = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        sku_or_barcode: '',
        category: '',
        brand: '',
        unit_price: '',
        wholesale_price: '',
        purchase_price: '',
        currency: 'TL'
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name');

        if (error) toast.error('Ürünler yüklenemedi');
        else setProducts(data);
        setLoading(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const { error } = editingId
            ? await supabase.from('products').update(formData).eq('id', editingId)
            : await supabase.from('products').insert([formData]);

        if (error) {
            toast.error(error.message);
        } else {
            toast.success(editingId ? 'Ürün güncellendi' : 'Ürün eklendi');
            setIsModalOpen(false);
            resetForm();
            fetchProducts();
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;

        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) toast.error('Silme başarısız oldu');
        else {
            toast.success('Ürün silindi');
            setProducts(prev => prev.filter(p => p.id !== id));
        }
    };

    const openEdit = (product) => {
        setFormData({
            name: product.name,
            sku_or_barcode: product.sku_or_barcode,
            category: product.category,
            brand: product.brand,
            unit_price: product.unit_price,
            wholesale_price: product.wholesale_price || 0,
            purchase_price: product.purchase_price || 0,
            currency: product.currency || 'TL'
        });
        setEditingId(product.id);
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setFormData({ name: '', sku_or_barcode: '', category: '', brand: '', unit_price: '', wholesale_price: '', purchase_price: '', currency: 'TL' });
        setEditingId(null);
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku_or_barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-800">Ürünler</h1>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={20} /> Yeni Ürün
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Ürün adı, barkod veya kategori..."
                            className="pl-10 pr-4 py-2 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Ürün Adı</th>
                                <th className="px-6 py-4">Barkod / SKU</th>
                                <th className="px-6 py-4">Kategori / Marka</th>
                                <th className="px-6 py-4">Alış Fiyatı</th>
                                <th className="px-6 py-4">Toptan Satış</th>
                                <th className="px-6 py-4">Perakende Satış</th>
                                <th className="px-6 py-4 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="7" className="text-center py-8">Yükleniyor...</td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan="7" className="text-center py-8">Ürün bulunamadı.</td></tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">{product.name}</td>
                                        <td className="px-6 py-4 flex items-center gap-2">
                                            <Barcode size={16} className="text-slate-400" /> {product.sku_or_barcode}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span>{product.category}</span>
                                                <span className="text-xs text-slate-400">{product.brand}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            {formatCurrency(product.purchase_price || 0, product.currency || 'TL')}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">
                                            {formatCurrency(product.wholesale_price || 0, product.currency || 'TL')}
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-slate-700">
                                            {formatCurrency(product.unit_price, product.currency || 'TL')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => openEdit(product)} className="p-2 hover:bg-slate-200 rounded-lg text-blue-600 transition-colors">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(product.id)} className="p-2 hover:bg-slate-200 rounded-lg text-red-600 transition-colors">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ürün Adı</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Barkod / SKU</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.sku_or_barcode}
                            onChange={(e) => setFormData({ ...formData, sku_or_barcode: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Marka</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.brand}
                                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Para Birimi</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.currency}
                            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        >
                            <option value="TL">Türk Lirası (₺)</option>
                            <option value="USD">Amerikan Doları ($)</option>
                            <option value="EUR">Euro (€)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Alış Fiyatı</label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.purchase_price}
                                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                                placeholder="Alış Fiyatı"
                            />
                            <span className="absolute right-3 top-2 text-slate-500 text-sm font-semibold">{formData.currency}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Perakende Satış</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.unit_price}
                                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                                    placeholder="Perakende"
                                />
                                <span className="absolute right-3 top-2 text-slate-500 text-sm font-semibold">{formData.currency}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Toptan Satış</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.wholesale_price}
                                    onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                                    placeholder="Toptan"
                                />
                                <span className="absolute right-3 top-2 text-slate-500 text-sm font-semibold">{formData.currency}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                        {editingId ? 'Güncelle' : 'Kaydet'}
                    </button>
                </form>
            </Modal>
        </div>
    );

};

export default Products;
