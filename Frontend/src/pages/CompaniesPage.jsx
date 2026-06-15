import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { companiesApi } from '../services/api';
import Modal from '../components/Modal';
import CompanyDeleteModal from '../components/CompanyDeleteModal';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, BuildingOfficeIcon, MagnifyingGlassIcon, ArrowRightIcon, PowerIcon } from '@heroicons/react/24/outline';

function CompanyForm({ initial, onSubmit, onClose }) {
  const [form, setForm] = useState(initial || { name: '', rccm: '', idNat: '', taxNumber: '', address: '', phone: '', email: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div>
        <label className="label">Nom de l'entreprise *</label>
        <input className="input" value={form.name} onChange={set('name')} placeholder="Ex: ACME SARL" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">RCCM</label>
          <input className="input" value={form.rccm} onChange={set('rccm')} placeholder="CD/KIN/RCCM/..." />
        </div>
        <div>
          <label className="label">ID National</label>
          <input className="input" value={form.idNat} onChange={set('idNat')} />
        </div>
        <div>
          <label className="label">Numéro Fiscal</label>
          <input className="input" value={form.taxNumber} onChange={set('taxNumber')} />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input className="input" value={form.phone} onChange={set('phone')} placeholder="+243..." />
        </div>
      </div>
      <div>
        <label className="label">Adresse</label>
        <input className="input" value={form.address} onChange={set('address')} placeholder="Kinshasa, RDC" />
      </div>
      <div>
        <label className="label">Email</label>
        <input type="email" className="input" value={form.email} onChange={set('email')} placeholder="contact@entreprise.cd" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
      </div>
    </form>
  );
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [navigatingId, setNavigatingId] = useState(null);
  const [lifecycleCompany, setLifecycleCompany] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    companiesApi.getAll().then(({ data }) => setCompanies(data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data) => {
    try { await companiesApi.create(data); toast.success('Entreprise créée'); setModal(null); load(); }
    catch { toast.error('Erreur lors de la création'); }
  };
  const handleUpdate = async (data) => {
    try { await companiesApi.update(modal.edit.id, data); toast.success('Mise à jour effectuée'); setModal(null); load(); }
    catch { toast.error('Erreur lors de la mise à jour'); }
  };
  const handleArchive = async (company) => {
    try {
      await companiesApi.archive(company.id);
      toast.success('Entreprise archivee');
      setLifecycleCompany(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Archivage impossible");
    }
  };

  const handleHardDelete = async (company) => {
    try {
      await companiesApi.delete(company.id);
      toast.success('Entreprise supprimee definitivement');
      setLifecycleCompany(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Suppression definitive impossible');
    }
  };

  const handleToggleStatus = async (company) => {
    try {
      await companiesApi.toggleStatus(company.id);
      toast.success(company.isActive !== false ? 'Entreprise archivee' : 'Entreprise activee');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Changement de statut impossible');
    }
  };

  const handleManage = (id) => {
    setNavigatingId(id);
    // Courte pause pour afficher le spinner, puis navigation
    setTimeout(() => navigate(`/app/${id}/dashboard`), 300);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Entreprises</h1>
          <p className="page-subtitle">{companies.length} entreprise(s) enregistrée(s)</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Nouvelle entreprise
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input-search" placeholder="Rechercher une entreprise..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner"><p className="text-gray-400 text-sm">Chargement...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <BuildingOfficeIcon className="w-14 h-14 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Aucune entreprise trouvée</p>
          <p className="text-gray-400 text-sm mt-1">Commencez par ajouter votre première entreprise</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="card-hover group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center ring-1 ring-indigo-100">
                  <BuildingOfficeIcon className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setModal({ edit: c })} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleToggleStatus(c)} title={c.isActive !== false ? 'Archiver' : 'Activer'} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                    <PowerIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => setLifecycleCompany(c)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 text-base mb-1">{c.name}</h3>
              <div className="space-y-1 mb-3">
                {c.rccm && <p className="text-xs text-gray-500">RCCM: <span className="font-medium text-gray-700">{c.rccm}</span></p>}
                {c.address && <p className="text-xs text-gray-500 truncate">📍 {c.address}</p>}
                {c.phone && <p className="text-xs text-gray-500">📞 {c.phone}</p>}
                {c.email && <p className="text-xs text-gray-500 truncate">✉️ {c.email}</p>}
              </div>
              <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                <span className={c.isActive !== false ? 'badge-green' : 'badge-red'}>
                  {c.isActive !== false ? '● Active' : '● Inactive'}
                </span>
                {c.taxNumber && <span className="text-xs text-gray-400">NIF: {c.taxNumber}</span>}
              </div>
              {/* Bouton Gérer */}
              <button
                onClick={() => handleManage(c.id)}
                disabled={navigatingId === c.id}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold transition-all duration-150 shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {navigatingId === c.id ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Chargement...
                  </>
                ) : (
                  <>
                    <ArrowRightIcon className="w-4 h-4" />
                    Gérer
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {modal === 'create' && (
        <Modal title="Nouvelle entreprise" onClose={() => setModal(null)}>
          <CompanyForm onSubmit={handleCreate} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.edit && (
        <Modal title="Modifier l'entreprise" onClose={() => setModal(null)}>
          <CompanyForm initial={modal.edit} onSubmit={handleUpdate} onClose={() => setModal(null)} />
        </Modal>
      )}
      {lifecycleCompany && (
        <CompanyDeleteModal
          company={lifecycleCompany}
          onCancel={() => setLifecycleCompany(null)}
          onArchive={() => handleArchive(lifecycleCompany)}
          onHardDelete={() => handleHardDelete(lifecycleCompany)}
        />
      )}
    </div>
  );
}
