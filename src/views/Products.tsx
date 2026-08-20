import { useState, useMemo } from 'react';
import {
  Plus, Search, Pencil, Trash2, X, Package,
  Tag, Boxes, EyeOff,
} from 'lucide-react';
import { useProducts } from '@/lib/hooks';
import { useBusinessProfile } from '@/lib/hooks';
import { formatCurrency } from '@/lib/format';
import type { Product, ItemType } from '@/lib/types';
import type { View } from '@/App';

interface ProductsProps {
  onNavigate: (view: View) => void;
}

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
  { value: 'labor', label: 'Labor' },
  { value: 'other', label: 'Other' },
];

const UNITS = ['ea', 'hr', 'day', 'sq ft', 'ft', 'lb', 'box', 'lot', 'set', 'kg', 'm'];

const emptyForm = {
  name: '', description: '', item_type: 'service' as ItemType,
  category: '', sku: '', unit: 'ea', unit_price: 0, tax_rate: '' as string | number, is_active: true,
};

export default function Products({ onNavigate }: ProductsProps) {
  void onNavigate;
  const { products, loading, create, update, remove } = useProducts();
  const { profile } = useBusinessProfile();
  const symbol = profile?.currency_symbol || '$';
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(p =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (product: Product) => {
    setForm({
      name: product.name,
      description: product.description || '',
      item_type: product.item_type,
      category: product.category || '',
      sku: product.sku || '',
      unit: product.unit,
      unit_price: product.unit_price,
      tax_rate: product.tax_rate ?? '',
      is_active: product.is_active,
    });
    setEditing(product);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const data = {
      name: form.name.trim(),
      description: form.description || null,
      item_type: form.item_type,
      category: form.category || null,
      sku: form.sku || null,
      unit: form.unit,
      unit_price: Number(form.unit_price) || 0,
      tax_rate: form.tax_rate === '' ? null : Number(form.tax_rate),
      is_active: form.is_active,
    };
    if (editing) {
      await update(editing.id, data);
    } else {
      await create(data);
    }
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-7xl mx-auto animate-pulse">
        <div className="h-8 w-40 bg-slate-200 rounded-lg mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in pb-bottom-nav md:pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Product Catalog</h1>
          <p className="text-sm text-slate-500 mt-1 hidden sm:block">
            {products.length} item{products.length !== 1 ? 's' : ''} — add commonly sold products and services to reuse on invoices
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary hidden md:flex">
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4 md:mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, category, or SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-10 min-touch"
        />
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Boxes className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">{search ? 'No items found' : 'No catalog items yet'}</p>
          <p className="text-sm text-slate-400 mt-1">
            {search ? 'Try a different search' : 'Add products and services you sell often to speed up invoicing'}
          </p>
          {!search && (
            <button onClick={openCreate} className="btn-primary mt-4">
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filtered.map(product => (
            <div key={product.id} className="card p-4 md:p-5 group hover:shadow-md transition-shadow animate-slide-up">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{product.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{product.item_type}</span>
                      {product.category && (
                        <span className="text-xs text-slate-400 flex items-center gap-0.5">
                          <Tag className="w-3 h-3" />
                          {product.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => openEdit(product)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors min-touch"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(product.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors min-touch"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {product.description && (
                <p className="text-sm text-slate-500 line-clamp-2 mb-3">{product.description}</p>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-900">{formatCurrency(product.unit_price, symbol)}</span>
                  <span className="text-xs text-slate-400">/ {product.unit}</span>
                </div>
                <div className="flex items-center gap-2">
                  {product.sku && <span className="text-xs text-slate-400 font-mono">{product.sku}</span>}
                  {product.tax_rate !== null && (
                    <span className="text-xs text-slate-400">{product.tax_rate}% tax</span>
                  )}
                  {!product.is_active && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 flex items-center gap-0.5">
                      <EyeOff className="w-3 h-3" /> Hidden
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={openCreate}
        className="md:hidden fixed right-4 bottom-24 w-14 h-14 rounded-full text-white flex items-center justify-center shadow-xl active:scale-95 transition-transform z-30"
        style={{ background: profile?.accent_color || '#111827' }}
        aria-label="Add item"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">
                {editing ? 'Edit Item' : 'New Catalog Item'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Furnace repair, Hourly labor, T-shirt"
                  className="input"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description shown on the invoice"
                  rows={2}
                  className="input resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Type</label>
                  <select
                    value={form.item_type}
                    onChange={e => setForm({ ...form, item_type: e.target.value as ItemType })}
                    className="input"
                  >
                    {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Category</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. HVAC Parts"
                    list="categories"
                    className="input"
                  />
                  <datalist id="categories">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">Unit</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="input"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Unit Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{symbol}</span>
                    <input
                      type="number"
                      value={form.unit_price}
                      onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="any"
                      className="input pl-7"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Tax %</label>
                  <input
                    type="number"
                    value={form.tax_rate}
                    onChange={e => setForm({ ...form, tax_rate: e.target.value })}
                    placeholder="Default"
                    min="0"
                    step="0.01"
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">SKU (optional)</label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={e => setForm({ ...form, sku: e.target.value })}
                  placeholder="Stock keeping unit"
                  className="input"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })}
                  className="w-5 h-5 rounded-lg border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-900/30"
                />
                <span className="text-sm text-slate-700">Active (shown when adding to invoices)</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={!form.name.trim()} className="btn-primary flex-1">
                {editing ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Delete this item?</h3>
            <p className="text-sm text-slate-500 mt-1">Existing invoices that use this item will not be affected.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => { remove(confirmDelete); setConfirmDelete(null); }}
                className="btn flex-1 bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
