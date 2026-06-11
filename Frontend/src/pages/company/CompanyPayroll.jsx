import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { payrollApi, employeesApi } from '../../services/api';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { PlusIcon, CheckIcon, BanknotesIcon } from '@heroicons/react/24/outline';

const getPayrollEmployeeId = (payroll) => Number(payroll?.employeeId ?? payroll?.employee?.id);

const MONTH_NAMES = ['Janvier','FÃ©vrier','Mars','Avril','Mai','Juin','Juillet','AoÃ»t','Septembre','Octobre','Novembre','DÃ©cembre'];
const statusConfig = {
  draft:     { label: 'Brouillon', cls: 'badge-yellow' },
  validated: { label: 'ValidÃ©',    cls: 'badge-green' },
  paid:      { label: 'PayÃ©',      cls: 'badge-blue' },
};

function GenerateForm({ employees, existingPayrolls = [], onSubmit, onClose, initialMonth, initialYear }) {
  const now = new Date();
  const [form, setForm] = useState({
    employeeId: '',
    month: initialMonth ?? now.getMonth() + 1,
    year: initialYear ?? now.getFullYear(),
    baseSalary: '',
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const usedEmployeeIds = new Set(
    existingPayrolls
      .filter((p) => Number(p.month) === Number(form.month) && Number(p.year) === Number(form.year))
      .map(getPayrollEmployeeId)
  );
  const selectedIsUsed = form.employeeId && usedEmployeeIds.has(Number(form.employeeId));

  useEffect(() => {
    setForm((current) => ({
      ...current,
      month: initialMonth ?? current.month,
      year: initialYear ?? current.year,
    }));
  }, [initialMonth, initialYear]);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (selectedIsUsed) {
        toast.error('Une fiche existe deja pour cet employe sur cette periode');
        return;
      }
      onSubmit({ ...form, employeeId: +form.employeeId, month: +form.month, year: +form.year, baseSalary: form.baseSalary ? +form.baseSalary : undefined });
    }} className="space-y-4">
      <div>
        <label className="label">EmployÃ© *</label>
        <select className="input" value={form.employeeId} onChange={set('employeeId')} required>
          <option value="">SÃ©lectionner un employÃ©...</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.lastName} {e.firstName} â€” {e.matricule}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Mois *</label>
          <select className="input" value={form.month} onChange={set('month')}>
            {MONTH_NAMES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div><label className="label">AnnÃ©e *</label><input type="number" className="input" value={form.year} onChange={set('year')} required /></div>
      </div>
      <div><label className="label">Salaire de base (optionnel)</label><input type="number" className="input" value={form.baseSalary} onChange={set('baseSalary')} placeholder="Laisser vide = salaire du contrat" /></div>
      <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
        <p className="text-xs font-bold text-indigo-700 mb-1">ðŸ‡¨ðŸ‡© DÃ©ductions automatiques RDC</p>
        <p className="text-xs text-indigo-600">CNSS Â· IPR Â· INPP Â· ONEM calculÃ©s selon les taux lÃ©gaux.</p>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">GÃ©nÃ©rer la fiche</button>
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
      </div>
    </form>
  );
}

export default function CompanyPayroll() {
  const { companyId: rawId } = useParams();
  const companyId = rawId ? Number(rawId) : null;

  const now = new Date();
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const pendingPayrollRef = useRef(null);

  const load = async (loadMonth = month, loadYear = year) => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        payrollApi.getAll(loadMonth, loadYear, companyId),
        employeesApi.getAll(companyId),
      ]);
      const pending = pendingPayrollRef.current;
      const visiblePayrolls = Array.isArray(p.data) ? p.data : [];
      const shouldKeepPending = pending &&
        Number(pending.month) === Number(loadMonth) &&
        Number(pending.year) === Number(loadYear) &&
        !visiblePayrolls.some((item) =>
          Number(item.id) === Number(pending.id) ||
          (
            getPayrollEmployeeId(item) === getPayrollEmployeeId(pending) &&
            Number(item.month) === Number(pending.month) &&
            Number(item.year) === Number(pending.year)
          )
        );
      setPayrolls(shouldKeepPending ? [pending, ...visiblePayrolls] : visiblePayrolls);
      setEmployees(e.data);
    } catch (err) {
      console.error('[CompanyPayroll] load error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month, year, companyId]);

  const handleGenerate = async (data) => {
    const exists = payrolls.some((p) =>
      getPayrollEmployeeId(p) === Number(data.employeeId) &&
      Number(p.month) === Number(data.month) &&
      Number(p.year) === Number(data.year)
    );
    if (exists) {
      toast.error('Une fiche existe deja pour cet employe sur cette periode');
      return;
    }

    try {
      const { data: created } = await payrollApi.generate(data);
      const employee = employees.find((e) => Number(e.id) === Number(data.employeeId));
      const payroll = { status: 'draft', ...created, employee: created.employee ?? employee };
      pendingPayrollRef.current = payroll;
      toast.success('Fiche de paie gÃ©nÃ©rÃ©e');
      setMonth(data.month);
      setYear(data.year);
      setPayrolls((current) => {
        const samePeriod = Number(month) === Number(data.month) && Number(year) === Number(data.year);
        const next = current.filter((p) => p.id !== payroll.id);
        return samePeriod ? [payroll, ...next] : [payroll];
      });
      setModal(false);
      await load(data.month, data.year);
    }
    catch (err) {
      if (err.response?.status === 409) {
        toast('Cette fiche existe deja. Liste actualisee.');
        setMonth(data.month);
        setYear(data.year);
        setModal(false);
        await load(data.month, data.year);
        return;
      }
      console.error('[CompanyPayroll] generate error', err);
      toast.error(err.response?.data?.message || 'Erreur lors de la gÃ©nÃ©ration');
    }
  };
  const handleValidate = async (id) => {
    try { await payrollApi.validate(id); toast.success('Fiche validÃ©e'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const totalMasse = payrolls.reduce((s, p) => s + Number(p.netSalary), 0);
  const totalBrut  = payrolls.reduce((s, p) => s + Number(p.baseSalary) + Number(p.totalAllowances), 0);
  const totalDed   = payrolls.reduce((s, p) => s + Number(p.totalDeductions), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestion de la Paie</h1>
          <p className="page-subtitle">{MONTH_NAMES[month-1]} {year} Â· {payrolls.length} fiche(s)</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><PlusIcon className="w-4 h-4" /> GÃ©nÃ©rer une fiche</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Masse salariale nette</p>
          <p className="text-2xl font-extrabold text-indigo-700 mt-1">{totalMasse.toLocaleString('fr-FR')} CDF</p>
        </div>
        <div className="card bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <p className="text-xs font-bold text-emerald-500 uppercase tracking-wide">Total brut</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{totalBrut.toLocaleString('fr-FR')} CDF</p>
        </div>
        <div className="card bg-gradient-to-br from-red-50 to-white border-red-100">
          <p className="text-xs font-bold text-red-400 uppercase tracking-wide">Total dÃ©ductions</p>
          <p className="text-2xl font-extrabold text-red-600 mt-1">{totalDed.toLocaleString('fr-FR')} CDF</p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <select className="input w-44" value={month} onChange={e => setMonth(+e.target.value)}>
          {MONTH_NAMES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <input type="number" className="input w-28" value={year} onChange={e => setYear(+e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner"><p className="text-gray-500 text-sm">Chargement...</p></div>
      ) : payrolls.length === 0 ? (
        <div className="empty-state card">
          <BanknotesIcon className="w-14 h-14 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Aucune fiche pour cette pÃ©riode</p>
          <p className="text-gray-400 text-sm mt-1">GÃ©nÃ©rez des fiches de paie pour {MONTH_NAMES[month-1]} {year}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full text-sm">
            <thead><tr>{['Matricule','EmployÃ©','Salaire base','Primes','DÃ©ductions','Net Ã  payer','Statut','Action'].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {payrolls.map(p => {
                const sc = statusConfig[p.status] ?? statusConfig.draft;
                return (
                  <tr key={p.id} className="tr-hover">
                    <td className="td"><span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{p.employee?.matricule}</span></td>
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                          {p.employee?.lastName?.[0]}{p.employee?.firstName?.[0]}
                        </div>
                        <span className="font-medium text-gray-900">{p.employee?.lastName} {p.employee?.firstName}</span>
                      </div>
                    </td>
                    <td className="td">{Number(p.baseSalary).toLocaleString('fr-FR')}</td>
                    <td className="td text-emerald-600 font-semibold">+{Number(p.totalAllowances).toLocaleString('fr-FR')}</td>
                    <td className="td text-red-500 font-semibold">-{Number(p.totalDeductions).toLocaleString('fr-FR')}</td>
                    <td className="td font-bold text-gray-900">{Number(p.netSalary).toLocaleString('fr-FR')} CDF</td>
                    <td className="td"><span className={sc.cls}>{sc.label}</span></td>
                    <td className="td">
                      {p.status === 'draft' && (
                        <button onClick={() => handleValidate(p.id)} className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors">
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
        <Modal title="GÃ©nÃ©rer une fiche de paie" onClose={() => setModal(false)}>
          <GenerateForm employees={employees} existingPayrolls={payrolls} initialMonth={month} initialYear={year} onSubmit={handleGenerate} onClose={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
