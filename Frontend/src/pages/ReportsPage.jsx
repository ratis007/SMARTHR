import { useEffect, useState } from 'react';
import { reportsApi } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {Number(p.value).toLocaleString()} CDF
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payrollData, setPayrollData] = useState([]);
  const [leaveData, setLeaveData] = useState([]);

  useEffect(() => {
    reportsApi.getPayroll(month, year).then(({ data }) => setPayrollData(data));
    reportsApi.getLeave(year).then(({ data }) => setLeaveData(data));
  }, [month, year]);

  const leaveByType = leaveData.reduce((acc, l) => { acc[l.type] = (acc[l.type] || 0) + 1; return acc; }, {});
  const pieData = Object.entries(leaveByType).map(([name, value]) => ({ name, value }));
  const totalNet = payrollData.reduce((s, p) => s + Number(p.netSalary), 0);
  const totalBrut = payrollData.reduce((s, p) => s + Number(p.baseSalary) + Number(p.totalAllowances), 0);
  const totalDed = payrollData.reduce((s, p) => s + Number(p.totalDeductions), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rapports & Analyses</h1>
          <p className="page-subtitle">Statistiques RH et paie</p>
        </div>
        <div className="flex gap-2">
          <select className="input w-40" value={month} onChange={(e) => setMonth(+e.target.value)}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" className="input w-24" value={year} onChange={(e) => setYear(+e.target.value)} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Net total</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{totalNet.toLocaleString()} CDF</p>
          <p className="text-xs text-indigo-400 mt-0.5">{payrollData.length} employé(s)</p>
        </div>
        <div className="card border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
          <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">Brut total</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{totalBrut.toLocaleString()} CDF</p>
        </div>
        <div className="card border-red-100 bg-gradient-to-br from-red-50 to-white">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Déductions totales</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{totalDed.toLocaleString()} CDF</p>
          <p className="text-xs text-red-400 mt-0.5">CNSS + IPR + INPP + ONEM</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payroll bar chart */}
        <div className="card">
          <div className="mb-5">
            <h3 className="font-semibold text-gray-900">Salaires nets — {MONTHS[month - 1]} {year}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Top 10 employés</p>
          </div>
          {payrollData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">Aucune donnée disponible</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={payrollData.slice(0, 10)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey={(p) => p.employee?.lastName?.slice(0, 8) ?? ''} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="netSalary" fill="#6366f1" radius={[6, 6, 0, 0]} name="Net à payer" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Leave pie chart */}
        <div className="card">
          <div className="mb-5">
            <h3 className="font-semibold text-gray-900">Congés par type — {year}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{leaveData.length} demande(s) au total</p>
          </div>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">Aucune donnée disponible</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" outerRadius={85} innerRadius={40} dataKey="value" paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Payroll detail table */}
      {payrollData.length > 0 && (
        <div className="table-container">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Détail paie — {MONTHS[month - 1]} {year}</h3>
            <span className="badge-gray">{payrollData.length} fiches</span>
          </div>
          <table className="w-full text-sm">
            <thead><tr>
              {['Matricule', 'Employé', 'Salaire base', 'Primes', 'Déductions', 'Net à payer'].map((h) => (
                <th key={h} className="th">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {payrollData.map((p) => (
                <tr key={p.id} className="tr-hover">
                  <td className="td"><span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{p.employee?.matricule}</span></td>
                  <td className="td font-medium text-gray-900">{p.employee?.lastName} {p.employee?.firstName}</td>
                  <td className="td">{Number(p.baseSalary).toLocaleString()}</td>
                  <td className="td text-emerald-600 font-medium">+{Number(p.totalAllowances).toLocaleString()}</td>
                  <td className="td text-red-500 font-medium">-{Number(p.totalDeductions).toLocaleString()}</td>
                  <td className="td font-bold text-gray-900">{Number(p.netSalary).toLocaleString()} CDF</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
