import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRightOnRectangleIcon, BellIcon } from '@heroicons/react/24/outline';

const PAGE_TITLES = {
  '/': 'Tableau de bord',
  '/companies': 'Entreprises',
  '/employees': 'Employés',
  '/contracts': 'Contrats',
  '/payroll': 'Gestion de la Paie',
  '/leave': 'Congés & Absences',
  '/reports': 'Rapports & Analyses',
  '/settings': 'Paramètres',
};

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const title = PAGE_TITLES[pathname]
    ?? PAGE_TITLES[Object.keys(PAGE_TITLES).find((k) => pathname.startsWith(k) && k !== '/') ?? '/']
    ?? 'SmartHR';

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'U';

  return (
    <header className="bg-white border-b border-gray-200 px-6 h-16 flex items-center justify-between shrink-0 shadow-sm">
      {/* Page title */}
      <h2 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h2>

      <div className="flex items-center gap-2">
        {/* Bell */}
        <button className="relative p-2.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors">
          <BellIcon className="w-5 h-5" />
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-gray-900 leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs font-medium text-gray-500 leading-tight capitalize">
              {user?.role ?? 'Administrateur'}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl transition-all duration-150"
          title="Déconnexion"
        >
          <ArrowRightOnRectangleIcon className="w-[18px] h-[18px]" />
          <span className="hidden sm:inline text-xs">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
