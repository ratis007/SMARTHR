import { useEffect, useState } from 'react';
import { leaveApi, employeesApi } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { PlusIcon, CheckIcon, XMarkIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

const LEAVE_TYPES = [
  { value: 'annual', label: 'Congé annuel' },
  { value: 'sick', label: 'Congé maladie' },
  { value: 'maternity', label: 'Congé maternité' },
  { value: 'paternity', label: 'Congé paternité' },
  { value: 'unpaid', label: 'Congé sans solde' },
  { value: 'other', label: 'Autre' },
];

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Approuvés' },
  { value: 'rejected', label: 'Refusés' },
];

const statusConfig = {
  pending:  { label: 'En attente', cls: 'badge-yellow' },
  approved: { label: 'Approuvé',   cls: 'badge-green' },
  rejected: { label: 'Refusé',     cls: 'badge-red' },
};

function LeaveForm({ employees, onSubmit, onClose }) {
  const [form, setForm] = useState({ employeeId: '', type: 'annual', startDate: '', endDate: '', reason: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const days = form.startDate && form.endDate
    ? Math.max(0, Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1)
    : 0;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, employeeId: +form.employeeId }); }} className="space-y-4">
      <div>
        <label className="label">Employé *</label>
        <select className="input" value={form.employeeId} onChange={set('employeeId')} required>
          <option value="">Sélectionner un employé...</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.lastName} {e.firstName}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Type de congé *</label>
        <select className="input" value={form.type} onChange={set('type')}>
          {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date de début *</label>
          <input type="date" className="input" value={form.startDate} onChange={set('startDate')} required />
        </div>
        <div>
          <label className="label">Date de fin *</label>
          <input type="date" className="input" value={form.endDate} onChange={set('endDate')} required />
        </div>
      </div>
      {days > 0 && (
        <div className="bg-indigo-50 rounded-xl px-4 py-2.5 border border-indigo-100 text-sm text-indigo-700 font-medium">
          📅 Durée : {days} jour(s)
        </div>
      )}
      <div>
        <label className="label">Motif</label>
        <textarea className="input" rows={3} value={form.reason} onChange={set('reason')} placeholder="Précisez le motif..." />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Soumettre la demande</button>
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
      </div>
    </form>
  );
}

export default function LeavePage() {
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([leaveApi.getAll(), employeesApi.getAll()])
      .then(([l, e]) => { setLeaves(l.data); setEmployees(e.data); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? leaves : leaves.filter((l) => l.status === filter);
  const pendingCount = leaves.filter((l) => l.status === 'pending').length;

  const handleCreate = async (data) => {
    try {
      const { data: created } = await leaveApi.create(data);
      const employee = employees.find((e) => Number(e.id) === Number(data.employeeId));
      const leave = { status: 'pending', ...created, employee: created.employee ?? employee };
      setLeaves((current) => [leave, ...current.filter((l) => l.id !== leave.id)]);
      setFilter(leave.status ?? 'pending');
      toast.success('Demande soumise');
      setModal(false);
      load();
    }
    catch (err) { toast.error(err.response?.data?.message || 'Erreur lors de la soumission'); }
  };
  const handleApprove = async (id) => {
    try { await leaveApi.approve(id); toast.success('Congé approuvé'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };
  const handleReject = async (id) => {
    try { await leaveApi.reject(id); toast.success('Congé refusé'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const getTypeLabel = (v) => LEAVE_TYPES.find((t) => t.value === v)?.label ?? v;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Congés & Absences</h1>
          <p className="page-subtitle">
            {pendingCount > 0
              ? <span className="text-amber-600 font-semibold">{pendingCount} demande(s) en attente d'approbation</span>
              : `${leaves.length} demande(s) au total`}
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Nouvelle demande
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={filter === f.value ? 'filter-pill-active' : 'filter-pill-inactive'}>
            {f.label}
            {f.value === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-spinner"><p className="text-gray-400 text-sm">Chargement...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <CalendarDaysIcon className="w-14 h-14 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Aucune demande de congé</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full text-sm">
            <thead><tr>
              {['Employé', 'Type', 'Période', 'Durée', 'Motif', 'Statut', 'Actions'].map((h) => (
                <th key={h} className="th">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((l) => {
                const sc = statusConfig[l.status] ?? statusConfig.pending;
                const days = l.startDate && l.endDate
                  ? Math.max(0, Math.ceil((new Date(l.endDate) - new Date(l.startDate)) / 86400000) + 1)
                  : '—';
                return (
                  <tr key={l.id} className="tr-hover">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                          {l.employee?.lastName?.[0]}{l.employee?.firstName?.[0]}
                        </div>
                        <span className="font-medium text-gray-900">{l.employee?.lastName} {l.employee?.firstName}</span>
                      </div>
                    </td>
                    <td className="td text-gray-700">{getTypeLabel(l.type)}</td>
                    <td className="td text-gray-600 text-xs">
                      <span>{l.startDate}</span>
                      <span className="text-gray-300 mx-1">→</span>
                      <span>{l.endDate}</span>
                    </td>
                    <td className="td">
                      <span className="badge-gray">{days}j</span>
                    </td>
                    <td className="td text-gray-500 max-w-[160px] truncate">{l.reason || '—'}</td>
                    <td className="td"><span className={sc.cls}>{sc.label}</span></td>
                    <td className="td">
                      {l.status === 'pending' && (
                        <div className="flex gap-1.5">
                          <button onClick={() => handleApprove(l.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Approuver">
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleReject(l.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Refuser">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title="Nouvelle demande de congé" onClose={() => setModal(false)}>
          <LeaveForm employees={employees} onSubmit={handleCreate} onClose={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
