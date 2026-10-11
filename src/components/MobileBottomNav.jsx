import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, Menu } from 'lucide-react';
import clsx from 'clsx';

const MobileBottomNav = ({ onOpenMore }) => {
    const location = useLocation();

    const navItems = [
        { icon: LayoutDashboard, label: 'Panel', path: '/dashboard' },
        { icon: ShoppingCart, label: 'Satış Yap', path: '/sales/new' },
        { icon: Package, label: 'Ürünler', path: '/products' },
        { icon: Users, label: 'Müşteriler', path: '/customers' },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_12px_rgba(0,0,0,0.05)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path === '/sales/new' && location.pathname.startsWith('/sales'));
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={clsx(
                            "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all text-xs font-semibold select-none",
                            isActive
                                ? "text-indigo-600 font-bold"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <div className={clsx("p-1 rounded-lg transition-transform", isActive && "bg-indigo-50 scale-110")}>
                            <item.icon size={20} />
                        </div>
                        <span className="text-[11px] mt-0.5 tracking-tight">{item.label}</span>
                    </Link>
                );
            })}

            {/* Daha Fazla (Menüyü Aç) */}
            <button
                type="button"
                onClick={onOpenMore}
                className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all text-xs font-semibold text-slate-500 hover:text-slate-800 select-none cursor-pointer"
            >
                <div className="p-1 rounded-lg">
                    <Menu size={20} />
                </div>
                <span className="text-[11px] mt-0.5 tracking-tight">Menü</span>
            </button>
        </nav>
    );
};

export default MobileBottomNav;
