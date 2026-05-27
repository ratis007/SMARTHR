import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCurrentCompany } from '../../contexts/CompanyContext';
import { reportsApi } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

export default function CompanyReports() {
  const { companyId: rawId } = useParams();
  const companyId = rawId ? Number(rawId) : null;
  const { company } = useCurrentCompany();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payrollData, setPayrollData] = useState([]);
  const [leaveData, setLeaveData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      reportsApi.getPayroll(month, year, companyId),
      reportsApi.getLeave(year, companyId),
    ])
      .then(([p, l]) => { setPayrollData(p.data); setLeaveData(l.data); })
      .finally(() => setLoading(false));
  }, [month, year, companyId]);

  const leaveByType = leaveData.reduce((acc, l) => { acc[l.type] = (acc[l.type] || 0) + 1; return acc; }, {});
  const pieData = Object.entries(leaveByType).map(([name, value]) => ({ name, value }));
  const totalNet  = payrollData.reduce((s, p) => s + Number(p.netSalary), 0);
  const totalBrut = payrollData.reduce((s, p) => s + Number(p.baseSalary) + Number(p.totalAllowances), 0);
  const totalDed  = payrollData.reduce((s, p) => s + Number(p.totalDeductions), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rapports & Analyses</h1>
          <p className="page-subtitle">{company?.name} · Statistiques RH et paie</p>
        </div>
        <div className="flex gap-2">
          <select className="input w-40" value={month} onChange={e => setMonth(+e.target.value)}>
            {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <input type="number" className="input w-24" value={year} onChange={e => setYear(+e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Net total</p>
          <p className="text-2xl font-extrabold text-indigo-700 mt-1">{totalNet.toLocaleString('fr-FR')} CDF</p>
          <p className="text-xs font-medium text-indigo-400 mt-0.5">{payrollData.length} employé(s)</p>
        </div>
        <div className="card border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
          <p className="text-xs font-bold text-emerald-500 uppercase tracking-wide">Brut total</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{totalBrut.toLocaleString('fr-FR')} CDF</p>
        </div>
        <div className="card border-red-100 bg-gradient-to-br from-red-50 to-white">
          <p className="text-xs font-bold text-red-400 uppercase tracking-wide">Déductions totales</p>
          <p className="text-2xl font-extrabold text-red-600 mt-1">{totalDed.toLocaleString('fr-FR')} CDF</p>
          <p className="text-xs font-medium text-red-400 mt-0.5">CNSS + IPR + INPP + ONEM</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner"><p className="text-gray-500 text-sm">Chargement...</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-5">Salaires nets — {MONTHS[month-1]} {year}</h3>
            {payrollData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Aucune donnée disponible</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={payrollData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey={p => p.employee?.lastName?.slice(0, 8) ?? ''} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => [`${Number(v).toLocaleString('fr-FR')} CDF`]} />
                  <Bar dataKey="netSalary" fill="#6366f1" radius={[6,6,0,0]} name="Net à payer" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <h3 className="font-bold text-gray-900 mb-5">Congés par type — {year}</h3>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Aucune donnée disponible</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" outerRadius={85} innerRadius={40} dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {payrollData.length > 0 && (
        <div className="table-container">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Détail paie — {MONTHS[month-1]} {year}</h3>
            <span className="badge-gray">{payrollData.length} fiches</span>
          </div>
          <table className="w-full text-sm">
            <thead><tr>{['Matricule','Employé','Salaire base','Primes','Déductions','Net à payer'].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {payrollData.map(p => (
                <tr key={p.id} className="tr-hover">
                  <td className="td"><span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{p.employee?.matricule}</span></td>
                  <td className="td font-medium text-gray-900">{p.employee?.lastName} {p.employee?.firstName}</td>
                  <td className="td">{Number(p.baseSalary).toLocaleString('fr-FR')}</td>
                  <td className="td text-emerald-600 font-semibold">+{Number(p.totalAllowances).toLocaleString('fr-FR')}</td>
                  <td className="td text-red-500 font-semibold">-{Number(p.totalDeductions).toLocaleString('fr-FR')}</td>
                  <td className="td font-bold text-gray-900">{Number(p.netSalary).toLocaleString('fr-FR')} CDF</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
