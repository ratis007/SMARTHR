import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { employeesApi, platformSettingsApi } from '../../services/api';
import {
  ArrowLeftIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
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
  const [dossier, setDossier] = useState(null);
  const [currency, setCurrency] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    Promise.all([
      employeesApi.getDossier(id),
      platformSettingsApi.getCurrency(companyId),
    ]).then(([dossierRes, currencyRes]) => {
      setDossier(dossierRes.data);
      setCurrency(currencyRes.data);
    });
  }, [id, companyId]);

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

      {tab === 'documents' && <DataTable empty="Aucun document administratif associe" columns={['Nom', 'Type', 'Fichier', 'Date']} rows={dossier.documents.map((d) => [
        d.name, d.type || '-', d.filePath || '-', formatDate(d.createdAt),
      ])} />}

      {tab === 'history' && <DataTable empty="Aucune action historisee pour cet employe" columns={['Date', 'Action', 'Details']} rows={dossier.auditLogs.map((log) => [
        formatDate(log.createdAt), log.action, log.details ? JSON.stringify(log.details) : '-',
      ])} />}
    </div>
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
