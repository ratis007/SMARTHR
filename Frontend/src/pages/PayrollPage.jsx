import { useEffect, useRef, useState } from 'react';
import { payrollApi, employeesApi } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { BanknotesIcon, CheckIcon, PencilIcon, PlusIcon, PowerIcon, TrashIcon } from '@heroicons/react/24/outline';

const getPayrollEmployeeId = (payroll) => Number(payroll?.employeeId ?? payroll?.employee?.id);
const MONTH_NAMES = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];
const statusConfig = {
  draft: { label: 'Brouillon', cls: 'badge-yellow' },
  validated: { label: 'Valide', cls: 'badge-green' },
  paid: { label: 'Paye', cls: 'badge-blue' },
  archived: { label: 'Archive', cls: 'badge-red' },
};

function PayrollForm({ employees, existingPayrolls = [], initialData, onSubmit, onClose, initialMonth, initialYear }) {
  const now = new Date();
  const initialAllowance = initialData?.details?.find((detail) => detail.type === 'allowance');
  const [form, setForm] = useState({
    employeeId: initialData ? String(getPayrollEmployeeId(initialData)) : '',
    month: initialData?.month ?? initialMonth ?? now.getMonth() + 1,
    year: initialData?.year ?? initialYear ?? now.getFullYear(),
    baseSalary: initialData?.baseSalary ?? '',
    allowanceLabel: initialAllowance?.label ?? '',
    allowanceAmount: initialAllowance?.amount ?? '',
  });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const isEditing = Boolean(initialData);
  const usedEmployeeIds = new Set(
    existingPayrolls
      .filter((payroll) => Number(payroll.month) === Number(form.month) && Number(payroll.year) === Number(form.year) && Number(payroll.id) !== Number(initialData?.id))
      .map(getPayrollEmployeeId)
  );
  const selectedIsUsed = form.employeeId && usedEmployeeIds.has(Number(form.employeeId));

  const submit = (event) => {
    event.preventDefault();
    if (selectedIsUsed) {
      toast.error('Une fiche existe deja pour cet employe sur cette periode');
      return;
    }
    const allowances = form.allowanceAmount
      ? [{ label: form.allowanceLabel || 'Prime', amount: Number(form.allowanceAmount) }]
      : [];
    onSubmit({
      employeeId: Number(form.employeeId),
      month: Number(form.month),
      year: Number(form.year),
      baseSalary: form.baseSalary ? Number(form.baseSalary) : undefined,
      allowances,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Employe *</label>
        <select className="input" value={form.employeeId} onChange={set('employeeId')} required disabled={isEditing}>
          <option value="">Selectionner un employe...</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.lastName} {employee.firstName} - {employee.matricule}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Mois *</label><select className="input" value={form.month} onChange={set('month')}>{MONTH_NAMES.map((month, index) => <option key={index + 1} value={index + 1}>{month}</option>)}</select></div>
        <div><label className="label">Annee *</label><input type="number" className="input" value={form.year} onChange={set('year')} required /></div>
      </div>
      <div><label className="label">Salaire de base</label><input type="number" className="input" value={form.baseSalary ?? ''} onChange={set('baseSalary')} placeholder="Laisser vide = salaire employe" /></div>
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <div><label className="label">Prime</label><input className="input" value={form.allowanceLabel} onChange={set('allowanceLabel')} placeholder="Ex: Transport" /></div>
        <div><label className="label">Montant</label><input type="number" className="input" value={form.allowanceAmount} onChange={set('allowanceAmount')} /></div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">{isEditing ? 'Enregistrer' : 'Generer la fiche'}</button>
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
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const pendingPayrollRef = useRef(null);

  const load = async (loadMonth = month, loadYear = year) => {
    setLoading(true);
    try {
      const [payrollRes, employeeRes] = await Promise.all([payrollApi.getAll(loadMonth, loadYear), employeesApi.getAll()]);
      const pending = pendingPayrollRef.current;
      const visiblePayrolls = Array.isArray(payrollRes.data) ? payrollRes.data : [];
      const shouldKeepPending = pending && Number(pending.month) === Number(loadMonth) && Number(pending.year) === Number(loadYear) && !visiblePayrolls.some((item) => Number(item.id) === Number(pending.id));
      setPayrolls(shouldKeepPending ? [pending, ...visiblePayrolls] : visiblePayrolls);
      setEmployees(employeeRes.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Chargement de la paie impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month, year]);

  const handleGenerate = async (data) => {
    try {
      const { data: created } = await payrollApi.generate(data);
      pendingPayrollRef.current = { status: 'draft', ...created, employee: created.employee ?? employees.find((employee) => Number(employee.id) === Number(data.employeeId)) };
      toast.success('Fiche de paie generee');
      setMonth(data.month);
      setYear(data.year);
      setModal(false);
      await load(data.month, data.year);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la generation');
    }
  };
  const handleUpdate = async (data) => {
    try { await payrollApi.update(editing.id, data); toast.success('Fiche modifiee'); setEditing(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Modification impossible'); }
  };
  const handleValidate = async (id) => {
    try { await payrollApi.validate(id); toast.success('Fiche validee'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Validation impossible'); }
  };
  const handleToggleStatus = async (payroll) => {
    try { await payrollApi.toggleStatus(payroll.id); toast.success(payroll.status === 'archived' ? 'Fiche activee' : 'Fiche archivee'); setConfirm(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Changement de statut impossible'); }
  };
  const handleDelete = async (payroll) => {
    try { await payrollApi.delete(payroll.id); toast.success('Fiche archivee'); setConfirm(null); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Suppression impossible'); }
  };

  const totalMasse = payrolls.reduce((sum, payroll) => sum + Number(payroll.netSalary), 0);
  const totalBrut = payrolls.reduce((sum, payroll) => sum + Number(payroll.baseSalary) + Number(payroll.totalAllowances), 0);
  const totalDed = payrolls.reduce((sum, payroll) => sum + Number(payroll.totalDeductions), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Gestion de la Paie</h1><p className="page-subtitle">{MONTH_NAMES[month - 1]} {year} - {payrolls.length} fiche(s)</p></div>
        <button onClick={() => setModal(true)} className="btn-primary"><PlusIcon className="w-4 h-4" /> Generer une fiche</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard tone="indigo" title="Masse salariale nette" value={totalMasse} />
        <SummaryCard tone="emerald" title="Total brut" value={totalBrut} />
        <SummaryCard tone="red" title="Total deductions" value={totalDed} />
      </div>

      <div className="flex gap-3 items-center">
        <select className="input w-44" value={month} onChange={(event) => setMonth(Number(event.target.value))}>{MONTH_NAMES.map((name, index) => <option key={index + 1} value={index + 1}>{name}</option>)}</select>
        <input type="number" className="input w-28" value={year} onChange={(event) => setYear(Number(event.target.value))} />
      </div>

      {loading ? (
        <div className="loading-spinner"><p className="text-gray-400 text-sm">Chargement...</p></div>
      ) : payrolls.length === 0 ? (
        <div className="empty-state card"><BanknotesIcon className="w-14 h-14 text-gray-200 mb-3" /><p className="text-gray-500 font-medium">Aucune fiche pour cette periode</p></div>
      ) : (
        <div className="table-container overflow-x-auto">
          <table className="w-full text-sm min-w-[1080px]">
            <thead><tr>{['Matricule', 'Employe', 'Salaire base', 'Primes', 'Deductions', 'Net a payer', 'Statut', 'Actions'].map((header) => <th key={header} className="th">{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {payrolls.map((payroll) => {
                const status = statusConfig[payroll.status] ?? statusConfig.draft;
                return (
                  <tr key={payroll.id} className="tr-hover">
                    <td className="td"><span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{payroll.employee?.matricule}</span></td>
                    <td className="td"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">{payroll.employee?.lastName?.[0]}{payroll.employee?.firstName?.[0]}</div><span className="font-medium text-gray-900">{payroll.employee?.lastName} {payroll.employee?.firstName}</span></div></td>
                    <td className="td">{Number(payroll.baseSalary).toLocaleString('fr-FR')}</td>
                    <td className="td text-emerald-600 font-medium">+{Number(payroll.totalAllowances).toLocaleString('fr-FR')}</td>
                    <td className="td text-red-500 font-medium">-{Number(payroll.totalDeductions).toLocaleString('fr-FR')}</td>
                    <td className="td font-bold text-gray-900">{Number(payroll.netSalary).toLocaleString('fr-FR')} CDF</td>
                    <td className="td"><span className={status.cls}>{status.label}</span></td>
                    <td className="td"><PayrollActions payroll={payroll} onValidate={handleValidate} onEdit={setEditing} onConfirm={setConfirm} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && <Modal title="Generer une fiche de paie" onClose={() => setModal(false)}><PayrollForm employees={employees} existingPayrolls={payrolls} initialMonth={month} initialYear={year} onSubmit={handleGenerate} onClose={() => setModal(false)} /></Modal>}
      {editing && <Modal title="Modifier la fiche" onClose={() => setEditing(null)}><PayrollForm employees={employees} existingPayrolls={payrolls} initialData={editing} onSubmit={handleUpdate} onClose={() => setEditing(null)} /></Modal>}
      {confirm && <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} onDelete={handleDelete} onToggle={handleToggleStatus} />}
    </div>
  );
}

function SummaryCard({ title, value, tone }) {
  const color = {
    indigo: 'from-indigo-50 to-white border-indigo-100 text-indigo-700 text-indigo-500',
    emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-700 text-emerald-500',
    red: 'from-red-50 to-white border-red-100 text-red-600 text-red-400',
  }[tone];
  return <div className={`card bg-gradient-to-br ${color}`}><p className="text-xs font-semibold uppercase tracking-wide opacity-75">{title}</p><p className="text-2xl font-bold mt-1">{Number(value).toLocaleString('fr-FR')} CDF</p></div>;
}

function PayrollActions({ payroll, onValidate, onEdit, onConfirm }) {
  return (
    <div className="flex items-center gap-1.5">
      {payroll.status === 'draft' && <button type="button" title="Valider" onClick={() => onValidate(payroll.id)} className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"><CheckIcon className="w-4 h-4" /></button>}
      {payroll.status === 'draft' && <button type="button" title="Modifier" onClick={() => onEdit(payroll)} className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"><PencilIcon className="w-4 h-4" /></button>}
      <button type="button" title={payroll.status === 'archived' ? 'Activer' : 'Archiver'} onClick={() => onConfirm({ type: 'status', item: payroll })} className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"><PowerIcon className="w-4 h-4" /></button>
      {payroll.status === 'draft' && <button type="button" title="Supprimer" onClick={() => onConfirm({ type: 'delete', item: payroll })} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>}
    </div>
  );
}

function ConfirmModal({ confirm, onClose, onDelete, onToggle }) {
  return (
    <Modal title={confirm.type === 'delete' ? 'Archiver la fiche' : 'Changer le statut'} onClose={onClose} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{confirm.type === 'delete' ? 'Archiver cette fiche de paie ?' : `${confirm.item.status === 'archived' ? 'Activer' : 'Archiver'} cette fiche de paie ?`}</p>
        <div className="flex gap-3">
          <button type="button" className="btn-primary flex-1 justify-center" onClick={() => confirm.type === 'delete' ? onDelete(confirm.item) : onToggle(confirm.item)}>Confirmer</button>
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </Modal>
  );
}
