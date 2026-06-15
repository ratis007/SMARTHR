import { useEffect, useState } from 'react';
import { contractsApi, employeesApi } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { DocumentTextIcon, PencilIcon, PlusIcon, PowerIcon, TrashIcon } from '@heroicons/react/24/outline';

const CONTRACT_TYPES = ['CDI', 'CDD', 'STAGE', 'CONSULTANT'];
const typeColors = { CDI: 'badge-green', CDD: 'badge-blue', STAGE: 'badge-yellow', CONSULTANT: 'badge-purple' };
const statusConfig = {
  active: { label: 'Actif', cls: 'badge-green' },
  expired: { label: 'Expire', cls: 'badge-yellow' },
  terminated: { label: 'Archive', cls: 'badge-red' },
};

function ContractForm({ employees, initialData, onSubmit, onClose }) {
  const [form, setForm] = useState({
    employeeId: initialData?.employeeId ? String(initialData.employeeId) : '',
    type: initialData?.type ?? 'CDI',
    startDate: initialData?.startDate?.slice(0, 10) ?? '',
    endDate: initialData?.endDate?.slice(0, 10) ?? '',
    salary: initialData?.salary ?? '',
    notes: initialData?.notes ?? '',
  });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, employeeId: Number(form.employeeId), salary: Number(form.salary) }); }} className="space-y-4">
      <div>
        <label className="label">Employe *</label>
        <select className="input" value={form.employeeId} onChange={set('employeeId')} required>
          <option value="">Selectionner un employe...</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.lastName} {employee.firstName} ({employee.matricule})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Type *</label><select className="input" value={form.type} onChange={set('type')}>{CONTRACT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
        <div><label className="label">Salaire (CDF) *</label><input type="number" className="input" value={form.salary} onChange={set('salary')} required /></div>
        <div><label className="label">Date de debut *</label><input type="date" className="input" value={form.startDate} onChange={set('startDate')} required /></div>
        <div><label className="label">Date de fin</label><input type="date" className="input" value={form.endDate ?? ''} onChange={set('endDate')} /></div>
      </div>
      <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes ?? ''} onChange={set('notes')} /></div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
      </div>
    </form>
  );
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    Promise.all([contractsApi.getAll(), employeesApi.getAll()])
      .then(([contractRes, employeeRes]) => { setContracts(contractRes.data); setEmployees(employeeRes.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? contracts : contracts.filter((contract) => contract.type === filter);
  const activeCount = contracts.filter((contract) => contract.status === 'active').length;

  const handleCreate = async (data) => {
    try { await contractsApi.create(data); toast.success('Contrat cree'); setModal(false); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Erreur lors de la creation'); }
  };

  const handleUpdate = async (data) => {
    try { await contractsApi.update(editing.id, data); toast.success('Contrat modifie'); setEditing(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Erreur lors de la modification'); }
  };

  const handleToggleStatus = async (contract) => {
    try { await contractsApi.toggleStatus(contract.id); toast.success(contract.status === 'active' ? 'Contrat desactive' : 'Contrat active'); setConfirm(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Changement de statut impossible'); }
  };

  const handleDelete = async (contract) => {
    try { await contractsApi.delete(contract.id); toast.success('Contrat archive'); setConfirm(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Suppression impossible'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Contrats</h1><p className="page-subtitle">{contracts.length} contrat(s) - {activeCount} actif(s)</p></div>
        <button onClick={() => setModal(true)} className="btn-primary"><PlusIcon className="w-4 h-4" /> Nouveau contrat</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', ...CONTRACT_TYPES].map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? 'filter-pill-active' : 'filter-pill-inactive'}>{item === 'all' ? 'Tous' : item}</button>)}
      </div>

      {loading ? (
        <div className="loading-spinner"><p className="text-gray-400 text-sm">Chargement...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card"><DocumentTextIcon className="w-14 h-14 text-gray-200 mb-3" /><p className="text-gray-500 font-medium">Aucun contrat trouve</p></div>
      ) : (
        <div className="table-container overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead><tr>{['Employe', 'Type', 'Date debut', 'Date fin', 'Salaire mensuel', 'Statut', 'Actions'].map((header) => <th key={header} className="th">{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((contract) => {
                const status = statusConfig[contract.status] ?? statusConfig.terminated;
                return (
                  <tr key={contract.id} className="tr-hover">
                    <td className="td"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">{contract.employee?.lastName?.[0]}{contract.employee?.firstName?.[0]}</div><span className="font-medium text-gray-900">{contract.employee?.lastName} {contract.employee?.firstName}</span></div></td>
                    <td className="td"><span className={typeColors[contract.type] ?? 'badge-gray'}>{contract.type}</span></td>
                    <td className="td">{contract.startDate}</td>
                    <td className="td">{contract.endDate || <span className="text-gray-400 text-xs">Indetermine</span>}</td>
                    <td className="td font-semibold text-gray-900">{Number(contract.salary).toLocaleString('fr-FR')} CDF</td>
                    <td className="td"><span className={status.cls}>{status.label}</span></td>
                    <td className="td"><ActionButtons item={contract} onEdit={setEditing} onConfirm={setConfirm} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && <Modal title="Nouveau contrat" onClose={() => setModal(false)}><ContractForm employees={employees} onSubmit={handleCreate} onClose={() => setModal(false)} /></Modal>}
      {editing && <Modal title="Modifier le contrat" onClose={() => setEditing(null)}><ContractForm employees={employees} initialData={editing} onSubmit={handleUpdate} onClose={() => setEditing(null)} /></Modal>}
      {confirm && <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} onDelete={handleDelete} onToggle={handleToggleStatus} />}
    </div>
  );
}

function ActionButtons({ item, onEdit, onConfirm }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" title="Modifier" onClick={() => onEdit(item)} className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"><PencilIcon className="w-4 h-4" /></button>
      <button type="button" title={item.status === 'active' ? 'Desactiver' : 'Activer'} onClick={() => onConfirm({ type: 'status', item })} className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"><PowerIcon className="w-4 h-4" /></button>
      <button type="button" title="Archiver" onClick={() => onConfirm({ type: 'delete', item })} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
    </div>
  );
}

function ConfirmModal({ confirm, onClose, onDelete, onToggle }) {
  return (
    <Modal title={confirm.type === 'delete' ? 'Archiver le contrat' : 'Changer le statut'} onClose={onClose} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{confirm.type === 'delete' ? 'Archiver ce contrat ?' : `${confirm.item.status === 'active' ? 'Desactiver' : 'Activer'} ce contrat ?`}</p>
        <div className="flex gap-3">
          <button type="button" className="btn-primary flex-1 justify-center" onClick={() => confirm.type === 'delete' ? onDelete(confirm.item) : onToggle(confirm.item)}>Confirmer</button>
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </Modal>
  );
}
