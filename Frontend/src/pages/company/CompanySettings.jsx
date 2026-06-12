import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useCurrentCompany } from '../../contexts/CompanyContext';
import { companiesApi, platformSettingsApi } from '../../services/api';
import {
  BellIcon,
  BuildingOfficeIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const SETTING_TYPES = [
  { key: 'department', label: 'Departements', hint: 'Services, divisions ou unites internes' },
  { key: 'position', label: 'Postes et fonctions', hint: 'Intitules de poste, grades et fonctions' },
  { key: 'document_type', label: 'Types de documents', hint: 'Contrat, fiche, attestation, piece RH' },
  { key: 'category', label: 'Categories', hint: 'Familles metier, classifications ou groupes' },
  { key: 'status', label: 'Statuts personnalises', hint: 'Etats adaptes aux processus de l entreprise' },
  { key: 'field', label: 'Champs obligatoires', hint: 'Champs requis ou optionnels selon vos regles' },
  { key: 'workflow', label: 'Workflows', hint: 'Etapes, validations et circuits metier' },
  { key: 'notification', label: 'Notifications', hint: 'Alertes email, rappels et evenements' },
  { key: 'numbering', label: 'Numerotation', hint: 'Formats de references et sequences' },
];

const emptySetting = {
  settingType: 'department',
  name: '',
  code: '',
  description: '',
  isRequired: false,
  isActive: true,
};

export default function CompanySettings() {
  const { company, companyId, reloadCompany } = useCurrentCompany();
  const [companyForm, setCompanyForm] = useState(null);
  const [settings, setSettings] = useState([]);
  const [activeType, setActiveType] = useState('department');
  const [settingForm, setSettingForm] = useState(emptySetting);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (company) {
      setCompanyForm({
        name: company.name || '',
        rccm: company.rccm || '',
        idNat: company.idNat || '',
        taxNumber: company.taxNumber || '',
        address: company.address || '',
        phone: company.phone || '',
        email: company.email || '',
      });
    }
  }, [company]);

  const loadSettings = async () => {
    if (!companyId) return;
    const { data } = await platformSettingsApi.getCompanySettings(companyId);
    setSettings(data);
  };

  useEffect(() => {
    loadSettings().catch(() => toast.error('Parametres entreprise indisponibles'));
  }, [companyId]);

  const groupedSettings = useMemo(() => settings.reduce((acc, item) => {
    acc[item.settingType] = [...(acc[item.settingType] || []), item];
    return acc;
  }, {}), [settings]);

  const activeItems = groupedSettings[activeType] || [];
  const activeMeta = SETTING_TYPES.find((item) => item.key === activeType);

  const saveCompany = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await companiesApi.update(companyId, companyForm);
      await reloadCompany();
      toast.success('Informations entreprise enregistrees');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Enregistrement impossible');
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (event) => {
    event.preventDefault();
    try {
      await platformSettingsApi.createCompanySetting(companyId, {
        ...settingForm,
        settingType: activeType,
        config: buildConfig(activeType, settingForm),
      });
      setSettingForm({ ...emptySetting, settingType: activeType });
      await loadSettings();
      toast.success('Parametre ajoute');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Ajout impossible');
    }
  };

  const removeSetting = async (id) => {
    await platformSettingsApi.deleteCompanySetting(id);
    setSettings((prev) => prev.filter((item) => item.id !== id));
    toast.success('Parametre supprime');
  };

  const setActive = (type) => {
    setActiveType(type);
    setSettingForm({ ...emptySetting, settingType: type });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Parametres de l'entreprise</h1>
        <p className="page-subtitle">Adaptez l'espace entreprise a vos secteurs, processus et donnees metier</p>
      </div>

      {companyForm && (
        <form onSubmit={saveCompany} className="card space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center ring-1 ring-indigo-100">
              <BuildingOfficeIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Informations de l'entreprise</h2>
              <p className="text-xs text-gray-500">Identite, coordonnees et informations legales</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nom" value={companyForm.name} onChange={(value) => setCompanyForm({ ...companyForm, name: value })} required />
            <Field label="RCCM" value={companyForm.rccm} onChange={(value) => setCompanyForm({ ...companyForm, rccm: value })} />
            <Field label="ID National" value={companyForm.idNat} onChange={(value) => setCompanyForm({ ...companyForm, idNat: value })} />
            <Field label="Numero fiscal" value={companyForm.taxNumber} onChange={(value) => setCompanyForm({ ...companyForm, taxNumber: value })} />
            <Field label="Telephone" value={companyForm.phone} onChange={(value) => setCompanyForm({ ...companyForm, phone: value })} />
            <Field label="Email" type="email" value={companyForm.email} onChange={(value) => setCompanyForm({ ...companyForm, email: value })} />
            <div className="md:col-span-2">
              <Field label="Adresse" value={companyForm.address} onChange={(value) => setCompanyForm({ ...companyForm, address: value })} />
            </div>
          </div>

          <button className="btn-primary" disabled={loading} type="submit">
            Enregistrer l'entreprise
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
        <div className="card p-3">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest px-3 py-2">Dictionnaires metier</p>
          <div className="space-y-1">
            {SETTING_TYPES.map((item) => {
              const count = (groupedSettings[item.key] || []).length;
              const isActive = activeType === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActive(item.key)}
                  className={`w-full text-left rounded-xl px-3 py-3 transition-colors ${
                    isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold">{item.label}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                  </div>
                  <p className={`text-xs mt-1 ${isActive ? 'text-white/75' : 'text-gray-400'}`}>{item.hint}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <form onSubmit={saveSetting} className="card space-y-4">
            <div className="flex items-center gap-3">
              <SettingIcon type={activeType} />
              <div>
                <h2 className="font-bold text-gray-900">{activeMeta?.label}</h2>
                <p className="text-xs text-gray-500">{activeMeta?.hint}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nom" value={settingForm.name} onChange={(value) => setSettingForm({ ...settingForm, name: value })} required />
              <Field label="Code / reference" value={settingForm.code} onChange={(value) => setSettingForm({ ...settingForm, code: value })} />
              <div className="md:col-span-2">
                <label className="label">Description ou regle</label>
                <textarea
                  className="input min-h-[92px]"
                  value={settingForm.description}
                  onChange={(event) => setSettingForm({ ...settingForm, description: event.target.value })}
                  placeholder={placeholderFor(activeType)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={settingForm.isRequired}
                  onChange={(event) => setSettingForm({ ...settingForm, isRequired: event.target.checked })}
                />
                Obligatoire
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={settingForm.isActive}
                  onChange={(event) => setSettingForm({ ...settingForm, isActive: event.target.checked })}
                />
                Actif
              </label>
            </div>

            <button className="btn-primary" type="submit">
              <PlusIcon className="w-4 h-4" />
              Ajouter
            </button>
          </form>

          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Nom</th>
                  <th className="th">Code</th>
                  <th className="th">Regles</th>
                  <th className="th">Etat</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((item) => (
                  <tr key={item.id} className="tr-hover border-b border-gray-100">
                    <td className="td font-semibold">{item.name}</td>
                    <td className="td text-gray-500">{item.code || '-'}</td>
                    <td className="td text-gray-500 max-w-md">{item.description || '-'}</td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {item.isRequired && <span className="badge-yellow">Obligatoire</span>}
                        <span className={item.isActive ? 'badge-green' : 'badge-gray'}>{item.isActive ? 'Actif' : 'Inactif'}</span>
                      </div>
                    </td>
                    <td className="td">
                      <button className="btn-ghost text-red-600" type="button" onClick={() => removeSetting(item.id)}>
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!activeItems.length && (
                  <tr>
                    <td colSpan="5" className="td text-center text-gray-400 py-10">
                      Aucun parametre defini pour cette section.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function SettingIcon({ type }) {
  const iconClass = 'w-5 h-5 text-indigo-600';
  const Icon = type === 'notification' ? BellIcon : type === 'document_type' ? DocumentTextIcon : Cog6ToothIcon;
  return (
    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center ring-1 ring-indigo-100">
      <Icon className={iconClass} />
    </div>
  );
}

function placeholderFor(type) {
  const map = {
    department: 'Ex: Service Finance, Service RH, Direction Technique',
    position: 'Ex: Comptable senior, Agent RH, Superviseur paie',
    document_type: 'Ex: Contrat CDI, attestation de travail, piece d identite',
    category: 'Ex: Cadre, agent de maitrise, consultant, journalier',
    status: 'Ex: En attente, valide, suspendu, archive',
    field: 'Ex: Matricule requis, telephone optionnel, document obligatoire',
    workflow: 'Ex: Brouillon -> Validation RH -> Validation Direction -> Archive',
    notification: 'Ex: Alerte 15 jours avant fin de contrat',
    numbering: 'Ex: EMP-{YYYY}-{0000}, CTR-{COMPANY}-{0000}',
  };
  return map[type] || '';
}

function buildConfig(type, form) {
  return {
    type,
    required: form.isRequired,
    active: form.isActive,
    referenceFormat: type === 'numbering' ? form.code : undefined,
  };
}
