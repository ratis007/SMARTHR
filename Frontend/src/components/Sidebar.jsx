import { NavLink } from 'react-router-dom';
import {
  HomeIcon, BuildingOfficeIcon, Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  BuildingOfficeIcon as BuildingIconSolid,
  Cog6ToothIcon as CogIconSolid,
} from '@heroicons/react/24/solid';
import Logo from './Logo';

const navItems = [
  { to: '/',          label: 'Accueil',          icon: HomeIcon,          iconSolid: HomeIconSolid,    end: true },
  { to: '/companies', label: 'Entreprises',       icon: BuildingOfficeIcon, iconSolid: BuildingIconSolid },
  { to: '/settings',  label: 'Paramètres',        icon: Cog6ToothIcon,     iconSolid: CogIconSolid },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 select-none">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div style={{
          '--logo-text-color': '#ffffff',
          '--logo-accent-color': '#818cf8',
          '--logo-sub-color': 'rgba(255,255,255,0.5)',
        }}>
          <Logo size={40} showText={true} textSize="text-base" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-3">
          Navigation
        </p>
        {navItems.map(({ to, label, icon: Icon, iconSolid: IconSolid, end }) => (
          <NavLink
            key={to}
            to={to}
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
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Conformité RDC
          </p>
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
