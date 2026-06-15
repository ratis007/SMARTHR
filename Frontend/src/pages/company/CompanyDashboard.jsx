import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCurrentCompany } from '../../contexts/CompanyContext';
import { reportsApi, platformSettingsApi } from '../../services/api';
import StatCard from '../../components/StatCard';
import {
  UsersIcon, BanknotesIcon, CalendarDaysIcon,
  DocumentTextIcon, ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {Number(p.value).toLocaleString('fr-FR')} CDF
        </p>
      ))}
    </div>
  );
};

export default function CompanyDashboard() {
  // Lit directement depuis l'URL — source de vérité absolue
  const { companyId: rawId } = useParams();
  const companyId = rawId ? Number(rawId) : null;

  const { company, loading: companyLoading } = useCurrentCompany();
  const [stats, setStats] = useState(null);
  const [currency, setCurrency] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;

    setStatsLoading(true);
    setStats(null);

    // Passe companyId en query param ET en header (double sécurité)
    reportsApi.getDashboard(companyId)
      .then(({ data }) => {
        console.log('[Dashboard] Stats reçues pour companyId', companyId, data);
        setStats(data);
      })
      .catch((err) => {
        console.error('[Dashboard] Erreur fetch stats:', err);
        setStats(null);
      })
      .finally(() => setStatsLoading(false));

  }, [companyId, reportsApi]); // dépend de companyId et reportsApi

  useEffect(() => {
    if (!companyId) return;
    platformSettingsApi.getCurrency(companyId)
      .then(({ data }) => setCurrency(data))
      .catch(() => setCurrency(null));
  }, [companyId]);

  const now = new Date();
  const chartData = stats?.evolution ?? [];

  // Empêche le re-render si companyLoading change mais companyId est stable
  if (companyLoading) return (
    <div className="loading-spinner">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-gray-500 font-medium">Chargement du tableau de bord...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{company?.name}</h1>
          <p className="text-gray-500 text-sm font-medium mt-0.5">
            {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-emerald-700">Système opérationnel</span>
        </div>
      </div>

      {/* Stats filtrées par companyId */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Employés actifs"
          value={stats?.totalEmployees ?? 0}
          icon={UsersIcon}
          color="blue"
          subtitle={company?.name ?? '...'}
        />
        <StatCard
          title="Masse Salariale"
          value={stats?.masseSalariale
            ? formatDual(stats.masseSalariale, currency)
            : formatDual(0, currency)}
          icon={BanknotesIcon}
          color="purple"
          subtitle="Ce mois"
        />
        <StatCard
          title="Congés en attente"
          value={stats?.pendingLeaves ?? 0}
          icon={CalendarDaysIcon}
          color="yellow"
          subtitle="À approuver"
        />
        <StatCard
          title="Contrats actifs"
          value={stats?.activeContracts ?? 0}
          icon={DocumentTextIcon}
          color="green"
          subtitle="En cours"
        />
      </div>

      {/* Graphique */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Évolution Masse Salariale</h3>
            <p className="text-xs font-medium text-gray-500 mt-0.5">
              {now.getFullYear()} · En CDF · {company?.name}
            </p>
          </div>
          <ArrowTrendingUpIcon className="w-5 h-5 text-indigo-400" />
        </div>

        {chartData.length === 0 || chartData.every(d => d.masse === 0) ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <BanknotesIcon className="w-10 h-10 mb-2 text-gray-200" />
            <p className="text-sm font-medium">Aucune donnée de paie pour {now.getFullYear()}</p>
            <p className="text-xs text-gray-400 mt-1">Générez des fiches de paie pour voir l'évolution</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorMasse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="masse" stroke="#6366f1" strokeWidth={2.5}
                fill="url(#colorMasse)" name="Masse salariale" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Conformité RDC */}
      <div className="card bg-slate-900 border-0 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-emerald-400 font-bold text-sm mb-1">🇨🇩 Conformité RDC</p>
            <p className="text-slate-400 text-xs font-medium">Taux légaux appliqués automatiquement lors du calcul de la paie</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'CNSS', desc: '5%',  color: 'bg-blue-500/20 border-blue-400/30 text-blue-300' },
              { label: 'IPR',  desc: '15%', color: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' },
              { label: 'INPP', desc: '2%',  color: 'bg-amber-500/20 border-amber-400/30 text-amber-300' },
              { label: 'ONEM', desc: '1%',  color: 'bg-red-500/20 border-red-400/30 text-red-300' },
            ].map(({ label, desc, color }) => (
              <div key={label} className={`px-4 py-2 rounded-xl border ${color} text-center`}>
                <p className="font-bold text-sm">{label}</p>
                <p className="text-xs opacity-80 font-semibold">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

function formatDual(value, currency) {
  const cdf = Number(value || 0);
  const rate = Number(currency?.usdToCdfRate || 2850);
  const usd = cdf / rate;
  return `${Math.round(cdf).toLocaleString('fr-FR')} FC / ${usd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}
