import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { contractsApi, employeesApi } from '../../services/api';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const CONTRACT_TYPES = ['CDI', 'CDD', 'STAGE', 'CONSULTANT'];
const typeColors = { CDI: 'badge-green', CDD: 'badge-blue', STAGE: 'badge-yellow', CONSULTANT: 'badge-purple' };

function ContractForm({ employees, onSubmit, onClose }) {
  const [form, setForm] = useState({ employeeId: '', type: 'CDI', startDate: '', endDate: '', salary: '', notes: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, employeeId: +form.employeeId, salary: +form.salary }); }} className="space-y-4">
      <div>
        <label className="label">Employé *</label>
        <select className="input" value={form.employeeId} onChange={set('employeeId')} required>
          <option value="">Sélectionner un employé...</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.lastName} {e.firstName} ({e.matricule})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Type *</label>
          <select className="input" value={form.type} onChange={set('type')}>
            {CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div><label className="label">Salaire (CDF) *</label><input type="number" className="input" value={form.salary} onChange={set('salary')} required /></div>
        <div><label className="label">Date de début *</label><input type="date" className="input" value={form.startDate} onChange={set('startDate')} required /></div>
        <div><label className="label">Date de fin</label><input type="date" className="input" value={form.endDate} onChange={set('endDate')} /></div>
      </div>
      <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={set('notes')} /></div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
      </div>
    </form>
  );
}

export default function CompanyContracts() {
  const { companyId: rawId } = useParams();
  const companyId = rawId ? Number(rawId) : null;

  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      contractsApi.getAll(companyId),
      employeesApi.getAll(companyId),
    ])
      .then(([c, e]) => { setContracts(c.data); setEmployees(e.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [companyId]);

  const filtered = filter === 'all' ? contracts : contracts.filter(c => c.type === filter);

  const handleCreate = async (data) => {
    try {
      const { data: created } = await contractsApi.create(data);
      const employee = employees.find((e) => Number(e.id) === Number(data.employeeId));
      const contract = { status: 'active', ...created, employee: created.employee ?? employee };
      setContracts((current) => [contract, ...current.filter((c) => c.id !== contract.id)]);
      setFilter(contract.type ?? data.type ?? 'all');
      toast.success('Contrat créé');
      setModal(false);
      load();
    }
    catch (err) { toast.error(err.response?.data?.message || 'Erreur lors de la création'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contrats</h1>
          <p className="page-subtitle">{contracts.length} contrat(s) · {contracts.filter(c => c.status === 'active').length} actif(s)</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><PlusIcon className="w-4 h-4" /> Nouveau contrat</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', ...CONTRACT_TYPES].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'filter-pill-active' : 'filter-pill-inactive'}>
            {f === 'all' ? 'Tous' : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-spinner"><p className="text-gray-500 text-sm">Chargement...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card"><DocumentTextIcon className="w-14 h-14 text-gray-200 mb-3" /><p className="text-gray-500 font-medium">Aucun contrat</p></div>
      ) : (
        <div className="table-container">
          <table className="w-full text-sm">
            <thead><tr>{['Employé','Type','Date début','Date fin','Salaire mensuel','Statut'].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => (
                <tr key={c.id} className="tr-hover">
                  <td className="td">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                        {c.employee?.lastName?.[0]}{c.employee?.firstName?.[0]}
                      </div>
                      <span className="font-medium text-gray-900">{c.employee?.lastName} {c.employee?.firstName}</span>
                    </div>
                  </td>
                  <td className="td"><span className={typeColors[c.type] ?? 'badge-gray'}>{c.type}</span></td>
                  <td className="td">{c.startDate}</td>
                  <td className="td">{c.endDate || <span className="text-gray-400 text-xs">Indéterminé</span>}</td>
                  <td className="td font-semibold text-gray-900">{Number(c.salary).toLocaleString('fr-FR')} CDF</td>
                  <td className="td"><span className={c.status === 'active' ? 'badge-green' : 'badge-red'}>{c.status === 'active' ? 'Actif' : 'Inactif'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title="Nouveau contrat" onClose={() => setModal(false)}>
          <ContractForm employees={employees} onSubmit={handleCreate} onClose={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
