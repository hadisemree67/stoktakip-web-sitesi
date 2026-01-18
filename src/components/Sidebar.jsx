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
    TrendingUp
} from 'lucide-react';
import clsx from 'clsx';

const Sidebar = () => {
    const location = useLocation();

    const menuItems = [
        { icon: LayoutDashboard, label: 'Panel', path: '/dashboard' },
        { icon: Users, label: 'Müşteriler', path: '/customers' },
        { icon: Package, label: 'Ürünler', path: '/products' },
        { icon: Warehouse, label: 'Depolar', path: '/warehouses' },
        { icon: MapPin, label: 'Satış Noktaları', path: '/sales-locations' },
        { icon: BarChart3, label: 'Stok Durumu', path: '/stock' },
        { icon: ArrowRightLeft, label: 'Stok Hareketleri', path: '/stock/movements' },
        { icon: TrendingUp, label: 'Raporlar', path: '/reports' },
        { icon: ShoppingCart, label: 'Satışlar', path: '/sales' },
    ];

    return (
        <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 overflow-y-auto z-10 hidden md:flex">
            <div className="p-6 text-2xl font-bold border-b border-slate-700 bg-slate-950">
                StokTakip
            </div>
            <nav className="flex-1 p-4 space-y-1">
                {menuItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={clsx(
                            "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                            location.pathname === item.path
                                ? "bg-slate-700 text-white shadow-lg"
                                : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        )}
                    >
                        <item.icon size={20} />
                        <span className="font-medium">{item.label}</span>
                    </Link>
                ))}
            </nav>
            <div className="p-4 border-t border-slate-700 text-xs text-slate-500 text-center">
                <div className="mb-1">v1.0.0</div>
                <div className="text-slate-600">Designed by <span className="text-slate-500 font-medium">Hadis Emre Yılmaz</span></div>
            </div>
        </aside>
    );
};

export default Sidebar;
