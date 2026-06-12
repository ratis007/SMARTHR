import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import {
  BuildingOfficeIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

const MODULES = [
  {
    key: 'companies',
    label: 'Gestion des Entreprises',
    description: 'Gérez vos entreprises clientes, leurs informations légales et accédez à leur espace RH dédié.',
    icon: BuildingOfficeIcon,
    href: '/companies',
    color: 'indigo',
    badge: null,
  },
  {
    key: 'settings',
    label: 'Paramètres',
    description: 'Configurez les taux légaux RDC (CNSS, IPR, INPP, ONEM) et les paramètres globaux de l\'application.',
    icon: Cog6ToothIcon,
    href: '/settings',
    color: 'slate',
    badge: null,
  },
  {
    key: 'users',
    label: 'Administration Utilisateurs',
    description: 'Creez les comptes, gerez les statuts, les roles, les permissions RBAC et consultez l historique des actions.',
    icon: UserGroupIcon,
    href: '/users',
    color: 'indigo',
    badge: null,
  },
];

const colorMap = {
  indigo: {
    bg: 'bg-indigo-600',
    light: 'bg-indigo-50',
    icon: 'text-indigo-600',
    border: 'border-indigo-200',
    hover: 'hover:border-indigo-400 hover:shadow-indigo-100',
    btn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    ring: 'ring-indigo-200',
  },
  slate: {
    bg: 'bg-slate-700',
    light: 'bg-slate-100',
    icon: 'text-slate-600',
    border: 'border-slate-200',
    hover: 'hover:border-slate-400 hover:shadow-slate-100',
    btn: 'bg-slate-700 hover:bg-slate-800 text-white',
    ring: 'ring-slate-200',
  },
};

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [hoveredKey, setHoveredKey] = useState(null);

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'U';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 shadow-sm px-6 h-16 flex items-center justify-between shrink-0">
        <Logo size={38} showText={true} textSize="text-base" />

        <div className="flex items-center gap-2">
          <button className="p-2.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors">
            <BellIcon className="w-5 h-5" />
          </button>
          <div className="w-px h-8 bg-gray-200 mx-1" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-gray-900 leading-tight">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs font-medium text-gray-500 leading-tight capitalize">{user?.role ?? 'Administrateur'}</p>
            </div>
          </div>
          <div className="w-px h-8 bg-gray-200 mx-1" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl transition-all duration-150"
          >
            <ArrowRightOnRectangleIcon className="w-[18px] h-[18px]" />
            <span className="hidden sm:inline text-xs">Déconnexion</span>
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <div className="bg-slate-900 text-white px-6 py-14 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs font-bold text-white/80 mb-6 tracking-wide">
            <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-400" />
            Conformité RDC · CNSS · IPR · INPP · ONEM
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            Bienvenue sur <span className="text-indigo-400">SmartHR</span>
          </h1>
          <p className="text-slate-300 text-base font-medium max-w-xl mx-auto">
            Votre plateforme de gestion RH & Paie multi-entreprises pour la République Démocratique du Congo.
          </p>

          {/* Stats rapides */}
          <div className="flex items-center justify-center gap-8 mt-8">
            {[
              { icon: BuildingOfficeIcon, label: 'Multi-entreprises' },
              { icon: UserGroupIcon,      label: 'Gestion des employés' },
              { icon: ShieldCheckIcon,    label: 'Conformité légale RDC' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-white/60 text-sm font-medium">
                <Icon className="w-4 h-4 text-indigo-400" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Modules ─────────────────────────────────────── */}
      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 text-center">
            Modules disponibles
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {MODULES.map((mod) => {
              const c = colorMap[mod.color];
              const Icon = mod.icon;
              const isHovered = hoveredKey === mod.key;

              return (
                <button
                  key={mod.key}
                  onClick={() => navigate(mod.href)}
                  onMouseEnter={() => setHoveredKey(mod.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className={`
                    group text-left bg-white rounded-2xl border-2 p-6
                    shadow-sm hover:shadow-lg transition-all duration-200
                    ${c.border} ${c.hover}
                  `}
                >
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ring-2 ${c.light} ${c.ring} transition-transform duration-200 ${isHovered ? 'scale-110' : ''}`}>
                    <Icon className={`w-7 h-7 ${c.icon}`} />
                  </div>

                  {/* Text */}
                  <h2 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-gray-800">
                    {mod.label}
                  </h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-5">
                    {mod.description}
                  </p>

                  {/* CTA */}
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150 ${c.btn}`}>
                    Accéder
                    <ChevronRightIcon className={`w-4 h-4 transition-transform duration-150 ${isHovered ? 'translate-x-1' : ''}`} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* RDC compliance footer */}
          <div className="mt-10 bg-slate-900 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-white font-bold text-sm mb-0.5">🇨🇩 Conformité République Démocratique du Congo</p>
              <p className="text-slate-400 text-xs font-medium">Taux légaux appliqués automatiquement lors du calcul de la paie</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'CNSS', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
                { label: 'IPR',  color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                { label: 'INPP', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                { label: 'ONEM', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
              ].map(({ label, color }) => (
                <span key={label} className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${color}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="text-center py-4 text-xs font-medium text-gray-400 border-t border-gray-200 bg-white">
        © 2026 SmartHR · Powered by Boost-Tech
      </footer>
    </div>
  );
}
