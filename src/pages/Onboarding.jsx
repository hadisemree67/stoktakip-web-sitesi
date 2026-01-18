import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserCheck } from 'lucide-react';

const Onboarding = () => {
    const [fullName, setFullName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!fullName.trim()) return toast.error('Lütfen adınızı girin');
        if (!companyName.trim()) return toast.error('Lütfen şirket adını girin');

        setLoading(true);

        const { error } = await supabase.auth.updateUser({
            data: { full_name: fullName, company_name: companyName }
        });

        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Bilgileriniz kaydedildi, hoşgeldiniz!');
            // Force reload to update auth context or just navigate
            // Since AuthContext listens to changes, it should update.
            // But we might need to manually trigger a re-fetch or just redirect.
            window.location.href = '/dashboard';
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8">
                <div className="flex justify-center mb-4">
                    <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                        <UserCheck size={32} />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Hoşgeldiniz!</h2>
                <p className="text-center text-slate-500 mb-8">
                    Size daha iyi hitap edebilmemiz için lütfen adınızı ve soyadınızı belirtin.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Adınız Soyadınız</label>
                        <input
                            type="text"
                            required
                            placeholder="Örn: Ahmet Yılmaz"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Şirket Adı</label>
                        <input
                            type="text"
                            required
                            placeholder="Örn: Yılmaz Ticaret"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Kaydediliyor...' : 'Devam Et'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Onboarding;
