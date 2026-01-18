import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Register = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await signUp({ email, password });
        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Kayıt başarılı! Giriş yapabilirsiniz.');
            navigate('/login');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8">
                <h2 className="text-3xl font-bold text-center text-slate-800 mb-2">Kayıt Ol</h2>
                <p className="text-center text-slate-500 mb-8">Yeni bir hesap oluşturun</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Kayıt Olunuyor...' : 'Kayıt Ol'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-600">
                    Zaten hesabınız var mı?{' '}
                    <Link to="/login" className="text-blue-600 hover:underline font-medium">
                        Giriş Yap
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
