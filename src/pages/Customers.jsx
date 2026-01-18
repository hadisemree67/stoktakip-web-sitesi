import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

const Customers = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'bireysel',
        email: '',
        phone: '',
        address: ''
    });

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) toast.error('Müşteriler yüklenemedi');
        else setCustomers(data);
        setLoading(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const { error } = editingId
            ? await supabase.from('customers').update(formData).eq('id', editingId)
            : await supabase.from('customers').insert([formData]);

        if (error) {
            toast.error(error.message);
        } else {
            toast.success(editingId ? 'Müşteri güncellendi' : 'Müşteri eklendi');
            setIsModalOpen(false);
            resetForm();
            fetchCustomers();
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu müşteriyi silmek istediğinize emin misiniz?')) return;

        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) toast.error('Silme başarısız oldu');
        else {
            toast.success('Müşteri silindi');
            setCustomers(prev => prev.filter(c => c.id !== id));
        }
    };

    const openEdit = (customer) => {
        setFormData({
            name: customer.name,
            type: customer.type,
            email: customer.email,
            phone: customer.phone,
            address: customer.address
        });
        setEditingId(customer.id);
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setFormData({ name: '', type: 'bireysel', email: '', phone: '', address: '' });
        setEditingId(null);
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-800">Müşteriler</h1>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={20} /> Yeni Müşteri
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="İsim veya e-posta ara..."
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
                                <th className="px-6 py-4">Müşteri Adı</th>
                                <th className="px-6 py-4">Tip</th>
                                <th className="px-6 py-4">İletişim</th>
                                <th className="px-6 py-4">Adres</th>
                                <th className="px-6 py-4 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-8">Yükleniyor...</td></tr>
                            ) : filteredCustomers.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-8">Kayıt bulunamadı.</td></tr>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">{customer.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${customer.type === 'şirket' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {customer.type === 'şirket' ? 'KURUMSAL' : 'BİREYSEL'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span>{customer.email}</span>
                                                <span className="text-xs text-slate-400">{customer.phone}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 truncate max-w-xs">{customer.address}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => openEdit(customer)} className="p-2 hover:bg-slate-200 rounded-lg text-blue-600 transition-colors">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(customer.id)} className="p-2 hover:bg-slate-200 rounded-lg text-red-600 transition-colors">
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
                title={editingId ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle'}
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri Adı / Ünvanı</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tip</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="bireysel">Bireysel</option>
                            <option value="şirket">Şirket</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-xs text-slate-400 font-normal">(İsteğe Bağlı)</span></label>
                            <input
                                type="email"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Telefon <span className="text-xs text-slate-400 font-normal">(İsteğe Bağlı)</span></label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Adres <span className="text-xs text-slate-400 font-normal">(İsteğe Bağlı)</span></label>
                        <textarea
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        ></textarea>
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

export default Customers;
