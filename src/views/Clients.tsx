import { useState, useMemo, useRef } from 'react';
import {
  Plus, Search, Mail, Phone, MapPin, Trash2, Pencil,
  Users, X, FileText, Upload, Download, AlertCircle,
  CheckCircle2, Loader2, MessageSquare,
} from 'lucide-react';
import { useClients, useInvoices, useBusinessProfile } from '@/lib/hooks';
import { formatCurrency } from '@/lib/format';
import { parseContactsCSV, detectDuplicates, toClientInsert, generateCSVTemplate, type ParsedContact } from '@/lib/contactImport';
import type { View } from '@/App';
import type { Client } from '@/lib/types';

export default function Clients(_props: { onNavigate: (view: View) => void }) {
  void _props;
  const { profile } = useBusinessProfile();
  const symbol = profile?.currency_symbol || '\x24';
  const { clients, loading, create, update, remove } = useClients();
  const { invoices } = useInvoices();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importedContacts, setImportedContacts] = useState<ParsedContact[]>([]);
  const [importDuplicates, setImportDuplicates] = useState<number[]>([]);
  const [importSkipped, setImportSkipped] = useState<number[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', company: '', notes: '', tax_id: '',
  });

  const clientStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    invoices.forEach(inv => {
      if (inv.client_id) {
        if (!stats[inv.client_id]) stats[inv.client_id] = { count: 0, total: 0 };
        stats[inv.client_id].count++;
        stats[inv.client_id].total += inv.total || 0;
      }
    });
    return stats;
  }, [invoices]);

  const filtered = useMemo(() => {
    return clients.filter(c =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.company || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [clients, search]);

  const openCreate = () => {
    setForm({ name: '', email: '', phone: '', address: '', company: '', notes: '', tax_id: '' });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (client: Client) => {
    setForm({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      company: client.company || '',
      notes: client.notes || '',
      tax_id: client.tax_id || '',
    });
    setEditing(client);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const data = {
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      company: form.company || null,
      notes: form.notes || null,
      tax_id: form.tax_id || null,
    };
    if (editing) {
      await update(editing.id, data);
    } else {
      await create(data);
    }
    setShowForm(false);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    if (file.size > 2 * 1024 * 1024) {
      setImportError('File too large. Maximum 2MB.');
      return;
    }
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setImportError('Please upload a CSV file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseContactsCSV(text);
        if (parsed.length === 0) {
          setImportError('No contacts found in the file. Make sure it has a Name column.');
          return;
        }
        const result = detectDuplicates(parsed, clients);
        setImportedContacts(parsed);
        setImportDuplicates(result.duplicates);
        setImportSkipped(result.skipped);
      } catch {
        setImportError('Could not parse the CSV file. Check the format and try again.');
      }
    };
    reader.onerror = () => setImportError('Could not read the file.');
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (importedContacts.length === 0) return;
    setImporting(true);
    setImportProgress(0);
    for (let i = 0; i < importedContacts.length; i++) {
      if (importSkipped.includes(i)) continue;
      if (importDuplicates.includes(i)) continue;
      await create(toClientInsert(importedContacts[i]));
      setImportProgress(Math.round(((i + 1) / importedContacts.length) * 100));
    }
    setImporting(false);
    setShowImport(false);
    setImportedContacts([]);
    setImportDuplicates([]);
    setImportSkipped([]);
    setImportProgress(0);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([generateCSVTemplate()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto animate-pulse pb-bottom-nav md:pb-10">
        <div className="h-8 w-32 bg-slate-200 rounded-lg mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const formContent = (
    <div className="space-y-4">
      <div>
        <label className="label">Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="John Smith"
          className="input min-touch"
          autoFocus
        />
      </div>
      <div>
        <label className="label">Company</label>
        <input
          type="text"
          value={form.company}
          onChange={e => setForm({ ...form, company: e.target.value })}
          placeholder="Acme Corp"
          className="input min-touch"
        />
      </div>
      <div>
        <label className="label">Tax ID / VAT</label>
        <input
          type="text"
          value={form.tax_id}
          onChange={e => setForm({ ...form, tax_id: e.target.value })}
          placeholder="VAT-12345678"
          className="input min-touch"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="john@acme.com"
            className="input min-touch"
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="+1 555 000 0000"
            className="input min-touch"
          />
        </div>
      </div>
      <div>
        <label className="label">Billing Address</label>
        <textarea
          value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })}
          placeholder="123 Main St, San Francisco, CA 94101"
          rows={2}
          className="input resize-none"
        />
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          placeholder="Internal notes..."
          rows={2}
          className="input resize-none"
        />
      </div>
    </div>
  );

  const formActions = (
    <div className="flex gap-3 mt-6">
      <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 min-touch">
        Cancel
      </button>
      <button onClick={handleSave} disabled={!form.name.trim()} className="btn-primary flex-1 min-touch">
        {editing ? 'Save Changes' : 'Add Client'}
      </button>
    </div>
  );

  return (
    <div className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in pb-bottom-nav md:pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">{clients.length} total</p>
        </div>
        <div className="hidden md:flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary">
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Client
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 md:mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-10 min-touch"
        />
      </div>

      {/* Client grid — 1 col on mobile, 3 on desktop */}
      {filtered.length === 0 ? (
        <div className="card p-8 md:p-12 text-center">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 md:w-8 md:h-8 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">{search ? 'No customers found' : 'No customers yet'}</p>
          <p className="text-sm text-slate-400 mt-1">
            {search ? 'Try a different search' : 'Add your first customer to start invoicing'}
          </p>
          {!search && (
            <button onClick={openCreate} className="btn-primary mt-4">
              <Plus className="w-4 h-4" />
              Add Customer
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filtered.map(client => {
            const stats = clientStats[client.id] || { count: 0, total: 0 };
            return (
              <div key={client.id} className="card p-4 md:p-5 group hover:shadow-md transition-shadow animate-slide-up">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-bold">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{client.name}</h3>
                      {client.company && <p className="text-xs text-slate-400 truncate">{client.company}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(client)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors min-touch"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(client.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors min-touch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {client.email && (
                    <p className="text-sm text-slate-500 flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      {client.email}
                    </p>
                  )}
                  {client.phone && (
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      {client.phone}
                    </p>
                  )}
                  {client.address && (
                    <p className="text-sm text-slate-500 flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{client.address}</span>
                    </p>
                  )}
                </div>

                {/* Quick actions — mobile */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50 md:hidden">
                  {client.phone && (
                    <>
                      <a
                        href={`tel:${client.phone}`}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-slate-600 bg-slate-50 rounded-lg active:bg-slate-100 transition-colors min-touch"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call
                      </a>
                      <a
                        href={`sms:${client.phone}`}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-slate-600 bg-slate-50 rounded-lg active:bg-slate-100 transition-colors min-touch"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Text
                      </a>
                    </>
                  )}
                  {client.email && (
                    <a
                      href={`mailto:${client.email}`}
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-slate-600 bg-slate-50 rounded-lg active:bg-slate-100 transition-colors min-touch"
                    >
                      <Mail className="w-3.5 h-3.5" /> Email
                    </a>
                  )}
                </div>

                {stats.count > 0 && (
                  <div className="mt-3 md:mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-3 h-3" />
                      {stats.count} invoice{stats.count !== 1 ? 's' : ''}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{formatCurrency(stats.total, symbol)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={openCreate}
        className="md:hidden fixed right-4 bottom-24 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xl shadow-indigo-600/30 active:scale-95 transition-transform z-30"
        aria-label="Add customer"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>

      {/* Add/Edit — bottom sheet on mobile, modal on desktop */}
      {showForm && (
        <>
          <div
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm animate-overlay md:flex md:items-center md:justify-center md:p-4"
            onClick={() => setShowForm(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl animate-sheet-in safe-area-pb max-h-[90vh] overflow-y-auto md:static md:inset-auto md:max-h-none md:max-w-lg md:mx-auto md:rounded-2xl md:animate-scale-in">
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1.5 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-4 md:p-6 md:pb-4 md:border-b md:border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">
                {editing ? 'Edit Customer' : 'New Customer'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg min-touch">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 pb-6 md:p-6 md:pt-4">
              {formContent}
              {formActions}
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Delete this customer?</h3>
            <p className="text-sm text-slate-500 mt-1">Their invoices will remain but won't be linked to a customer.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1 min-touch">Cancel</button>
              <button
                onClick={() => { remove(confirmDelete); setConfirmDelete(null); }}
                className="btn flex-1 bg-red-600 text-white hover:bg-red-700 min-touch"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Import Customers</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {importedContacts.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  Upload a CSV file with a Name column. Email, Phone, Company, and Notes are optional.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download template
                </button>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer hover:border-slate-300 transition-colors"
                >
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-600">Click to upload CSV</p>
                  <p className="text-xs text-slate-400 mt-1">Max 2MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileImport}
                  className="hidden"
                />
                {importError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {importError}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-slate-700 font-medium">{importedContacts.length} contacts found</span>
                  {importDuplicates.length > 0 && (
                    <span className="text-amber-600">· {importDuplicates.length} duplicates</span>
                  )}
                  {importSkipped.length > 0 && (
                    <span className="text-slate-400">· {importSkipped.length} skipped</span>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1.5">
                  {importedContacts.map((contact, i) => {
                    const isDup = importDuplicates.includes(i);
                    const isSkipped = importSkipped.includes(i);
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border text-sm ${
                          isSkipped ? 'border-slate-100 bg-slate-50 opacity-50' :
                          isDup ? 'border-amber-200 bg-amber-50' : 'border-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900 truncate">{contact.name}</p>
                          {contact.email && <p className="text-xs text-slate-500 truncate">{contact.email}</p>}
                        </div>
                        {isSkipped && <span className="text-xs text-slate-400">Duplicate in file</span>}
                        {isDup && !isSkipped && <span className="text-xs text-amber-600 font-medium">Exists</span>}
                        {!isDup && !isSkipped && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      </div>
                    );
                  })}
                </div>

                {importing && (
                  <div className="space-y-1.5">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-900 rounded-full transition-all" style={{ width: `${importProgress}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 text-center">Importing… {importProgress}%</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setImportedContacts([]);
                      setImportDuplicates([]);
                      setImportSkipped([]);
                      setImportError(null);
                    }}
                    className="btn-secondary flex-1 min-touch"
                    disabled={importing}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="btn-primary flex-1 min-touch"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : `Import ${importedContacts.length - importDuplicates.length - importSkipped.length} new`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
