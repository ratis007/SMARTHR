import { Outlet, NavLink, useNavigate, useParams } from 'react-router-dom';
import { CompanyProvider, useCurrentCompany } from '../contexts/CompanyContext';
import Header from '../components/Header';
import Logo from '../components/Logo';
import {
  HomeIcon, UsersIcon, DocumentTextIcon, BanknotesIcon,
  CalendarDaysIcon, ChartBarIcon, Cog6ToothIcon, ArrowLeftIcon,
  BuildingOfficeIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid, UsersIcon as UsersIconSolid,
  DocumentTextIcon as DocIconSolid, BanknotesIcon as BankIconSolid,
  CalendarDaysIcon as CalIconSolid, ChartBarIcon as ChartIconSolid,
  Cog6ToothIcon as CogIconSolid, ClockIcon as ClockIconSolid,
} from '@heroicons/react/24/solid';

const NAV_ITEMS = [
  { key: 'dashboard',  label: 'Tableau de bord', icon: HomeIcon,          iconSolid: HomeIconSolid,  end: true },
  { key: 'employees',  label: 'Employés',         icon: UsersIcon,         iconSolid: UsersIconSolid },
  { key: 'contracts',  label: 'Contrats',          icon: DocumentTextIcon,  iconSolid: DocIconSolid },
  { key: 'payroll',    label: 'Paie',              icon: BanknotesIcon,     iconSolid: BankIconSolid },
  { key: 'time-attendance', label: 'Temps',         icon: ClockIcon,         iconSolid: ClockIconSolid },
  { key: 'leave',      label: 'Congés',            icon: CalendarDaysIcon,  iconSolid: CalIconSolid },
  { key: 'reports',    label: 'Rapports',          icon: ChartBarIcon,      iconSolid: ChartIconSolid },
  { key: 'settings',   label: 'Paramètres',        icon: Cog6ToothIcon,     iconSolid: CogIconSolid },
];

function CompanySidebar() {
  const { companyId } = useParams();
  const { company } = useCurrentCompany();
  const navigate = useNavigate();
  const base = `/app/${companyId}`;

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 select-none">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div style={{ '--logo-text-color': '#ffffff', '--logo-accent-color': '#818cf8', '--logo-sub-color': 'rgba(255,255,255,0.5)' }}>
          <Logo size={40} showText={true} textSize="text-base" />
        </div>
      </div>

      {/* Contexte entreprise */}
      <div className="px-4 py-3 border-b border-white/10">
        <button
          onClick={() => navigate('/companies')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-semibold mb-2.5 transition-colors"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" /> Changer d'entreprise
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-500/25 rounded-xl flex items-center justify-center ring-1 ring-indigo-400/30 shrink-0">
            <BuildingOfficeIcon className="w-4.5 h-4.5 w-[18px] h-[18px] text-indigo-300" />
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-bold truncate">{company?.name ?? '...'}</p>
            <p className="text-slate-400 text-xs font-medium truncate">{company?.rccm ?? 'Espace entreprise'}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-3">Modules</p>
        {NAV_ITEMS.map(({ key, label, icon: Icon, iconSolid: IconSolid, end }) => (
          <NavLink
            key={key}
            to={`${base}/${key}`}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 group ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive
                  ? <IconSolid className="w-[18px] h-[18px] shrink-0" />
                  : <Icon className="w-[18px] h-[18px] shrink-0 group-hover:scale-110 transition-transform" />
                }
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* RDC Compliance */}
      <div className="px-4 pb-3">
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Conformité RDC</p>
          <div className="flex flex-wrap gap-1.5">
            {['CNSS', 'IPR', 'INPP', 'ONEM'].map((t) => (
              <span key={t} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 text-center">
        <p className="text-slate-500 text-[11px] font-medium">© 2026 SmartHR · Boost-Tech</p>
      </div>
    </aside>
  );
}

function CompanyWorkspace() {
  const { loading } = useCurrentCompany();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-400">Chargement de l'espace entreprise...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <CompanySidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Layout racine : enveloppe CompanyProvider puis affiche le workspace */
export default function CompanyLayout() {
  return (
    <CompanyProvider>
      <CompanyWorkspace />
    </CompanyProvider>
  );
}
