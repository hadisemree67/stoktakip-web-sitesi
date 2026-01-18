import { useAuth } from '../context/AuthContext';
import { LogOut, User } from 'lucide-react';

const Topbar = () => {
    const { user, signOut } = useAuth();

    return (
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 fixed top-0 right-0 left-0 md:left-64 z-10 shadow-sm">
            <div className="text-slate-500 text-sm hidden md:block">
                Hoşgeldin, <span className="font-semibold text-slate-800">{user?.user_metadata?.full_name || user?.email}</span>
            </div>
            <div className="md:hidden font-bold text-slate-900">
                StokTakip
            </div>
            <button
                onClick={signOut}
                className="flex items-center gap-2 text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-2 rounded-md transition-colors"
            >
                <LogOut size={16} />
                Çıkış Yap
            </button>
        </header>
    );
};

export default Topbar;
