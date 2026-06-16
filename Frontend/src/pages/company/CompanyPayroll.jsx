import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { payrollApi, employeesApi, platformSettingsApi } from '../../services/api';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { PlusIcon, CheckIcon, BanknotesIcon, ArrowTrendingUpIcon, PencilIcon, PowerIcon, TrashIcon, DocumentTextIcon, ArrowDownTrayIcon, LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline';

const getPayrollEmployeeId = (payroll) => Number(payroll?.employeeId ?? payroll?.employee?.id);
const MONTH_NAMES = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];
const statusConfig = {
  draft: { label: 'Brouillon', cls: 'badge-yellow' },
  preparation: { label: 'Preparation', cls: 'badge-yellow' },
  review: { label: 'Verification', cls: 'badge-blue' },
  validated: { label: 'Valide', cls: 'badge-green' },
  closed: { label: 'Cloture', cls: 'badge-gray' },
  paid: { label: 'Paye', cls: 'badge-blue' },
  archived: { label: 'Archive', cls: 'badge-gray' },
};
const workflowNext = {
  draft: { status: 'preparation', label: 'Preparer' },
  preparation: { status: 'review', label: 'Verifier' },
  review: { status: 'validated', label: 'Valider' },
  validated: { status: 'closed', label: 'Cloturer' },
  closed: { status: 'paid', label: 'Marquer paye' },
};
const auditLabels = {
  'payroll:generate': 'Generation fiche',
  'payroll:update': 'Modification fiche',
  'payroll:validate': 'Validation fiche',
  'payroll:workflow': 'Transition workflow',
  'payroll:set_status': 'Changement statut',
  'payroll:archive': 'Archivage fiche',
  'payroll:batch_queued': 'Generation collective lancee',
  'payroll:batch_cancelled': 'Generation collective annulee',
  'payroll:batch_completed': 'Generation collective terminee',
  'payroll_period:close': 'Cloture periode',
  'payroll_period:reopen': 'Reouverture periode',
  'payroll_variables:import_csv': 'Import variables CSV',
  'payroll_time_inputs:import_csv': 'Import temps CSV',
  'payroll_variable:create': 'Variable RH ajoutee',
  'payroll_time:create': 'Temps/presence ajoute',
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

function auditSummary(log) {
  const details = log.details || {};
  const parts = [];
  if (details.employeeId) parts.push(`Employe #${details.employeeId}`);
  if (details.previousStatus || details.nextStatus) parts.push(`${details.previousStatus || '-'} -> ${details.nextStatus || '-'}`);
  if (details.success !== undefined || details.failed !== undefined) parts.push(`${details.success || 0} succes, ${details.failed || 0} erreur(s)`);
  if (details.netSalary !== undefined) parts.push(`Net ${Number(details.netSalary || 0).toLocaleString('fr-FR')} FC`);
  if (details.reason) parts.push(details.reason);
  return parts.join(' · ') || log.entity || 'Action paie';
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

function LegalRateForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({
    contributionCode: 'CNSS',
    label: 'Caisse Nationale de Securite Sociale',
    employeeRate: 0,
    employerRate: 0,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
  });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      onSubmit({
        ...form,
        employeeRate: Number(form.employeeRate || 0),
        employerRate: Number(form.employerRate || 0),
        effectiveTo: form.effectiveTo || undefined,
      });
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Code *</label>
          <select className="input" value={form.contributionCode} onChange={set('contributionCode')}>
            <option value="CNSS">CNSS</option>
            <option value="INPP">INPP</option>
            <option value="ONEM">ONEM</option>
            <option value="OTHER">Autre</option>
          </select>
        </div>
        <div>
          <label className="label">Date effet *</label>
          <input className="input" type="date" value={form.effectiveFrom} onChange={set('effectiveFrom')} required />
        </div>
      </div>
      <div>
        <label className="label">Libelle *</label>
        <input className="input" value={form.label} onChange={set('label')} required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Taux employe %</label>
          <input className="input" type="number" step="0.0001" value={form.employeeRate} onChange={set('employeeRate')} />
        </div>
        <div>
          <label className="label">Taux employeur %</label>
          <input className="input" type="number" step="0.0001" value={form.employerRate} onChange={set('employerRate')} />
        </div>
        <div>
          <label className="label">Fin validite</label>
          <input className="input" type="date" value={form.effectiveTo} onChange={set('effectiveTo')} />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Annuler</button>
      </div>
    </form>
  );
}

function IprBracketForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({
    minAmount: 0,
    maxAmount: '',
    rate: 15,
    fixedAmount: 0,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
  });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      onSubmit({
        minAmount: Number(form.minAmount || 0),
        maxAmount: form.maxAmount === '' ? undefined : Number(form.maxAmount),
        rate: Number(form.rate || 0),
        fixedAmount: Number(form.fixedAmount || 0),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || undefined,
      });
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Minimum FC *</label>
          <input className="input" type="number" value={form.minAmount} onChange={set('minAmount')} required />
        </div>
        <div>
          <label className="label">Maximum FC</label>
          <input className="input" type="number" value={form.maxAmount} onChange={set('maxAmount')} placeholder="Illimite" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Taux % *</label>
          <input className="input" type="number" step="0.0001" value={form.rate} onChange={set('rate')} required />
        </div>
        <div>
          <label className="label">Forfait FC</label>
          <input className="input" type="number" value={form.fixedAmount} onChange={set('fixedAmount')} />
        </div>
        <div>
          <label className="label">Date effet *</label>
          <input className="input" type="date" value={form.effectiveFrom} onChange={set('effectiveFrom')} required />
        </div>
      </div>
      <div>
        <label className="label">Fin validite</label>
        <input className="input" type="date" value={form.effectiveTo} onChange={set('effectiveTo')} />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Annuler</button>
      </div>
    </form>
  );
}

function VariableForm({ employees, month, year, currency, onSubmit, onClose }) {
  const [form, setForm] = useState({
    employeeId: '',
    code: 'PRIME',
    label: 'Prime',
    type: 'allowance',
    category: 'variable_earning',
    amount: '',
    currency: currency?.primaryCurrency || 'CDF',
    taxable: true,
  });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value });

  useEffect(() => {
    setForm((current) => ({ ...current, currency: current.currency || currency?.primaryCurrency || 'CDF' }));
  }, [currency?.primaryCurrency]);

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      onSubmit({
        ...form,
        employeeId: Number(form.employeeId),
        month,
        year,
        amount: Number(form.amount || 0),
      });
    }} className="space-y-4">
      <div>
        <label className="label">Employe *</label>
        <select className="input" value={form.employeeId} onChange={set('employeeId')} required>
          <option value="">Selectionner...</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.lastName} {employee.firstName} - {employee.matricule}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Type *</label>
          <select className="input" value={form.type} onChange={(event) => {
            const type = event.target.value;
            setForm({
              ...form,
              type,
              category: type === 'deduction' ? 'internal_deduction' : 'variable_earning',
              code: type === 'deduction' ? 'RETENUE' : 'PRIME',
              label: type === 'deduction' ? 'Retenue' : 'Prime',
            });
          }}>
            <option value="allowance">Gain / Prime</option>
            <option value="deduction">Retenue</option>
          </select>
        </div>
        <div>
          <label className="label">Code *</label>
          <input className="input" value={form.code} onChange={set('code')} required />
        </div>
      </div>
      <div>
        <label className="label">Libelle *</label>
        <input className="input" value={form.label} onChange={set('label')} required />
      </div>
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <div>
          <label className="label">Montant *</label>
          <input className="input" type="number" value={form.amount} onChange={set('amount')} required />
        </div>
        <div>
          <label className="label">Devise</label>
          <select className="input" value={form.currency} onChange={set('currency')}>
            <option value="CDF">FC</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
      {form.type === 'allowance' && (
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input type="checkbox" checked={form.taxable} onChange={set('taxable')} />
          Imposable
        </label>
      )}
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Annuler</button>
      </div>
    </form>
  );
}

function TimeInputForm({ employees, month, year, onSubmit, onClose }) {
  const [form, setForm] = useState({
    employeeId: '',
    overtimeHours: 0,
    nightHours: 0,
    sundayHours: 0,
    holidayHours: 0,
    unpaidAbsenceDays: 0,
    lateMinutes: 0,
    notes: '',
  });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      onSubmit({
        employeeId: Number(form.employeeId),
        month,
        year,
        overtimeHours: Number(form.overtimeHours || 0),
        nightHours: Number(form.nightHours || 0),
        sundayHours: Number(form.sundayHours || 0),
        holidayHours: Number(form.holidayHours || 0),
        unpaidAbsenceDays: Number(form.unpaidAbsenceDays || 0),
        lateMinutes: Number(form.lateMinutes || 0),
        notes: form.notes || undefined,
      });
    }} className="space-y-4">
      <div>
        <label className="label">Employe *</label>
        <select className="input" value={form.employeeId} onChange={set('employeeId')} required>
          <option value="">Selectionner...</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.lastName} {employee.firstName} - {employee.matricule}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div><label className="label">Heures sup</label><input className="input" type="number" step="0.01" value={form.overtimeHours} onChange={set('overtimeHours')} /></div>
        <div><label className="label">Nuit</label><input className="input" type="number" step="0.01" value={form.nightHours} onChange={set('nightHours')} /></div>
        <div><label className="label">Dimanche</label><input className="input" type="number" step="0.01" value={form.sundayHours} onChange={set('sundayHours')} /></div>
        <div><label className="label">Jours feries</label><input className="input" type="number" step="0.01" value={form.holidayHours} onChange={set('holidayHours')} /></div>
        <div><label className="label">Absences non payees</label><input className="input" type="number" step="0.01" value={form.unpaidAbsenceDays} onChange={set('unpaidAbsenceDays')} /></div>
        <div><label className="label">Retards minutes</label><input className="input" type="number" value={form.lateMinutes} onChange={set('lateMinutes')} /></div>
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input" value={form.notes} onChange={set('notes')} />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Annuler</button>
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
  const [variables, setVariables] = useState([]);
  const [timeInputs, setTimeInputs] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [currency, setCurrency] = useState(null);
  const [engineConfig, setEngineConfig] = useState(null);
  const [rateHistory, setRateHistory] = useState([]);
  const [period, setPeriod] = useState(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [modal, setModal] = useState(false);
  const [engineModal, setEngineModal] = useState(null);
  const [variableModal, setVariableModal] = useState(false);
  const [timeModal, setTimeModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodActionLoading, setPeriodActionLoading] = useState(false);
  const [batchJob, setBatchJob] = useState(null);
  const [amount, setAmount] = useState(100);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const pendingPayrollRef = useRef(null);
  const variableImportRef = useRef(null);
  const timeImportRef = useRef(null);

  const loadCurrency = async () => {
    if (!companyId) return;
    const [currencyRes, historyRes, engineRes] = await Promise.all([
      platformSettingsApi.getCurrency(companyId),
      platformSettingsApi.rateHistory(companyId),
      payrollApi.configuration(companyId),
    ]);
    setCurrency(currencyRes.data);
    setRateHistory(historyRes.data);
    setEngineConfig(engineRes.data);
  };

  const load = async (loadMonth = month, loadYear = year) => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [p, e, v, t, periodRes, auditRes] = await Promise.all([
        payrollApi.getAll(loadMonth, loadYear, companyId),
        employeesApi.getAll(companyId),
        payrollApi.variables({ companyId, month: loadMonth, year: loadYear }),
        payrollApi.timeInputs({ companyId, month: loadMonth, year: loadYear }),
        payrollApi.periodStatus(loadMonth, loadYear, companyId),
        payrollApi.auditTrail(loadMonth, loadYear, companyId),
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
      setVariables(v.data);
      setTimeInputs(t.data);
      setPeriod(periodRes.data);
      setAuditTrail(auditRes.data);
    } catch (err) {
      console.error('[CompanyPayroll] load error', err);
      toast.error('Chargement de la paie impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCurrency().catch(() => toast.error('Configuration devise indisponible')); }, [companyId]);
  useEffect(() => { load(); }, [month, year, companyId]);
  useEffect(() => {
    if (!batchJob || !['queued', 'running'].includes(batchJob.status)) return undefined;
    const timer = setInterval(async () => {
      try {
        const { data } = await payrollApi.getJob(batchJob.id);
        setBatchJob(data);
        if (!['queued', 'running'].includes(data.status)) {
          toast.success(data.failedCount > 0 ? 'Generation terminee avec erreurs' : 'Generation collective terminee');
          await load(month, year);
        }
      } catch {
        toast.error('Suivi du traitement indisponible');
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [batchJob, month, year]);

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
    if (period?.status === 'closed') {
      toast.error('Cette periode de paie est cloturee');
      return;
    }
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

  const handleBatchGenerate = async () => {
    if (period?.status === 'closed') {
      toast.error('Cette periode de paie est cloturee');
      return;
    }
    try {
      const { data } = await payrollApi.generateBatch({ month, year }, companyId);
      setBatchJob(data);
      toast.success('Generation collective lancee');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation collective impossible');
    }
  };

  const handleCancelBatch = async () => {
    if (!batchJob) return;
    try {
      const { data } = await payrollApi.cancelJob(batchJob.id);
      setBatchJob(data);
      toast.success('Generation collective annulee');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Annulation impossible');
    }
  };

  const handleExportJournal = async () => {
    try {
      const { data } = await payrollApi.exportJournal(month, year, companyId);
      saveBlob(data, `journal-paie-${month}-${year}.csv`);
      toast.success('Journal de paie exporte');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export du journal impossible');
    }
  };

  const handleExportJournalExcel = async () => {
    try {
      const { data } = await payrollApi.exportJournalExcel(month, year, companyId);
      saveBlob(data, `journal-paie-${month}-${year}.xls`);
      toast.success('Journal Excel exporte');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export Excel impossible');
    }
  };

  const handleExportBookExcel = async () => {
    try {
      const { data } = await payrollApi.exportBookExcel(month, year, companyId);
      saveBlob(data, `livre-paie-${month}-${year}.xls`);
      toast.success('Livre de paie exporte');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export du livre impossible');
    }
  };

  const handleCreateVariable = async (data) => {
    if (period?.status === 'closed') {
      toast.error('Cette periode de paie est cloturee');
      return;
    }
    try {
      await payrollApi.createVariable(data, companyId);
      toast.success('Element variable ajoute');
      setVariableModal(false);
      await load(month, year);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Ajout de la variable impossible');
    }
  };

  const handleCreateTimeInput = async (data) => {
    if (period?.status === 'closed') {
      toast.error('Cette periode de paie est cloturee');
      return;
    }
    try {
      await payrollApi.createTimeInput(data, companyId);
      toast.success('Temps et presence ajoutes');
      setTimeModal(false);
      await load(month, year);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Ajout temps/presence impossible');
    }
  };

  const handleImportVariables = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (isPeriodClosed) {
      toast.error('Cette periode de paie est cloturee');
      return;
    }
    try {
      const { data } = await payrollApi.importVariablesCsv(file, month, year, companyId);
      toast.success(`${data.success} variable(s) importee(s), ${data.failed} erreur(s)`);
      if (data.errors?.length) console.warn('[Payroll variable import]', data.errors);
      await load(month, year);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import variables impossible');
    }
  };

  const handleImportTimeInputs = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (isPeriodClosed) {
      toast.error('Cette periode de paie est cloturee');
      return;
    }
    try {
      const { data } = await payrollApi.importTimeInputsCsv(file, month, year, companyId);
      toast.success(`${data.success} saisie(s) importee(s), ${data.failed} erreur(s)`);
      if (data.errors?.length) console.warn('[Payroll time import]', data.errors);
      await load(month, year);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import temps/presence impossible');
    }
  };

  const handlePayslip = async (payroll) => {
    try {
      const { data } = await payrollApi.payslip(payroll.id);
      openBlob(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulletin indisponible');
    }
  };

  const handleWorkflow = async (payroll) => {
    if (period?.status === 'closed') {
      toast.error('Cette periode de paie est cloturee');
      return;
    }
    const next = workflowNext[payroll.status];
    if (!next) return;
    try {
      await payrollApi.workflow(payroll.id, next.status);
      toast.success(`Fiche: ${next.label}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transition impossible');
    }
  };

  const handleUpdate = async (data) => {
    if (period?.status === 'closed') {
      toast.error('Cette periode de paie est cloturee');
      return;
    }
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
    if (period?.status === 'closed') {
      toast.error('Cette periode de paie est cloturee');
      return;
    }
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
    if (period?.status === 'closed') {
      toast.error('Cette periode de paie est cloturee');
      return;
    }
    try {
      await payrollApi.delete(payroll.id);
      toast.success('Fiche archivee');
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Suppression impossible');
    }
  };

  const handlePeriodAction = async (action) => {
    setPeriodActionLoading(true);
    try {
      const payload = {
        month,
        year,
        reason: action === 'close' ? 'Cloture depuis le module Paie' : 'Reouverture depuis le module Paie',
      };
      const { data } = action === 'close'
        ? await payrollApi.closePeriod(payload, companyId)
        : await payrollApi.reopenPeriod(payload, companyId);
      setPeriod(data);
      setConfirm(null);
      toast.success(action === 'close' ? 'Periode cloturee' : 'Periode rouverte');
      await load(month, year);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation sur la periode impossible');
    } finally {
      setPeriodActionLoading(false);
    }
  };

  const totalMasse = payrolls.reduce((s, p) => s + Number(p.netSalary), 0);
  const totalBrut = payrolls.reduce((s, p) => s + Number(p.grossSalary || Number(p.baseSalary) + Number(p.totalAllowances)), 0);
  const totalDed = payrolls.reduce((s, p) => s + Number(p.totalDeductions), 0);
  const conversionPreview = convertAmount(amount, fromCurrency, currency);
  const isPeriodClosed = period?.status === 'closed';

  return (
    <div className="space-y-6 animate-fade-in">
      <input ref={variableImportRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={handleImportVariables} />
      <input ref={timeImportRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={handleImportTimeInputs} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Gestion de la Paie</h1>
          <p className="page-subtitle">{MONTH_NAMES[month - 1]} {year} · {payrolls.length} fiche(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportJournal} className="btn-secondary flex items-center gap-2"><ArrowDownTrayIcon className="w-4 h-4" /> CSV</button>
          <button onClick={handleExportJournalExcel} className="btn-secondary flex items-center gap-2"><ArrowDownTrayIcon className="w-4 h-4" /> Journal Excel</button>
          <button onClick={handleExportBookExcel} className="btn-secondary flex items-center gap-2"><ArrowDownTrayIcon className="w-4 h-4" /> Livre Excel</button>
          <button disabled={isPeriodClosed} onClick={() => setVariableModal(true)} className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">Ajouter variable</button>
          <button disabled={isPeriodClosed} onClick={() => setTimeModal(true)} className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">Temps / presence</button>
          <button disabled={isPeriodClosed} onClick={handleBatchGenerate} className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">Generation collective</button>
          <button disabled={isPeriodClosed} onClick={() => setModal(true)} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"><PlusIcon className="w-4 h-4" /> Generer une fiche</button>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${isPeriodClosed ? 'bg-amber-50 ring-amber-100' : 'bg-emerald-50 ring-emerald-100'}`}>
              {isPeriodClosed ? <LockClosedIcon className="w-5 h-5 text-amber-600" /> : <LockOpenIcon className="w-5 h-5 text-emerald-600" />}
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Periode de paie</h2>
              <p className="text-xs text-gray-500">
                {MONTH_NAMES[month - 1]} {year} · {isPeriodClosed ? `cloturee${period?.closedAt ? ` le ${new Date(period.closedAt).toLocaleString('fr-FR')}` : ''}` : 'ouverte aux calculs et ajustements'}
              </p>
              {period?.reason && <p className="text-xs text-gray-400 mt-1">{period.reason}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={isPeriodClosed ? 'badge-yellow' : 'badge-green'}>{isPeriodClosed ? 'Cloturee' : 'Ouverte'}</span>
            <button
              type="button"
              disabled={periodActionLoading}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setConfirm({ type: isPeriodClosed ? 'period_reopen' : 'period_close' })}
            >
              {periodActionLoading ? 'Traitement...' : isPeriodClosed ? 'Rouvrir' : 'Cloturer'}
            </button>
          </div>
        </div>
      </div>

      {batchJob && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900">Generation collective</h2>
              <p className="text-xs text-gray-500">
                {batchJob.processedCount}/{batchJob.totalCount} employes traites · {batchJob.successCount} succes · {batchJob.failedCount} erreur(s)
              </p>
            </div>
            {['queued', 'running'].includes(batchJob.status) && (
              <button type="button" className="btn-secondary" onClick={handleCancelBatch}>Annuler</button>
            )}
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${batchJob.progress || 0}%` }} />
          </div>
          {batchJob.errors?.length > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-700">
              {batchJob.errors.slice(0, 3).map((error, idx) => (
                <div key={idx}>Employe #{error.employeeId}: {error.message}</div>
              ))}
            </div>
          )}
        </div>
      )}

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

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Elements variables RH</h2>
            <p className="text-xs text-gray-500">Primes, bonus, avances, retenues internes et autres elements de {MONTH_NAMES[month - 1]} {year}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-purple">{variables.length} element(s)</span>
            <button
              type="button"
              disabled={isPeriodClosed}
              className="btn-secondary py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => variableImportRef.current?.click()}
            >
              Import CSV
            </button>
          </div>
        </div>
        {variables.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun element variable saisi pour cette periode.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {variables.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="font-bold text-gray-900">{item.label}</div>
                <div className="text-gray-500 mt-1">{item.matricule} · {item.type === 'deduction' ? 'Retenue' : 'Gain'} · {money(Number(item.amount || 0), item.currency || 'CDF')}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Temps et presence</h2>
            <p className="text-xs text-gray-500">Heures supplementaires, nuit, dimanche, jours feries, absences et retards.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-blue">{timeInputs.length} saisie(s)</span>
            <button
              type="button"
              disabled={isPeriodClosed}
              className="btn-secondary py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => timeImportRef.current?.click()}
            >
              Import CSV
            </button>
          </div>
        </div>
        {timeInputs.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune saisie temps/presence pour cette periode.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {timeInputs.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="font-bold text-gray-900">{item.matricule} · {item.last_name} {item.first_name}</div>
                <div className="text-gray-500 mt-1">HS {Number(item.overtime_hours || 0)}h · Nuit {Number(item.night_hours || 0)}h · Abs {Number(item.unpaid_absence_days || 0)}j</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {engineConfig && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-bold text-gray-900">Moteur de paie RDC</h2>
              <p className="text-xs text-gray-500">Rubriques configurables, taux legaux historises et bareme IPR versionne.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="badge-blue">{engineConfig.rubrics?.length || 0} rubriques</span>
              <span className="badge-green">{engineConfig.legalRates?.length || 0} taux legaux</span>
              <span className="badge-yellow">{engineConfig.iprBrackets?.length || 0} tranche(s) IPR</span>
              <button type="button" className="btn-secondary py-1.5 px-3" onClick={() => setEngineModal('rate')}>Ajouter taux</button>
              <button type="button" className="btn-secondary py-1.5 px-3" onClick={() => setEngineModal('ipr')}>Ajouter IPR</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(engineConfig.legalRates || []).slice(0, 3).map((rate) => (
              <div key={rate.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="font-bold text-gray-900">{rate.contribution_code}</div>
                <div className="text-gray-500 mt-1">Employe {Number(rate.employee_rate || 0).toLocaleString('fr-FR')}% · Employeur {Number(rate.employer_rate || 0).toLocaleString('fr-FR')}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-bold text-gray-900">Tracabilite paie</h2>
            <p className="text-xs text-gray-500">Actions auditees sur {MONTH_NAMES[month - 1]} {year}: generation, workflow, imports et clotures.</p>
          </div>
          <span className="badge-gray">{auditTrail.length} action(s)</span>
        </div>
        {auditTrail.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune action auditee sur cette periode.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {auditTrail.slice(0, 8).map((log) => (
              <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-gray-900">{auditLabels[log.action] || log.action}</div>
                  <div className="text-xs text-gray-500 mt-1">{auditSummary(log)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold text-gray-600">{new Date(log.createdAt).toLocaleDateString('fr-FR')}</div>
                  <div className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                        {workflowNext[p.status] && !isPeriodClosed && (
                          <button type="button" title={workflowNext[p.status].label} onClick={() => handleWorkflow(p)} className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors">
                            <CheckIcon className="w-4 h-4" />
                          </button>
                        )}
                        {p.status === 'draft' && !isPeriodClosed && (
                          <button type="button" title="Modifier" onClick={() => setEditing(p)} className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button type="button" title="Bulletin" onClick={() => handlePayslip(p)} className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors">
                          <DocumentTextIcon className="w-4 h-4" />
                        </button>
                        {!isPeriodClosed && (
                          <button type="button" title={p.status === 'archived' ? 'Activer' : 'Archiver'} onClick={() => setConfirm({ type: 'status', item: p })} className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors">
                            <PowerIcon className="w-4 h-4" />
                          </button>
                        )}
                        {p.status === 'draft' && !isPeriodClosed && (
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
      {engineModal === 'rate' && (
        <Modal title="Ajouter un taux legal" onClose={() => setEngineModal(null)}>
          <LegalRateForm
            onClose={() => setEngineModal(null)}
            onSubmit={async (data) => {
              try {
                await payrollApi.createLegalRate(data, companyId);
                toast.success('Taux legal ajoute');
                setEngineModal(null);
                await loadCurrency();
              } catch (err) {
                toast.error(err.response?.data?.message || 'Ajout du taux impossible');
              }
            }}
          />
        </Modal>
      )}
      {engineModal === 'ipr' && (
        <Modal title="Ajouter une tranche IPR" onClose={() => setEngineModal(null)}>
          <IprBracketForm
            onClose={() => setEngineModal(null)}
            onSubmit={async (data) => {
              try {
                await payrollApi.createIprBracket(data, companyId);
                toast.success('Tranche IPR ajoutee');
                setEngineModal(null);
                await loadCurrency();
              } catch (err) {
                toast.error(err.response?.data?.message || 'Ajout de la tranche impossible');
              }
            }}
          />
        </Modal>
      )}
      {variableModal && (
        <Modal title="Ajouter un element variable" onClose={() => setVariableModal(false)}>
          <VariableForm
            employees={employees}
            month={month}
            year={year}
            currency={currency}
            onClose={() => setVariableModal(false)}
            onSubmit={handleCreateVariable}
          />
        </Modal>
      )}
      {timeModal && (
        <Modal title="Ajouter temps et presence" onClose={() => setTimeModal(false)}>
          <TimeInputForm
            employees={employees}
            month={month}
            year={year}
            onClose={() => setTimeModal(false)}
            onSubmit={handleCreateTimeInput}
          />
        </Modal>
      )}
      {editing && (
        <Modal title="Modifier la fiche" onClose={() => setEditing(null)}>
          <UpdatePayrollForm payroll={editing} currency={currency} onSubmit={handleUpdate} onClose={() => setEditing(null)} />
        </Modal>
      )}
      {confirm && (
        <Modal
          title={
            confirm.type === 'delete'
              ? 'Archiver la fiche'
              : confirm.type === 'period_close'
                ? 'Cloturer la periode'
                : confirm.type === 'period_reopen'
                  ? 'Rouvrir la periode'
                  : 'Changer le statut'
          }
          onClose={() => setConfirm(null)}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {confirm.type === 'delete' && 'Archiver cette fiche de paie ?'}
              {confirm.type === 'status' && `${confirm.item.status === 'archived' ? 'Activer' : 'Archiver'} cette fiche de paie ?`}
              {confirm.type === 'period_close' && 'Cloturer cette periode de paie ? Les generations, modifications, variables et saisies temps seront bloquees.'}
              {confirm.type === 'period_reopen' && 'Rouvrir cette periode de paie pour autoriser de nouveaux ajustements ?'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={periodActionLoading}
                onClick={() => {
                  if (confirm.type === 'delete') return handleDelete(confirm.item);
                  if (confirm.type === 'status') return handleToggleStatus(confirm.item);
                  if (confirm.type === 'period_close') return handlePeriodAction('close');
                  if (confirm.type === 'period_reopen') return handlePeriodAction('reopen');
                  return undefined;
                }}
              >
                {periodActionLoading ? 'Traitement...' : 'Confirmer'}
              </button>
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

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
