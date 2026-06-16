import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { employeeDocumentsApi, employeesApi, platformSettingsApi, usersApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/Modal';
import ConfirmationModal from '../../components/ConfirmationModal';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArchiveBoxArrowDownIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  EyeIcon,
  PlusIcon,
  TrashIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

const tabs = [
  ['overview', 'Synthese'],
  ['contracts', 'Contrat'],
  ['payroll', 'Paie'],
  ['leave', 'Conges'],
  ['documents', 'Documents'],
  ['history', 'Historique'],
];

const statusConfig = {
  active: { label: 'Actif', cls: 'badge-green' },
  inactive: { label: 'Inactif', cls: 'badge-red' },
  suspended: { label: 'Suspendu', cls: 'badge-yellow' },
  draft: { label: 'Brouillon', cls: 'badge-yellow' },
  validated: { label: 'Valide', cls: 'badge-green' },
  paid: { label: 'Paye', cls: 'badge-blue' },
  pending: { label: 'En attente', cls: 'badge-yellow' },
  approved: { label: 'Approuve', cls: 'badge-green' },
  rejected: { label: 'Refuse', cls: 'badge-red' },
  expired: { label: 'Expire', cls: 'badge-red' },
  terminated: { label: 'Termine', cls: 'badge-gray' },
};

export default function CompanyEmployeeDetail() {
  const { companyId, id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dossier, setDossier] = useState(null);
  const [currency, setCurrency] = useState(null);
  const [tab, setTab] = useState('overview');

  const loadDossier = useCallback(async () => {
    const [dossierRes, currencyRes] = await Promise.all([
      employeesApi.getDossier(id),
      platformSettingsApi.getCurrency(companyId),
    ]);
    setDossier(dossierRes.data);
    setCurrency(currencyRes.data);
  }, [id, companyId]);

  useEffect(() => {
    loadDossier().catch(() => toast.error('Chargement du dossier employe impossible'));
  }, [loadDossier]);

  const activeContract = useMemo(() => (
    dossier?.contracts?.find((contract) => contract.status === 'active') || dossier?.contracts?.[0]
  ), [dossier]);

  if (!dossier) {
    return <div className="loading-spinner"><p className="text-gray-500 text-sm">Chargement du dossier employe...</p></div>;
  }

  const employee = dossier.employee;
  const sc = statusConfig[employee.status] || statusConfig.active;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/app/${companyId}/employees`)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl">
          {employee.lastName?.[0]}{employee.firstName?.[0]}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-gray-900">{employee.lastName} {employee.firstName} {employee.middleName}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{employee.matricule}</span>
            <span className={sc.cls}>{sc.label}</span>
            <span className="text-sm text-gray-500">{employee.position || 'Poste non defini'} · {employee.department || 'Departement non defini'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MiniCard title="Contrats" value={dossier.contracts.length} icon={DocumentTextIcon} />
        <MiniCard title="Fiches paie" value={dossier.payrolls.length} icon={BanknotesIcon} />
        <MiniCard title="Conges restants" value={`${dossier.leaveBalance.remainingDays} j`} icon={CalendarDaysIcon} />
        <MiniCard title="Documents" value={dossier.documents.length} icon={UserCircleIcon} />
      </div>

      <div className="border-b border-gray-100">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all ${tab === key ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InfoCard title="Informations personnelles" rows={[
            ['Nom complet', `${employee.lastName} ${employee.middleName || ''} ${employee.firstName}`],
            ['Date de naissance', employee.birthDate],
            ['Nationalite', employee.nationality],
            ['Sexe', employee.gender === 'M' ? 'Masculin' : employee.gender === 'F' ? 'Feminin' : null],
            ['Telephone', employee.phone],
            ['Email', employee.email],
            ['Adresse', employee.address],
          ]} />
          <InfoCard title="Informations professionnelles" rows={[
            ['Entreprise', employee.company?.name],
            ['Departement', employee.department],
            ['Poste', employee.position],
            ['Salaire de base', formatDual(employee.baseSalary, currency)],
            ['Contrat actif', activeContract ? `${activeContract.type} · ${activeContract.status}` : null],
            ['Date entree', activeContract?.startDate],
          ]} />
        </div>
      )}

      {tab === 'contracts' && <DataTable empty="Aucun contrat enregistre" columns={['Type', 'Debut', 'Fin', 'Salaire', 'Statut']} rows={dossier.contracts.map((c) => [
        <span className="badge-blue">{c.type}</span>, c.startDate, c.endDate || 'Indetermine', formatDual(c.salary, currency), <Badge status={c.status} />,
      ])} />}

      {tab === 'payroll' && <DataTable empty="Aucune fiche de paie" columns={['Periode', 'Base', 'Primes', 'Deductions', 'Net', 'Statut']} rows={dossier.payrolls.map((p) => [
        `${p.month}/${p.year}`, formatDual(p.baseSalary, currency), `+${formatDual(p.totalAllowances, currency)}`, `-${formatDual(p.totalDeductions, currency)}`, formatDual(p.netSalary, currency), <Badge status={p.status} />,
      ])} />}

      {tab === 'leave' && (
        <div className="space-y-4">
          <div className="card grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Metric label="Droit annuel" value={`${dossier.leaveBalance.annualEntitlement} j`} />
            <Metric label="Utilises" value={`${dossier.leaveBalance.usedDays} j`} />
            <Metric label="Restants" value={`${dossier.leaveBalance.remainingDays} j`} />
          </div>
          <DataTable empty="Aucune demande de conge" columns={['Type', 'Debut', 'Fin', 'Jours', 'Motif', 'Statut']} rows={dossier.leaves.map((l) => [
            l.type, l.startDate, l.endDate, l.days || '-', l.reason || '-', <Badge status={l.status} />,
          ])} />
        </div>
      )}

      {tab === 'documents' && (
        <DocumentsPanel
          employeeId={employee.id}
          documents={dossier.documents}
          onChanged={loadDossier}
        />
      )}

      {tab === 'history' && (
        <HistoryPanel
          auditLogs={dossier.auditLogs}
          canDelete={canDeleteHistory(user)}
          onChanged={loadDossier}
        />
      )}
    </div>
  );
}

const fallbackDocumentTypes = [
  { value: 'contract', label: 'Contrat de travail' },
  { value: 'diploma', label: 'Diplome' },
  { value: 'id_card', label: "Carte d'identite" },
  { value: 'cv', label: 'CV' },
  { value: 'other', label: 'Autre document' },
];

function HistoryPanel({ auditLogs, canDelete, onChanged }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const deleteHistoryItem = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await usersApi.deleteAuditLog(confirmDelete.id);
      toast.success("Element de l'historique supprime");
      setConfirmDelete(null);
      await onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Suppression de l'historique impossible");
    } finally {
      setDeletingId(null);
    }
  };

  if (!auditLogs.length) {
    return <div className="card empty-state py-12"><p className="text-gray-400">Aucune action historisee pour cet employe</p></div>;
  }

  return (
    <div className="table-container overflow-x-auto">
      <table className="w-full text-sm min-w-[860px]">
        <thead>
          <tr>
            {['Date', 'Action', 'Details', 'Actions'].map((col) => <th key={col} className="th">{col}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {auditLogs.map((log) => (
            <tr key={log.id} className="tr-hover">
              <td className="td">{formatDate(log.createdAt)}</td>
              <td className="td font-semibold text-gray-900">{log.action}</td>
              <td className="td max-w-xl">
                <span className="block truncate" title={formatDetails(log.details)}>{formatDetails(log.details)}</span>
              </td>
              <td className="td">
                {canDelete ? (
                  <IconButton
                    title="Supprimer"
                    disabled={deletingId === log.id}
                    onClick={() => setConfirmDelete(log)}
                    icon={TrashIcon}
                    danger
                  />
                ) : (
                  <span className="text-xs text-gray-400">Non autorise</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmDelete && (
        <ConfirmationModal
          title="Supprimer l'historique"
          message="Etes-vous sur de vouloir supprimer cet element de l'historique ? Cette action est irreversible."
          confirmLabel={deletingId ? 'Suppression...' : 'Confirmer'}
          cancelLabel="Annuler"
          confirmDisabled={Boolean(deletingId)}
          onConfirm={deleteHistoryItem}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function DocumentsPanel({ employeeId, documents, onChanged }) {
  const [config, setConfig] = useState({ maxFileSizeBytes: 10 * 1024 * 1024, maxFileSizeMb: 10, documentTypes: fallbackDocumentTypes });
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    employeeDocumentsApi.config(employeeId)
      .then((res) => setConfig(res.data))
      .catch(() => setConfig((current) => current));
  }, [employeeId]);

  const typeLabel = useCallback((value) => (
    config.documentTypes?.find((type) => type.value === value)?.label || value || '-'
  ), [config.documentTypes]);

  const downloadDocument = async (document, openInNewTab = false) => {
    setBusy(`${openInNewTab ? 'view' : 'download'}-${document.id}`);
    try {
      const res = await employeeDocumentsApi.download(employeeId, document.id);
      saveBlob(res.data, document.fileName || document.name || 'document', openInNewTab);
      if (!openInNewTab) toast.success('Telechargement lance');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Telechargement impossible');
    } finally {
      setBusy(null);
    }
  };

  const exportZip = async () => {
    setBusy('export');
    try {
      const res = await employeeDocumentsApi.exportZip(employeeId);
      saveBlob(res.data, `employee-${employeeId}-documents.zip`);
      toast.success('Export ZIP lance');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export impossible');
    } finally {
      setBusy(null);
    }
  };

  const deleteDocument = async () => {
    if (!confirmDelete) return;
    setBusy(`delete-${confirmDelete.id}`);
    try {
      await employeeDocumentsApi.delete(employeeId, confirmDelete.id);
      toast.success('Document supprime');
      setConfirmDelete(null);
      await onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Suppression impossible');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Documents administratifs</h2>
          <p className="text-sm text-gray-500">PDF, JPG, PNG, DOC ou DOCX jusqu'a {config.maxFileSizeMb} Mo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary flex items-center gap-2" onClick={exportZip} disabled={!documents.length || busy === 'export'}>
            <ArchiveBoxArrowDownIcon className="w-4 h-4" />
            {busy === 'export' ? 'Export...' : 'Exporter ZIP'}
          </button>
          <button type="button" className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <PlusIcon className="w-4 h-4" />
            Importer un document
          </button>
        </div>
      </div>

      {!documents.length ? (
        <div className="card empty-state py-12">
          <DocumentTextIcon className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucun document administratif associe</p>
        </div>
      ) : (
        <div className="table-container overflow-x-auto">
          <table className="w-full text-sm min-w-[920px]">
            <thead>
              <tr>
                {['Nom du document', 'Type', "Date d'importation", 'Taille', 'Actions'].map((col) => <th key={col} className="th">{col}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documents.map((document) => (
                <tr key={document.id} className="tr-hover">
                  <td className="td font-semibold text-gray-900">{document.fileName || document.name}</td>
                  <td className="td"><span className="badge-blue">{typeLabel(document.documentType || document.type)}</span></td>
                  <td className="td">{formatDate(document.createdAt)}</td>
                  <td className="td">{formatFileSize(document.fileSize)}</td>
                  <td className="td">
                    <div className="flex items-center gap-1">
                      <IconButton title="Voir" disabled={busy === `view-${document.id}`} onClick={() => downloadDocument(document, true)} icon={EyeIcon} />
                      <IconButton title="Telecharger" disabled={busy === `download-${document.id}`} onClick={() => downloadDocument(document)} icon={ArrowDownTrayIcon} />
                      <IconButton title="Remplacer" onClick={() => setModal({ mode: 'replace', document })} icon={ArrowPathIcon} />
                      <IconButton title="Supprimer" disabled={busy === `delete-${document.id}`} onClick={() => setConfirmDelete(document)} icon={TrashIcon} danger />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <DocumentUploadModal
          employeeId={employeeId}
          config={config}
          document={modal.document}
          onClose={() => setModal(null)}
          onDone={async () => {
            setModal(null);
            await onChanged();
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmationModal
          title="Supprimer le document"
          message={`Confirmez-vous la suppression de "${confirmDelete.fileName || confirmDelete.name}" ? Cette action est definitive.`}
          confirmLabel="Supprimer"
          onConfirm={deleteDocument}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function DocumentUploadModal({ employeeId, config, document, onClose, onDone }) {
  const [documentType, setDocumentType] = useState(document?.documentType || document?.type || 'contract');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const isReplace = Boolean(document);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Selectionnez un fichier');
      return;
    }
    if (file.size > config.maxFileSizeBytes) {
      toast.error(`Le fichier depasse ${config.maxFileSizeMb} Mo`);
      return;
    }

    const data = new FormData();
    data.append('documentType', documentType);
    data.append('file', file);

    setSubmitting(true);
    try {
      if (isReplace) await employeeDocumentsApi.replace(employeeId, document.id, data);
      else await employeeDocumentsApi.upload(employeeId, data);
      toast.success(isReplace ? 'Document remplace' : 'Document importe');
      await onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || "Importation impossible");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={isReplace ? 'Remplacer le document' : 'Importer un document'} onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Type de document</label>
          <select className="input" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            {(config.documentTypes || fallbackDocumentTypes).map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Fichier</label>
          <input
            className="input"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <p className="mt-2 text-xs text-gray-500">Formats acceptes : PDF, JPG, PNG, DOC, DOCX. Taille maximale : {config.maxFileSizeMb} Mo.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Annuler</button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Importation...' : isReplace ? 'Remplacer' : 'Importer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function IconButton({ icon: Icon, title, onClick, disabled, danger = false }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-500 hover:text-indigo-700 hover:bg-indigo-50'}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function MiniCard({ title, value, icon: Icon }) {
  return (
    <div className="card flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
        <Icon className="w-5 h-5 text-indigo-600" />
      </div>
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase">{title}</p>
        <p className="text-xl font-black text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function InfoCard({ title, rows }) {
  return (
    <div className="card">
      <h2 className="font-bold text-gray-900 mb-4">{title}</h2>
      <div className="space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 last:border-0 text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-semibold text-gray-900 text-right">{value || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataTable({ columns, rows, empty }) {
  if (!rows.length) return <div className="card empty-state py-12"><p className="text-gray-400">{empty}</p></div>;
  return (
    <div className="table-container overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead><tr>{columns.map((col) => <th key={col} className="th">{col}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, idx) => (
            <tr key={idx} className="tr-hover">{row.map((cell, cellIdx) => <td key={cellIdx} className="td">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-bold text-gray-500 uppercase">{label}</p><p className="text-2xl font-black text-gray-900">{value}</p></div>;
}

function Badge({ status }) {
  const config = statusConfig[status] || { label: status || '-', cls: 'badge-gray' };
  return <span className={config.cls}>{config.label}</span>;
}

function formatDual(value, currency) {
  const cdf = Number(value || 0);
  const rate = Number(currency?.usdToCdfRate || 2850);
  const usd = cdf / rate;
  return `${Math.round(cdf).toLocaleString('fr-FR')} FC / ${usd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('fr-FR') : '-';
}

function formatDetails(details) {
  if (!details) return '-';
  if (typeof details === 'string') return details;
  try { return JSON.stringify(details); }
  catch { return '-'; }
}

function canDeleteHistory(user) {
  const roles = user?.roles?.map((role) => typeof role === 'string' ? role : role.name) || [];
  if (roles.includes('super_admin') || roles.includes('admin') || roles.includes('rh_manager')) return true;
  return user?.permissions?.includes('audit:write');
}

function formatFileSize(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Ko`;
  return `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

function saveBlob(blob, fileName, openInNewTab = false) {
  const url = URL.createObjectURL(blob);
  if (openInNewTab) {
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
