import { useAuth } from '../context/AuthContext';
import { LogOut, Menu } from 'lucide-react';

const Topbar = ({ onOpenMobileMenu }) => {
    const { user, signOut } = useAuth();

    return (
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 fixed top-0 right-0 left-0 md:left-64 z-30 shadow-xs pt-[env(safe-area-inset-top)]">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onOpenMobileMenu}
                    className="md:hidden p-2 -ml-1 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Menü"
                >
                    <Menu size={22} />
                </button>
                <div className="text-slate-500 text-sm hidden md:block">
                    Hoşgeldin, <span className="font-semibold text-slate-800">{user?.user_metadata?.full_name || user?.email}</span>
                </div>
                <div className="md:hidden font-extrabold text-slate-900 tracking-tight text-base">
                    StokTakip
                </div>
            </div>

            <button
                onClick={signOut}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
                <LogOut size={16} />
                <span>Çıkış</span>
            </button>
        </header>
    );
};

export default Topbar;
