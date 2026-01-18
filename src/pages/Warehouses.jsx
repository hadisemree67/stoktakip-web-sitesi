import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, MapPin } from 'lucide-react';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

const Warehouses = () => {
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        description: ''
    });

    useEffect(() => {
        fetchWarehouses();
    }, []);

    const fetchWarehouses = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('warehouses').select('*').order('created_at');
        if (error) toast.error('Depolar yüklenemedi');
        else setWarehouses(data);
        setLoading(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const { error } = editingId
            ? await supabase.from('warehouses').update(formData).eq('id', editingId)
            : await supabase.from('warehouses').insert([formData]);

        if (error) {
            toast.error(error.message);
        } else {
            toast.success(editingId ? 'Depo güncellendi' : 'Depo eklendi');
            setIsModalOpen(false);
            resetForm();
            fetchWarehouses();
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu depoyu silmek istediğinize emin misiniz?')) return;
        const { error } = await supabase.from('warehouses').delete().eq('id', id);
        if (error) toast.error('Silme başarısız oldu');
        else {
            toast.success('Depo silindi');
            setWarehouses(prev => prev.filter(w => w.id !== id));
        }
    };

    const openEdit = (wh) => {
        setFormData({ name: wh.name, location: wh.location, description: wh.description });
        setEditingId(wh.id);
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setFormData({ name: '', location: '', description: '' });
        setEditingId(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Depo Yönetimi</h1>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={20} /> Yeni Depo
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? <p>Yükleniyor...</p> : warehouses.map((wh) => (
                    <div key={wh.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative group">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(wh)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-blue-600 rounded-md">
                                <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDelete(wh.id)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-red-600 rounded-md">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <h3 className="text-lg font-bold text-slate-800 mb-2">{wh.name}</h3>
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-3">
                            <MapPin size={16} />
                            {wh.location}
                        </div>
                        <p className="text-slate-600 text-sm line-clamp-3">
                            {wh.description || 'Açıklama yok.'}
                        </p>
                    </div>
                ))}
                {!loading && warehouses.length === 0 && (
                    <p className="col-span-3 text-center text-slate-500">Henüz depo eklenmemiş.</p>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Depo Düzenle' : 'Yeni Depo Ekle'}
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Depo Adı</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Konum</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                        <textarea
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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

export default Warehouses;
