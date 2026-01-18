import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Filter } from 'lucide-react';

const StockLevels = () => {
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [warehouseFilter, setWarehouseFilter] = useState('all');
    const [warehouses, setWarehouses] = useState([]);

    useEffect(() => {
        fetchStocks();
        fetchWarehouses();
    }, []);

    const fetchWarehouses = async () => {
        const { data } = await supabase.from('warehouses').select('id, name');
        setWarehouses(data || []);
    };

    const fetchStocks = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('stock_levels')
            .select(`
        id,
        quantity,
        products (name, sku_or_barcode, brand),
        warehouses (name, id)
      `);

        if (error) console.error(error);
        else setStocks(data || []);
        setLoading(false);
    };

    const filteredStocks = stocks.filter(item => {
        const matchesSearch =
            item.products?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.products?.sku_or_barcode?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesWarehouse = warehouseFilter === 'all' || item.warehouses?.id === warehouseFilter;

        return matchesSearch && matchesWarehouse;
    });

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">Stok Durumu</h1>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Ürün adı veya barkod ara..."
                            className="pl-10 pr-4 py-2 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={20} className="text-slate-400" />
                        <select
                            className="py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            value={warehouseFilter}
                            onChange={(e) => setWarehouseFilter(e.target.value)}
                        >
                            <option value="all">Tüm Depolar</option>
                            {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Ürün</th>
                                <th className="px-6 py-4">Barkod</th>
                                <th className="px-6 py-4">Depo</th>
                                <th className="px-6 py-4 text-right">Miktar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="4" className="text-center py-8">Yükleniyor...</td></tr>
                            ) : filteredStocks.length === 0 ? (
                                <tr><td colSpan="4" className="text-center py-8">Stok kaydı bulunamadı.</td></tr>
                            ) : (
                                filteredStocks.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {item.products?.name}
                                            <span className="block text-xs text-slate-400 font-normal">{item.products?.brand}</span>
                                        </td>
                                        <td className="px-6 py-4">{item.products?.sku_or_barcode}</td>
                                        <td className="px-6 py-4">{item.warehouses?.name}</td>
                                        <td className={`px-6 py-4 text-right font-bold ${item.quantity < 10 ? 'text-red-600' : 'text-slate-700'}`}>
                                            {item.quantity}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StockLevels;
