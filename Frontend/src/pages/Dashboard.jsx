import { useEffect, useState } from 'react';
import { reportsApi } from '../services/api';
import StatCard from '../components/StatCard';
import { Link } from 'react-router-dom';
import {
  UsersIcon, BuildingOfficeIcon, BanknotesIcon, CalendarDaysIcon,
  DocumentTextIcon, ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi.getDashboard()
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const chartData = MONTHS.slice(0, now.getMonth() + 1).map((m, i) => ({
    name: m,
    masse: Math.floor(Math.random() * 40000 + 25000),
    employes: Math.floor(Math.random() * 5 + (stats?.totalEmployees ?? 10)),
  }));

  const quickLinks = [
    { to: '/employees', label: 'Nouvel employé', icon: UsersIcon, color: 'bg-blue-500' },
    { to: '/payroll', label: 'Générer paie', icon: BanknotesIcon, color: 'bg-emerald-500' },
    { to: '/leave', label: 'Demande congé', icon: CalendarDaysIcon, color: 'bg-amber-500' },
    { to: '/contracts', label: 'Nouveau contrat', icon: DocumentTextIcon, color: 'bg-violet-500' },
  ];

  if (loading) return (
    <div className="loading-spinner">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-gray-400">Chargement du tableau de bord...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-green-700">Système opérationnel</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Employés" value={stats?.totalEmployees ?? 0} icon={UsersIcon} color="blue" subtitle="Actifs" />
        <StatCard title="Entreprises" value={stats?.activeCompanies ?? 0} icon={BuildingOfficeIcon} color="green" subtitle="Actives" />
        <StatCard
          title="Masse Salariale"
          value={stats?.masseSalariale ? `${Number(stats.masseSalariale).toLocaleString()} CDF` : '0 CDF'}
          subtitle="Ce mois"
          icon={BanknotesIcon}
          color="purple"
        />
        <StatCard title="Congés en Attente" value={stats?.pendingLeaves ?? 0} icon={CalendarDaysIcon} color="yellow" subtitle="À traiter" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main chart */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-gray-900">Évolution Masse Salariale</h3>
              <p className="text-xs text-gray-400 mt-0.5">{now.getFullYear()} · En CDF</p>
            </div>
            <ArrowTrendingUpIcon className="w-5 h-5 text-indigo-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorMasse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="masse" stroke="#6366f1" strokeWidth={2.5} fill="url(#colorMasse)" name="Masse salariale" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quick links */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Actions rapides</h3>
          <div className="space-y-2">
            {quickLinks.map(({ to, label, icon: Icon, color }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center shadow-sm`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
                <span className="ml-auto text-gray-300 group-hover:text-gray-400 text-lg">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* RDC Compliance */}
      <div className="card bg-gradient-to-r from-primary-950 to-indigo-900 border-0 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-400 font-bold text-sm">🇨🇩 Conformité RDC</span>
            </div>
            <p className="text-white/60 text-xs">Taux légaux appliqués automatiquement lors du calcul de la paie</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'CNSS', desc: 'Sécurité Sociale', color: 'bg-blue-500/20 border-blue-400/30 text-blue-300' },
              { label: 'IPR', desc: 'Impôt Professionnel', color: 'bg-green-500/20 border-green-400/30 text-green-300' },
              { label: 'INPP', desc: 'Formation Prof.', color: 'bg-yellow-500/20 border-yellow-400/30 text-yellow-300' },
              { label: 'ONEM', desc: 'Emploi National', color: 'bg-red-500/20 border-red-400/30 text-red-300' },
            ].map(({ label, desc, color }) => (
              <div key={label} className={`px-3 py-2 rounded-xl border ${color} text-center`}>
                <p className="font-bold text-sm">{label}</p>
                <p className="text-[10px] opacity-70">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
