import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { payrollApi, employeesApi, platformSettingsApi } from '../../services/api';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { PlusIcon, CheckIcon, BanknotesIcon, ArrowTrendingUpIcon, PencilIcon, PowerIcon, TrashIcon } from '@heroicons/react/24/outline';

const getPayrollEmployeeId = (payroll) => Number(payroll?.employeeId ?? payroll?.employee?.id);
const MONTH_NAMES = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];
const statusConfig = {
  draft: { label: 'Brouillon', cls: 'badge-yellow' },
  validated: { label: 'Valide', cls: 'badge-green' },
  paid: { label: 'Paye', cls: 'badge-blue' },
};

const money = (value, currency = 'CDF') => {
  const amount = Number(value || 0);
  if (currency === 'USD') {
    return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
  }
  return `${Math.round(amount).toLocaleString('fr-FR')} FC`;
};

const convertAmount = (amount, from, currency) => {
  const rate = Number(currency?.usdToCdfRate || 2850);
  const value = Number(amount || 0);
  const cdf = from === 'USD' ? value * rate : value;
  const usd = from === 'CDF' ? value / rate : value;
  return {
    CDF: applyRounding(cdf, 0, currency?.roundingMode),
    USD: applyRounding(usd, Number(currency?.roundingPrecision ?? 2), currency?.roundingMode),
    rate,
  };
};

const applyRounding = (value, precision, mode = 'nearest') => {
  const factor = Math.pow(10, precision);
  if (mode === 'up') return Math.ceil(value * factor) / factor;
  if (mode === 'down') return Math.floor(value * factor) / factor;
  return Math.round(value * factor) / factor;
};

function DualMoney({ value, currency }) {
  const converted = convertAmount(value, 'CDF', currency);
  const primary = currency?.primaryCurrency || 'CDF';
  return (
    <div className="leading-tight">
      <div className="font-bold text-gray-900">{money(converted[primary], primary)}</div>
      <div className="text-xs text-gray-500">{primary === 'CDF' ? money(converted.USD, 'USD') : money(converted.CDF, 'CDF')}</div>
    </div>
  );
}

function GenerateForm({ employees, existingPayrolls = [], currency, onSubmit, onClose, initialMonth, initialYear }) {
  const now = new Date();
  const [form, setForm] = useState({
    employeeId: '',
    month: initialMonth ?? now.getMonth() + 1,
    year: initialYear ?? now.getFullYear(),
    baseSalary: '',
    salaryCurrency: currency?.primaryCurrency || 'CDF',
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const usedEmployeeIds = new Set(
    existingPayrolls
      .filter((p) => Number(p.month) === Number(form.month) && Number(p.year) === Number(form.year))
      .map(getPayrollEmployeeId)
  );
  const selectedIsUsed = form.employeeId && usedEmployeeIds.has(Number(form.employeeId));
  const preview = convertAmount(form.baseSalary, form.salaryCurrency, currency);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      month: initialMonth ?? current.month,
      year: initialYear ?? current.year,
      salaryCurrency: current.salaryCurrency || currency?.primaryCurrency || 'CDF',
    }));
  }, [initialMonth, initialYear, currency?.primaryCurrency]);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (selectedIsUsed) {
        toast.error('Une fiche existe deja pour cet employe sur cette periode');
        return;
      }
      onSubmit({
        employeeId: +form.employeeId,
        month: +form.month,
        year: +form.year,
        baseSalary: form.baseSalary ? preview.CDF : undefined,
      });
    }} className="space-y-4">
      <div>
        <label className="label">Employe *</label>
        <select className="input" value={form.employeeId} onChange={set('employeeId')} required>
          <option value="">Selectionner un employe...</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.lastName} {e.firstName} - {e.matricule}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Mois *</label>
          <select className="input" value={form.month} onChange={set('month')}>
            {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div><label className="label">Annee *</label><input type="number" className="input" value={form.year} onChange={set('year')} required /></div>
      </div>
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <div>
          <label className="label">Salaire de base</label>
          <input type="number" className="input" value={form.baseSalary} onChange={set('baseSalary')} placeholder="Ex: 100" />
        </div>
        <div>
          <label className="label">Devise</label>
          <select className="input" value={form.salaryCurrency} onChange={set('salaryCurrency')}>
            <option value="CDF">FC</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
      {form.baseSalary && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-sm">
          <p className="font-bold text-indigo-800">Conversion automatique</p>
          <p className="text-indigo-700 mt-1">USD : {money(preview.USD, 'USD')} · FC : {money(preview.CDF, 'CDF')}</p>
          <p className="text-xs text-indigo-500 mt-1">Taux applique : 1 USD = {Number(preview.rate).toLocaleString('fr-FR')} FC</p>
        </div>
      )}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
        <p className="text-xs font-bold text-slate-700 mb-1">Deductions automatiques RDC</p>
        <p className="text-xs text-slate-500">CNSS, IPR, INPP et ONEM sont calcules sur le montant converti en FC.</p>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Generer la fiche</button>
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
      </div>
    </form>
  );
}

function UpdatePayrollForm({ payroll, currency, onSubmit, onClose }) {
  const initialAllowance = payroll.details?.find((detail) => detail.type === 'allowance');
  const [form, setForm] = useState({
    month: payroll.month,
    year: payroll.year,
    baseSalary: payroll.baseSalary ?? '',
    salaryCurrency: 'CDF',
    allowanceLabel: initialAllowance?.label ?? '',
    allowanceAmount: initialAllowance?.amount ?? '',
  });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const preview = convertAmount(form.baseSalary, form.salaryCurrency, currency);

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      onSubmit({
        month: Number(form.month),
        year: Number(form.year),
        baseSalary: form.baseSalary ? preview.CDF : undefined,
        allowances: form.allowanceAmount ? [{ label: form.allowanceLabel || 'Prime', amount: Number(form.allowanceAmount) }] : [],
      });
    }} className="space-y-4">
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
        <p className="font-bold text-slate-800">{payroll.employee?.lastName} {payroll.employee?.firstName}</p>
        <p className="text-slate-500">{payroll.employee?.matricule}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Mois *</label>
          <select className="input" value={form.month} onChange={set('month')}>
            {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div><label className="label">Annee *</label><input type="number" className="input" value={form.year} onChange={set('year')} required /></div>
      </div>
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <div><label className="label">Salaire de base</label><input type="number" className="input" value={form.baseSalary} onChange={set('baseSalary')} /></div>
        <div><label className="label">Devise</label><select className="input" value={form.salaryCurrency} onChange={set('salaryCurrency')}><option value="CDF">FC</option><option value="USD">USD</option></select></div>
      </div>
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <div><label className="label">Prime</label><input className="input" value={form.allowanceLabel} onChange={set('allowanceLabel')} placeholder="Ex: Transport" /></div>
        <div><label className="label">Montant FC</label><input type="number" className="input" value={form.allowanceAmount} onChange={set('allowanceAmount')} /></div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
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
  const [currency, setCurrency] = useState(null);
  const [rateHistory, setRateHistory] = useState([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(100);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const pendingPayrollRef = useRef(null);

  const loadCurrency = async () => {
    if (!companyId) return;
    const [currencyRes, historyRes] = await Promise.all([
      platformSettingsApi.getCurrency(companyId),
      platformSettingsApi.rateHistory(companyId),
    ]);
    setCurrency(currencyRes.data);
    setRateHistory(historyRes.data);
  };

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
      toast.error('Chargement de la paie impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCurrency().catch(() => toast.error('Configuration devise indisponible')); }, [companyId]);
  useEffect(() => { load(); }, [month, year, companyId]);

  const saveCurrency = async (event) => {
    event.preventDefault();
    try {
      const { data } = await platformSettingsApi.updateCurrency(companyId, {
        ...currency,
        usdToCdfRate: Number(currency.usdToCdfRate),
        roundingPrecision: Number(currency.roundingPrecision || 2),
      });
      setCurrency(data);
      await loadCurrency();
      toast.success('Configuration multidevise enregistree');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Enregistrement devise impossible');
    }
  };

  const fetchCurrencyRate = async () => {
    try {
      const { data } = await platformSettingsApi.fetchCurrencyRate(companyId);
      setCurrency(data);
      await loadCurrency();
      toast.success('Taux API applique');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Taux API indisponible');
    }
  };

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
      toast.success('Fiche de paie generee');
      setMonth(data.month);
      setYear(data.year);
      setPayrolls((current) => {
        const samePeriod = Number(month) === Number(data.month) && Number(year) === Number(data.year);
        const next = current.filter((p) => p.id !== payroll.id);
        return samePeriod ? [payroll, ...next] : [payroll];
      });
      setModal(false);
      await load(data.month, data.year);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la generation');
    }
  };

  const handleValidate = async (id) => {
    try { await payrollApi.validate(id); toast.success('Fiche validee'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handleUpdate = async (data) => {
    try {
      await payrollApi.update(editing.id, data);
      toast.success('Fiche modifiee');
      setEditing(null);
      await load(data.month, data.year);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Modification impossible');
    }
  };

  const handleToggleStatus = async (payroll) => {
    try {
      await payrollApi.toggleStatus(payroll.id);
      toast.success(payroll.status === 'archived' ? 'Fiche activee' : 'Fiche archivee');
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Changement de statut impossible');
    }
  };

  const handleDelete = async (payroll) => {
    try {
      await payrollApi.delete(payroll.id);
      toast.success('Fiche archivee');
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Suppression impossible');
    }
  };

  const totalMasse = payrolls.reduce((s, p) => s + Number(p.netSalary), 0);
  const totalBrut = payrolls.reduce((s, p) => s + Number(p.baseSalary) + Number(p.totalAllowances), 0);
  const totalDed = payrolls.reduce((s, p) => s + Number(p.totalDeductions), 0);
  const conversionPreview = convertAmount(amount, fromCurrency, currency);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestion de la Paie</h1>
          <p className="page-subtitle">{MONTH_NAMES[month - 1]} {year} · {payrolls.length} fiche(s)</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><PlusIcon className="w-4 h-4" /> Generer une fiche</button>
      </div>

      {currency && (
        <form onSubmit={saveCurrency} className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center ring-1 ring-indigo-100">
                <ArrowTrendingUpIcon className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Conversion monetaire FC / USD</h2>
                <p className="text-xs text-gray-500">Taux courant : 1 USD = {Number(currency.usdToCdfRate).toLocaleString('fr-FR')} FC · Source {currency.rateSource}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" type="button" onClick={fetchCurrencyRate}>Taux API</button>
              <button className="btn-primary" type="submit">Enregistrer</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="label">Devise principale</label>
              <select className="input" value={currency.primaryCurrency} onChange={(e) => setCurrency({ ...currency, primaryCurrency: e.target.value })}>
                <option value="CDF">FC / CDF</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="label">Taux USD vers FC</label>
              <input className="input" type="number" step="0.0001" value={currency.usdToCdfRate} onChange={(e) => setCurrency({ ...currency, usdToCdfRate: e.target.value })} />
            </div>
            <div>
              <label className="label">Arrondi</label>
              <select className="input" value={currency.roundingMode} onChange={(e) => setCurrency({ ...currency, roundingMode: e.target.value })}>
                <option value="nearest">Au plus proche</option>
                <option value="up">Superieur</option>
                <option value="down">Inferieur</option>
              </select>
            </div>
            <div>
              <label className="label">Montant test</label>
              <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">Devise test</label>
              <select className="input" value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)}>
                <option value="USD">USD</option>
                <option value="CDF">FC</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
            <span className="font-bold text-slate-800">Exemple applique : </span>
            USD : {money(conversionPreview.USD, 'USD')} · FC : {money(conversionPreview.CDF, 'CDF')}
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="Masse salariale nette" value={totalMasse} currency={currency} tone="indigo" />
        <SummaryCard title="Total brut" value={totalBrut} currency={currency} tone="emerald" />
        <SummaryCard title="Total deductions" value={totalDed} currency={currency} tone="red" />
      </div>

      <div className="flex gap-3 items-center">
        <select className="input w-44" value={month} onChange={(e) => setMonth(+e.target.value)}>
          {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" className="input w-28" value={year} onChange={(e) => setYear(+e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner"><p className="text-gray-500 text-sm">Chargement...</p></div>
      ) : payrolls.length === 0 ? (
        <div className="empty-state card">
          <BanknotesIcon className="w-14 h-14 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Aucune fiche pour cette periode</p>
          <p className="text-gray-400 text-sm mt-1">Generez des fiches de paie pour {MONTH_NAMES[month - 1]} {year}</p>
        </div>
      ) : (
        <div className="table-container overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead><tr>{['Matricule', 'Employe', 'Salaire base', 'Primes', 'Deductions', 'Net a payer', 'Statut', 'Action'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {payrolls.map((p) => {
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
                    <td className="td"><DualMoney value={p.baseSalary} currency={currency} /></td>
                    <td className="td text-emerald-600"><DualMoney value={p.totalAllowances} currency={currency} /></td>
                    <td className="td text-red-500"><DualMoney value={p.totalDeductions} currency={currency} /></td>
                    <td className="td"><DualMoney value={p.netSalary} currency={currency} /></td>
                    <td className="td"><span className={sc.cls}>{sc.label}</span></td>
                    <td className="td">
                      <div className="flex items-center gap-1.5">
                        {p.status === 'draft' && (
                          <button type="button" title="Valider" onClick={() => handleValidate(p.id)} className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors">
                            <CheckIcon className="w-4 h-4" />
                          </button>
                        )}
                        {p.status === 'draft' && (
                          <button type="button" title="Modifier" onClick={() => setEditing(p)} className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button type="button" title={p.status === 'archived' ? 'Activer' : 'Archiver'} onClick={() => setConfirm({ type: 'status', item: p })} className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors">
                          <PowerIcon className="w-4 h-4" />
                        </button>
                        {p.status === 'draft' && (
                          <button type="button" title="Supprimer" onClick={() => setConfirm({ type: 'delete', item: p })} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rateHistory.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-3">Historique des taux utilises</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {rateHistory.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-200 p-3 text-sm">
                <div className="font-bold">1 {item.fromCurrency} = {Number(item.rate).toLocaleString('fr-FR')} {item.toCurrency}</div>
                <div className="text-gray-500">{item.source} · {new Date(item.effectiveAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <Modal title="Generer une fiche de paie" onClose={() => setModal(false)}>
          <GenerateForm employees={employees} existingPayrolls={payrolls} currency={currency} initialMonth={month} initialYear={year} onSubmit={handleGenerate} onClose={() => setModal(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title="Modifier la fiche" onClose={() => setEditing(null)}>
          <UpdatePayrollForm payroll={editing} currency={currency} onSubmit={handleUpdate} onClose={() => setEditing(null)} />
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.type === 'delete' ? 'Archiver la fiche' : 'Changer le statut'} onClose={() => setConfirm(null)} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {confirm.type === 'delete'
                ? 'Archiver cette fiche de paie ?'
                : `${confirm.item.status === 'archived' ? 'Activer' : 'Archiver'} cette fiche de paie ?`}
            </p>
            <div className="flex gap-3">
              <button type="button" className="btn-primary flex-1 justify-center" onClick={() => confirm.type === 'delete' ? handleDelete(confirm.item) : handleToggleStatus(confirm.item)}>Confirmer</button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setConfirm(null)}>Annuler</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({ title, value, currency, tone }) {
  const color = {
    indigo: 'from-indigo-50 to-white border-indigo-100 text-indigo-700 text-indigo-500',
    emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-700 text-emerald-500',
    red: 'from-red-50 to-white border-red-100 text-red-600 text-red-400',
  }[tone];
  const converted = convertAmount(value, 'CDF', currency);
  const primary = currency?.primaryCurrency || 'CDF';
  return (
    <div className={`card bg-gradient-to-br ${color}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-75">{title}</p>
      <p className="text-2xl font-extrabold mt-1">{money(converted[primary], primary)}</p>
      <p className="text-xs font-semibold opacity-70 mt-1">{primary === 'CDF' ? money(converted.USD, 'USD') : money(converted.CDF, 'CDF')}</p>
    </div>
  );
}
