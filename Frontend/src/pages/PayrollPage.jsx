import { useEffect, useState } from 'react';
import { payrollApi, employeesApi } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { PlusIcon, CheckIcon, BanknotesIcon } from '@heroicons/react/24/outline';

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const statusConfig = {
  draft:     { label: 'Brouillon', cls: 'badge-yellow' },
  validated: { label: 'Validé',    cls: 'badge-green' },
  paid:      { label: 'Payé',      cls: 'badge-blue' },
};

function GenerateForm({ employees, onSubmit, onClose, initialMonth, initialYear }) {
  const now = new Date();
  const [form, setForm] = useState({
    employeeId: '',
    month: initialMonth ?? now.getMonth() + 1,
    year: initialYear ?? now.getFullYear(),
    baseSalary: '',
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      month: initialMonth ?? current.month,
      year: initialYear ?? current.year,
    }));
  }, [initialMonth, initialYear]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, employeeId: +form.employeeId, month: +form.month, year: +form.year, baseSalary: form.baseSalary ? +form.baseSalary : undefined }); }} className="space-y-4">
      <div>
        <label className="label">Employé *</label>
        <select className="input" value={form.employeeId} onChange={set('employeeId')} required>
          <option value="">Sélectionner un employé...</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.lastName} {e.firstName} — {e.matricule}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Mois *</label>
          <select className="input" value={form.month} onChange={set('month')}>
            {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Année *</label>
          <input type="number" className="input" value={form.year} onChange={set('year')} required />
        </div>
      </div>
      <div>
        <label className="label">Salaire de base (optionnel)</label>
        <input type="number" className="input" value={form.baseSalary} onChange={set('baseSalary')} placeholder="Laisser vide = salaire du contrat" />
      </div>
      <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
        <p className="text-xs font-semibold text-indigo-700 mb-1">🇨🇩 Déductions automatiques RDC</p>
        <p className="text-xs text-indigo-600">CNSS · IPR · INPP · ONEM seront calculés automatiquement selon les taux légaux en vigueur.</p>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Générer la fiche</button>
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
      </div>
    </form>
  );
}

export default function PayrollPage() {
  const now = new Date();
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (loadMonth = month, loadYear = year) => {
    setLoading(true);
    try {
      const [p, e] = await Promise.all([payrollApi.getAll(loadMonth, loadYear), employeesApi.getAll()]);
      setPayrolls(p.data);
      setEmployees(e.data);
    } catch (err) {
      console.error('[PayrollPage] load error', err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [month, year]);

  const handleGenerate = async (data) => {
    try {
      await payrollApi.generate(data);
      toast.success('Fiche de paie générée');
      setMonth(data.month);
      setYear(data.year);
      setModal(false);
      await load(data.month, data.year);
    }
    catch (err) {
      console.error('[PayrollPage] generate error', err);
      toast.error(err.response?.data?.message || 'Erreur lors de la génération');
    }
  };

  const handleValidate = async (id) => {
    try { await payrollApi.validate(id); toast.success('Fiche validée'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const totalMasse = payrolls.reduce((s, p) => s + Number(p.netSalary), 0);
  const totalBrut = payrolls.reduce((s, p) => s + Number(p.baseSalary) + Number(p.totalAllowances), 0);
  const totalDed = payrolls.reduce((s, p) => s + Number(p.totalDeductions), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestion de la Paie</h1>
          <p className="page-subtitle">{MONTH_NAMES[month - 1]} {year} · {payrolls.length} fiche(s)</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Générer une fiche
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Masse salariale nette</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{totalMasse.toLocaleString()} CDF</p>
        </div>
        <div className="card bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">Total brut</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{totalBrut.toLocaleString()} CDF</p>
        </div>
        <div className="card bg-gradient-to-br from-red-50 to-white border-red-100">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Total déductions</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{totalDed.toLocaleString()} CDF</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <select className="input w-44" value={month} onChange={(e) => setMonth(+e.target.value)}>
          {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" className="input w-28" value={year} onChange={(e) => setYear(+e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner"><p className="text-gray-400 text-sm">Chargement...</p></div>
      ) : payrolls.length === 0 ? (
        <div className="empty-state card">
          <BanknotesIcon className="w-14 h-14 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Aucune fiche pour cette période</p>
          <p className="text-gray-400 text-sm mt-1">Générez des fiches de paie pour {MONTH_NAMES[month - 1]} {year}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full text-sm">
            <thead><tr>
              {['Matricule', 'Employé', 'Salaire base', 'Primes', 'Déductions', 'Net à payer', 'Statut', 'Action'].map((h) => (
                <th key={h} className="th">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {payrolls.map((p) => {
                const sc = statusConfig[p.status] ?? statusConfig.draft;
                return (
                  <tr key={p.id} className="tr-hover">
                    <td className="td">
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{p.employee?.matricule}</span>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                          {p.employee?.lastName?.[0]}{p.employee?.firstName?.[0]}
                        </div>
                        <span className="font-medium text-gray-900">{p.employee?.lastName} {p.employee?.firstName}</span>
                      </div>
                    </td>
                    <td className="td">{Number(p.baseSalary).toLocaleString()}</td>
                    <td className="td text-emerald-600 font-medium">+{Number(p.totalAllowances).toLocaleString()}</td>
                    <td className="td text-red-500 font-medium">-{Number(p.totalDeductions).toLocaleString()}</td>
                    <td className="td font-bold text-gray-900">{Number(p.netSalary).toLocaleString()} CDF</td>
                    <td className="td"><span className={sc.cls}>{sc.label}</span></td>
                    <td className="td">
                      {p.status === 'draft' && (
                        <button onClick={() => handleValidate(p.id)} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors">
                          <CheckIcon className="w-3.5 h-3.5" /> Valider
                        </button>
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
        <Modal title="Générer une fiche de paie" onClose={() => setModal(false)}>
          <GenerateForm employees={employees} initialMonth={month} initialYear={year} onSubmit={handleGenerate} onClose={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
