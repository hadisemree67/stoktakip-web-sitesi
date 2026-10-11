import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Package,
    Warehouse,
    MapPin,
    BarChart3,
    ArrowRightLeft,
    ShoppingCart,
    TrendingUp,
    X
} from 'lucide-react';
import clsx from 'clsx';

const Sidebar = ({ mobileOpen, onCloseMobile }) => {
    const location = useLocation();

    const menuItems = [
        { icon: LayoutDashboard, label: 'Panel', path: '/dashboard' },
        { icon: ShoppingCart, label: 'Satışlar', path: '/sales' },
        { icon: Package, label: 'Ürünler', path: '/products' },
        { icon: Users, label: 'Müşteriler', path: '/customers' },
        { icon: BarChart3, label: 'Stok Durumu', path: '/stock' },
        { icon: ArrowRightLeft, label: 'Stok Hareketleri', path: '/stock/movements' },
        { icon: Warehouse, label: 'Depolar', path: '/warehouses' },
        { icon: MapPin, label: 'Satış Noktaları', path: '/sales-locations' },
        { icon: TrendingUp, label: 'Raporlar', path: '/reports' },
    ];

    const content = (
        <div className="flex flex-col h-full bg-slate-900 text-white">
            <div className="p-5 text-xl font-extrabold border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                <span className="tracking-wide">StokTakip</span>
                {mobileOpen && (
                    <button
                        type="button"
                        onClick={onCloseMobile}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white md:hidden cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>
            <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => { if (onCloseMobile) onCloseMobile(); }}
                        className={clsx(
                            "flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm select-none",
                            location.pathname === item.path
                                ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30"
                                : "text-slate-400 hover:bg-slate-800 hover:text-white font-medium"
                        )}
                    >
                        <item.icon size={19} />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>
            <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="text-slate-500">Stok & Satış Yönetimi</div>
            </div>
        </div>
    );

    return (
        <>
            {/* Masaüstü Sabit Sidebar */}
            <aside className="w-64 fixed left-0 top-0 bottom-0 z-20 hidden md:block border-r border-slate-800">
                {content}
            </aside>

            {/* Mobil Çekmece (Drawer) & Karartma Backdrop */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    {/* Arka plan karartması */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={onCloseMobile}
                    />

                    {/* Çekmece Kutusu */}
                    <aside className="relative w-72 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
                        {content}
                    </aside>
                </div>
            )}
        </>
    );
};

export default Sidebar;
