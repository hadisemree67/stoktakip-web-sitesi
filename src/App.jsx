import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import Customers from './pages/Customers';
import Products from './pages/Products';
import Warehouses from './pages/Warehouses';
import SalesLocations from './pages/SalesLocations';
import StockLevels from './pages/StockLevels';
import StockMovements from './pages/StockMovements';
import Sales from './pages/Sales';
import SalesNew from './pages/SalesNew';
import SaleDetail from './pages/SaleDetail';
import SalesReports from './pages/SalesReports';
import Onboarding from './pages/Onboarding';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* <Route path="/register" element={<Register />} /> Kayıt Ol sayfası devre dışı */}
        <Route path="/register" element={<Navigate to="/login" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />

          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/products" element={<Products />} />
            <Route path="/warehouses" element={<Warehouses />} />
            <Route path="/sales-locations" element={<SalesLocations />} />
            <Route path="/stock" element={<StockLevels />} />
            <Route path="/stock/movements" element={<StockMovements />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/sales/new" element={<SalesNew />} />
            <Route path="/sales/:id" element={<SaleDetail />} />
            <Route path="/reports" element={<SalesReports />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
