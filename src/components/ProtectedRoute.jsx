import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = () => {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Kullanıcı adı yoksa ve şu an onboarding sayfasında değilse -> onboarding'e git
    if (!user.user_metadata?.full_name && location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />;
    }

    // Kullanıcı adı varsa ve onboarding'e girmeye çalışıyorsa -> dashboard'a git
    if (user.user_metadata?.full_name && location.pathname === '/onboarding') {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};
