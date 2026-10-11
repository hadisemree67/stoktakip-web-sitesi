import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileBottomNav from './MobileBottomNav';
import { Outlet } from 'react-router-dom';

const Layout = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
            <Topbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
            
            <main className="flex-1 pt-20 md:pl-64 p-3.5 sm:p-6 pb-28 md:pb-8 transition-all max-w-full overflow-x-hidden">
                <Outlet />
            </main>

            {/* iPhone / Mobil Cihazlar İçin Alt Hızlı Navigasyon Barı */}
            <MobileBottomNav onOpenMore={() => setMobileMenuOpen(true)} />
        </div>
    );
};

export default Layout;
