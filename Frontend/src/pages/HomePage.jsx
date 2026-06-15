import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import {
  ArrowRightOnRectangleIcon,
  BellIcon,
  BuildingOfficeIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

const MODULES = [
  {
    key: 'companies',
    label: 'Gestion des Entreprises',
    description: 'Gerez vos entreprises clientes, leurs informations legales et accedez a leur espace RH dedie.',
    icon: BuildingOfficeIcon,
    href: '/companies',
    color: 'indigo',
  },
  {
    key: 'settings',
    label: 'Parametres',
    description: "Configurez les taux legaux RDC et les parametres globaux de l'application.",
    icon: Cog6ToothIcon,
    href: '/settings',
    color: 'slate',
  },
  {
    key: 'users',
    label: 'Administration Utilisateurs',
    description: 'Creez les comptes, gerez les statuts, les roles, les permissions RBAC et consultez les actions.',
    icon: UserGroupIcon,
    href: '/users',
    color: 'indigo',
  },
];

const colorMap = {
  indigo: {
    light: 'bg-indigo-50',
    icon: 'text-indigo-600',
    border: 'border-indigo-200',
    hover: 'hover:border-indigo-400 hover:shadow-indigo-100',
    btn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    ring: 'ring-indigo-200',
  },
  slate: {
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'U';
  const roleLabel = user?.roles?.[0]?.description || user?.roles?.[0]?.name || user?.role || 'Administrateur';

  useEffect(() => {
    const closeMenu = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm px-6 h-16 flex items-center justify-between shrink-0">
        <Logo size={38} showText={true} textSize="text-base" />

        <div className="flex items-center gap-3 ml-auto">
          <button className="p-2.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors" type="button" title="Notifications">
            <BellIcon className="w-5 h-5" />
          </button>
          <div className="w-px h-8 bg-gray-200" />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-3 rounded-2xl px-2 py-1.5 text-left hover:bg-gray-100 transition-colors"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                {initials}
              </div>
              <div className="hidden sm:block min-w-0">
                <p className="text-sm font-bold text-gray-900 leading-tight truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs font-medium text-gray-500 leading-tight truncate">{roleLabel}</p>
              </div>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden" role="menu">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="px-2 py-2">
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
                    <UserCircleIcon className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{roleLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    role="menuitem"
                  >
                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    Deconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="bg-slate-900 text-white px-6 py-14 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs font-bold text-white/80 mb-6 tracking-wide">
            <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-400" />
            Conformite RDC - CNSS - IPR - INPP - ONEM
          </div>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            Bienvenue sur <span className="text-indigo-400">SmartHR</span>
          </h1>
          <p className="text-slate-300 text-base font-medium max-w-xl mx-auto">
            Votre plateforme de gestion RH & Paie multi-entreprises pour la Republique Democratique du Congo.
          </p>
          <div className="flex items-center justify-center gap-8 mt-8 flex-wrap">
            {[
              { icon: BuildingOfficeIcon, label: 'Multi-entreprises' },
              { icon: UserGroupIcon, label: 'Gestion des employes' },
              { icon: ShieldCheckIcon, label: 'Conformite legale RDC' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-white/60 text-sm font-medium">
                <Icon className="w-4 h-4 text-indigo-400" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 text-center">
            Modules disponibles
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {MODULES.map((module) => {
              const colors = colorMap[module.color];
              const Icon = module.icon;
              const isHovered = hoveredKey === module.key;

              return (
                <button
                  key={module.key}
                  onClick={() => navigate(module.href)}
                  onMouseEnter={() => setHoveredKey(module.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className={`group text-left bg-white rounded-2xl border-2 p-6 shadow-sm hover:shadow-lg transition-all duration-200 ${colors.border} ${colors.hover}`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ring-2 ${colors.light} ${colors.ring} transition-transform duration-200 ${isHovered ? 'scale-110' : ''}`}>
                    <Icon className={`w-7 h-7 ${colors.icon}`} />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-gray-800">{module.label}</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-5">{module.description}</p>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150 ${colors.btn}`}>
                    Acceder
                    <ChevronRightIcon className={`w-4 h-4 transition-transform duration-150 ${isHovered ? 'translate-x-1' : ''}`} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-10 bg-slate-900 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-white font-bold text-sm mb-0.5">Conformite Republique Democratique du Congo</p>
              <p className="text-slate-400 text-xs font-medium">Taux legaux appliques automatiquement lors du calcul de la paie</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['CNSS', 'IPR', 'INPP', 'ONEM'].map((label) => (
                <span key={label} className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-xs font-medium text-gray-400 border-t border-gray-200 bg-white">
        2026 SmartHR - Powered by Boost-Tech
      </footer>
    </div>
  );
}
