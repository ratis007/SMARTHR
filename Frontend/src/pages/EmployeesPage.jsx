import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { employeesApi, companiesApi } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { PlusIcon, MagnifyingGlassIcon, UsersIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

function EmployeeForm({ companies, onSubmit, onClose }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', middleName: '', birthDate: '',
    nationality: 'Congolaise', gender: 'M', address: '', phone: '', email: '',
    department: '', position: '', baseSalary: '', companyId: '',
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, baseSalary: +form.baseSalary, companyId: +form.companyId }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Nom *</label>
          <input className="input" value={form.lastName} onChange={set('lastName')} placeholder="KABILA" required />
        </div>
        <div>
          <label className="label">Prénom *</label>
          <input className="input" value={form.firstName} onChange={set('firstName')} placeholder="Jean" required />
        </div>
        <div>
          <label className="label">Postnom</label>
          <input className="input" value={form.middleName} onChange={set('middleName')} />
        </div>
        <div>
          <label className="label">Date de naissance</label>
          <input type="date" className="input" value={form.birthDate} onChange={set('birthDate')} />
        </div>
        <div>
          <label className="label">Sexe</label>
          <select className="input" value={form.gender} onChange={set('gender')}>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </div>
        <div>
          <label className="label">Nationalité</label>
          <input className="input" value={form.nationality} onChange={set('nationality')} />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input className="input" value={form.phone} onChange={set('phone')} placeholder="+243..." />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="label">Département</label>
          <input className="input" value={form.department} onChange={set('department')} />
        </div>
        <div>
          <label className="label">Poste</label>
          <input className="input" value={form.position} onChange={set('position')} />
        </div>
        <div>
          <label className="label">Salaire de base (CDF)</label>
          <input type="number" className="input" value={form.baseSalary} onChange={set('baseSalary')} placeholder="0" />
        </div>
        <div>
          <label className="label">Entreprise *</label>
          <select className="input" value={form.companyId} onChange={set('companyId')} required>
            <option value="">Sélectionner...</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Adresse</label>
          <input className="input" value={form.address} onChange={set('address')} placeholder="Kinshasa, RDC" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
      </div>
    </form>
  );
}

const statusConfig = {
  active:   { label: 'Actif',    cls: 'badge-green' },
  inactive: { label: 'Inactif',  cls: 'badge-red' },
  suspended:{ label: 'Suspendu', cls: 'badge-yellow' },
};

const GENDERS = { M: '♂', F: '♀' };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([employeesApi.getAll(), companiesApi.getAll()])
      .then(([e, c]) => {
        setEmployees(e.data);
        setTotal(e.meta?.total ?? e.data.length);
        setCompanies(c.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = employees.filter((e) =>
    `${e.firstName} ${e.lastName} ${e.matricule} ${e.department ?? ''} ${e.position ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data) => {
    try { await employeesApi.create(data); toast.success('Employé créé avec succès'); setModal(false); load(); }
    catch { toast.error('Erreur lors de la création'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employés</h1>
          <p className="page-subtitle">{total} employé(s) au total</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Nouvel employé
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input-search" placeholder="Rechercher par nom, matricule, poste..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner"><p className="text-gray-400 text-sm">Chargement...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <UsersIcon className="w-14 h-14 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Aucun employé trouvé</p>
          <p className="text-gray-400 text-sm mt-1">Modifiez votre recherche ou ajoutez un employé</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Matricule', 'Employé', 'Poste / Département', 'Entreprise', 'Statut', ''].map((h) => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((e) => {
                const sc = statusConfig[e.status] ?? statusConfig.active;
                return (
                  <tr key={e.id} className="tr-hover">
                    <td className="td">
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{e.matricule}</span>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                          {e.lastName?.[0]}{e.firstName?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{e.lastName} {e.firstName}</p>
                          {e.middleName && <p className="text-xs text-gray-400">{e.middleName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <p className="font-medium text-gray-800">{e.position || '—'}</p>
                      {e.department && <p className="text-xs text-gray-400">{e.department}</p>}
                    </td>
                    <td className="td text-gray-600">{e.company?.name || '—'}</td>
                    <td className="td"><span className={sc.cls}>{sc.label}</span></td>
                    <td className="td">
                      <Link to={`/employees/${e.id}`} className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium text-xs group">
                        Voir <ChevronRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title="Nouvel employé" onClose={() => setModal(false)} size="lg">
          <EmployeeForm companies={companies} onSubmit={handleCreate} onClose={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
