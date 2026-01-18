import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Outlet } from 'react-router-dom';

const Layout = () => {
    return (
        <div className="min-h-screen bg-slate-50">
            <Sidebar />
            <Topbar />
            <main className="pt-20 md:pl-72 p-6 transition-all">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
