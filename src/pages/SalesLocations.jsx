import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Store } from 'lucide-react';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

const SalesLocations = () => {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'mağaza',
        address: ''
    });

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('sales_locations').select('*').order('created_at');
        if (error) toast.error('Lokasyonlar yüklenemedi');
        else setLocations(data);
        setLoading(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const { error } = editingId
            ? await supabase.from('sales_locations').update(formData).eq('id', editingId)
            : await supabase.from('sales_locations').insert([formData]);

        if (error) {
            toast.error(error.message);
        } else {
            toast.success(editingId ? 'Lokasyon güncellendi' : 'Lokasyon eklendi');
            setIsModalOpen(false);
            resetForm();
            fetchLocations();
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu lokasyonu silmek istediğinize emin misiniz?')) return;
        const { error } = await supabase.from('sales_locations').delete().eq('id', id);
        if (error) toast.error('Silme başarısız oldu');
        else {
            toast.success('Lokasyon silindi');
            setLocations(prev => prev.filter(l => l.id !== id));
        }
    };

    const openEdit = (loc) => {
        setFormData({ name: loc.name, type: loc.type, address: loc.address });
        setEditingId(loc.id);
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setFormData({ name: '', type: 'mağaza', address: '' });
        setEditingId(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Satış Lokasyonları</h1>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={20} /> Yeni Lokasyon
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? <p>Yükleniyor...</p> : locations.map((loc) => (
                    <div key={loc.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative group">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(loc)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-blue-600 rounded-md">
                                <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDelete(loc.id)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-red-600 rounded-md">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Store size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">{loc.name}</h3>
                                <span className="text-xs uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                                    {loc.type}
                                </span>
                            </div>
                        </div>

                        <p className="text-slate-600 text-sm">
                            {loc.address || 'Adres girilmemiş.'}
                        </p>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Lokasyon Düzenle' : 'Yeni Lokasyon Ekle'}
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Lokasyon Adı</label>
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
                            <option value="mağaza">Mağaza</option>
                            <option value="online">Online</option>
                            <option value="bayi">Bayi</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                        <textarea
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        ></textarea>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors">
                        {editingId ? 'Güncelle' : 'Kaydet'}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default SalesLocations;
