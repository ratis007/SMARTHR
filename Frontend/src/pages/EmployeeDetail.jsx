import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employeesApi, contractsApi, leaveApi, payrollApi } from '../services/api';
import { ArrowLeftIcon, UserCircleIcon } from '@heroicons/react/24/outline';

const TABS = [
  { id: 'info', label: 'Informations' },
  { id: 'contracts', label: 'Contrats' },
  { id: 'payroll', label: 'Paie' },
  { id: 'leave', label: 'Congés' },
];

const statusConfig = {
  active:    { label: 'Actif',     cls: 'badge-green' },
  inactive:  { label: 'Inactif',   cls: 'badge-red' },
  validated: { label: 'Validé',    cls: 'badge-green' },
  paid:      { label: 'Payé',      cls: 'badge-blue' },
  draft:     { label: 'Brouillon', cls: 'badge-yellow' },
  approved:  { label: 'Approuvé',  cls: 'badge-green' },
  rejected:  { label: 'Refusé',    cls: 'badge-red' },
  pending:   { label: 'En attente',cls: 'badge-yellow' },
};

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-gray-50 last:border-0">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || '—'}</span>
    </div>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [tab, setTab] = useState('info');

  useEffect(() => {
    employeesApi.getOne(id).then(({ data }) => setEmployee(data));
    contractsApi.getAll(id).then(({ data }) => setContracts(data));
    payrollApi.getAll().then(({ data }) => setPayrolls(data.filter((p) => p.employeeId === +id)));
    leaveApi.getAll(id).then(({ data }) => setLeaves(data));
  }, [id]);

  if (!employee) return (
    <div className="loading-spinner">
      <p className="text-gray-400 text-sm">Chargement du profil...</p>
    </div>
  );

  const sc = statusConfig[employee.status] ?? statusConfig.active;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl shadow-sm">
            {employee.lastName?.[0]}{employee.firstName?.[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{employee.lastName} {employee.firstName} {employee.middleName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{employee.matricule}</span>
              {employee.position && <span className="text-sm text-gray-500">· {employee.position}</span>}
              <span className={sc.cls}>{sc.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100">
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all duration-150 ${
                tab === t.id
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Informations */}
      {tab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          <div className="card">
            <h3 className="section-title">Identité</h3>
            <InfoRow label="Matricule" value={employee.matricule} />
            <InfoRow label="Nom" value={employee.lastName} />
            <InfoRow label="Prénom" value={employee.firstName} />
            <InfoRow label="Postnom" value={employee.middleName} />
            <InfoRow label="Date de naissance" value={employee.birthDate} />
            <InfoRow label="Nationalité" value={employee.nationality} />
            <InfoRow label="Sexe" value={employee.gender === 'M' ? 'Masculin' : 'Féminin'} />
          </div>
          <div className="card">
            <h3 className="section-title">Coordonnées & Poste</h3>
            <InfoRow label="Téléphone" value={employee.phone} />
            <InfoRow label="Email" value={employee.email} />
            <InfoRow label="Adresse" value={employee.address} />
            <InfoRow label="Département" value={employee.department} />
            <InfoRow label="Poste" value={employee.position} />
            <InfoRow label="Salaire de base" value={employee.baseSalary ? `${Number(employee.baseSalary).toLocaleString()} CDF` : null} />
            <InfoRow label="Entreprise" value={employee.company?.name} />
          </div>
        </div>
      )}

      {/* Tab: Contrats */}
      {tab === 'contracts' && (
        <div className="table-container animate-fade-in">
          {contracts.length === 0 ? (
            <div className="empty-state py-12"><p className="text-gray-400">Aucun contrat enregistré</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr>
                {['Type', 'Date début', 'Date fin', 'Salaire', 'Statut'].map((h) => <th key={h} className="th">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {contracts.map((c) => (
                  <tr key={c.id} className="tr-hover">
                    <td className="td"><span className="badge-blue">{c.type}</span></td>
                    <td className="td">{c.startDate}</td>
                    <td className="td">{c.endDate || <span className="text-gray-400">Indéterminé</span>}</td>
                    <td className="td font-semibold">{Number(c.salary).toLocaleString()} CDF</td>
                    <td className="td"><span className={statusConfig[c.status]?.cls ?? 'badge-gray'}>{statusConfig[c.status]?.label ?? c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Paie */}
      {tab === 'payroll' && (
        <div className="table-container animate-fade-in">
          {payrolls.length === 0 ? (
            <div className="empty-state py-12"><p className="text-gray-400">Aucune fiche de paie</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr>
                {['Période', 'Salaire base', 'Primes', 'Déductions', 'Net à payer', 'Statut'].map((h) => <th key={h} className="th">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {payrolls.map((p) => (
                  <tr key={p.id} className="tr-hover">
                    <td className="td font-medium">{p.month}/{p.year}</td>
                    <td className="td">{Number(p.baseSalary).toLocaleString()}</td>
                    <td className="td text-emerald-600 font-medium">+{Number(p.totalAllowances).toLocaleString()}</td>
                    <td className="td text-red-500 font-medium">-{Number(p.totalDeductions).toLocaleString()}</td>
                    <td className="td font-bold text-gray-900">{Number(p.netSalary).toLocaleString()} CDF</td>
                    <td className="td"><span className={statusConfig[p.status]?.cls ?? 'badge-gray'}>{statusConfig[p.status]?.label ?? p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Congés */}
      {tab === 'leave' && (
        <div className="table-container animate-fade-in">
          {leaves.length === 0 ? (
            <div className="empty-state py-12"><p className="text-gray-400">Aucune demande de congé</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr>
                {['Type', 'Date début', 'Date fin', 'Motif', 'Statut'].map((h) => <th key={h} className="th">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {leaves.map((l) => (
                  <tr key={l.id} className="tr-hover">
                    <td className="td font-medium">{l.type}</td>
                    <td className="td">{l.startDate}</td>
                    <td className="td">{l.endDate}</td>
                    <td className="td text-gray-500 max-w-xs truncate">{l.reason || '—'}</td>
                    <td className="td"><span className={statusConfig[l.status]?.cls ?? 'badge-gray'}>{statusConfig[l.status]?.label ?? l.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
