import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { employeesApi } from '../../services/api';
import Modal from '../../components/Modal';
import ConfirmationModal from '../../components/ConfirmationModal';
import toast from 'react-hot-toast';
import {
  ChevronRightIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  TrashIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

const statusConfig = {
  active: { label: 'Actif', cls: 'badge-green' },
  inactive: { label: 'Inactif', cls: 'badge-red' },
  suspended: { label: 'Suspendu', cls: 'badge-yellow' },
};

function EmployeeForm({ companyId, initialData, onSubmit, onClose }) {
  const [form, setForm] = useState({
    firstName: initialData?.firstName ?? '',
    lastName: initialData?.lastName ?? '',
    middleName: initialData?.middleName ?? '',
    birthDate: initialData?.birthDate?.slice(0, 10) ?? '',
    nationality: initialData?.nationality ?? 'Congolaise',
    gender: initialData?.gender ?? 'M',
    address: initialData?.address ?? '',
    phone: initialData?.phone ?? '',
    email: initialData?.email ?? '',
    department: initialData?.department ?? '',
    position: initialData?.position ?? '',
    baseSalary: initialData?.baseSalary ?? '',
    companyId: String(companyId),
  });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = (event) => {
    event.preventDefault();
    onSubmit({ ...form, baseSalary: Number(form.baseSalary || 0), companyId: Number(companyId) });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Nom *</label><input className="input" value={form.lastName} onChange={set('lastName')} required /></div>
        <div><label className="label">Prenom *</label><input className="input" value={form.firstName} onChange={set('firstName')} required /></div>
        <div><label className="label">Postnom</label><input className="input" value={form.middleName} onChange={set('middleName')} /></div>
        <div><label className="label">Date de naissance</label><input type="date" className="input" value={form.birthDate} onChange={set('birthDate')} /></div>
        <div>
          <label className="label">Sexe</label>
          <select className="input" value={form.gender} onChange={set('gender')}>
            <option value="M">Masculin</option>
            <option value="F">Feminin</option>
          </select>
        </div>
        <div><label className="label">Nationalite</label><input className="input" value={form.nationality} onChange={set('nationality')} /></div>
        <div><label className="label">Telephone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
        <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={set('email')} /></div>
        <div><label className="label">Departement</label><input className="input" value={form.department} onChange={set('department')} /></div>
        <div><label className="label">Poste</label><input className="input" value={form.position} onChange={set('position')} /></div>
        <div><label className="label">Salaire de base (CDF)</label><input type="number" className="input" value={form.baseSalary} onChange={set('baseSalary')} /></div>
        <div className="col-span-2"><label className="label">Adresse</label><input className="input" value={form.address} onChange={set('address')} /></div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
      </div>
    </form>
  );
}

export default function CompanyEmployees() {
  const { companyId: rawId } = useParams();
  const companyId = rawId ? Number(rawId) : null;
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!companyId) return;
    setLoading(true);
    employeesApi.getAll(companyId)
      .then(({ data }) => setEmployees(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [companyId]);

  const filtered = employees.filter((employee) =>
    `${employee.firstName} ${employee.lastName} ${employee.matricule} ${employee.department ?? ''} ${employee.position ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data) => {
    try { await employeesApi.create(data); toast.success('Employe cree'); setModal(false); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Erreur lors de la creation'); }
  };

  const handleUpdate = async (data) => {
    try { await employeesApi.update(editing.id, data); toast.success('Employe modifie'); setEditing(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Erreur lors de la modification'); }
  };

  const handleToggleStatus = async (employee) => {
    try { await employeesApi.toggleStatus(employee.id); toast.success(employee.status === 'active' ? 'Employe desactive' : 'Employe active'); setConfirm(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Changement de statut impossible'); }
  };

  const handleDelete = async (employee) => {
    try { await employeesApi.delete(employee.id); toast.success('Employe archive'); setConfirm(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Suppression impossible'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employes</h1>
          <p className="page-subtitle">{employees.length} employe(s)</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><PlusIcon className="w-4 h-4" /> Nouvel employe</button>
      </div>

      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input-search" placeholder="Rechercher par nom, matricule, poste..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner"><p className="text-gray-500 text-sm">Chargement...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card"><UsersIcon className="w-14 h-14 text-gray-200 mb-3" /><p className="text-gray-500 font-medium">Aucun employe trouve</p></div>
      ) : (
        <div className="table-container overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead><tr>{['Matricule', 'Employe', 'Poste / Departement', 'Statut', 'Actions'].map((header) => <th key={header} className="th">{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((employee) => {
                const status = statusConfig[employee.status] ?? statusConfig.active;
                return (
                  <tr key={employee.id} className="tr-hover">
                    <td className="td"><span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{employee.matricule}</span></td>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">{employee.lastName?.[0]}{employee.firstName?.[0]}</div>
                        <div><p className="font-semibold text-gray-900">{employee.lastName} {employee.firstName}</p>{employee.middleName && <p className="text-xs text-gray-400">{employee.middleName}</p>}</div>
                      </div>
                    </td>
                    <td className="td"><p className="font-medium text-gray-800">{employee.position || '-'}</p>{employee.department && <p className="text-xs text-gray-400">{employee.department}</p>}</td>
                    <td className="td"><span className={status.cls}>{status.label}</span></td>
                    <td className="td">
                      <div className="flex items-center gap-1.5">
                        <Link to={`/app/${companyId}/employees/${employee.id}`} title="Voir" className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"><ChevronRightIcon className="w-4 h-4" /></Link>
                        <button type="button" title="Modifier" onClick={() => setEditing(employee)} className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"><PencilIcon className="w-4 h-4" /></button>
                        <button type="button" title={employee.status === 'active' ? 'Desactiver' : 'Activer'} onClick={() => setConfirm({ type: 'status', item: employee })} className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"><PowerIcon className="w-4 h-4" /></button>
                        <button type="button" title="Archiver" onClick={() => setConfirm({ type: 'delete', item: employee })} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && <Modal title="Nouvel employe" onClose={() => setModal(false)} size="lg"><EmployeeForm companyId={companyId} onSubmit={handleCreate} onClose={() => setModal(false)} /></Modal>}
      {editing && <Modal title="Modifier l'employe" onClose={() => setEditing(null)} size="lg"><EmployeeForm companyId={companyId} initialData={editing} onSubmit={handleUpdate} onClose={() => setEditing(null)} /></Modal>}
      {confirm && (
        <ConfirmationModal
          title={confirm.type === 'delete' ? 'Archiver l employe' : 'Changer le statut'}
          message={confirm.type === 'delete' ? `Archiver ${confirm.item.lastName} ${confirm.item.firstName} ?` : `${confirm.item.status === 'active' ? 'Desactiver' : 'Activer'} ${confirm.item.lastName} ${confirm.item.firstName} ?`}
          confirmLabel="Confirmer"
          tone={confirm.type === 'delete' ? 'danger' : 'primary'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => confirm.type === 'delete' ? handleDelete(confirm.item) : handleToggleStatus(confirm.item)}
        />
      )}
    </div>
  );
}
