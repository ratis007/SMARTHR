import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRightOnRectangleIcon, BellIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import ThemeToggle from './ThemeToggle';

const PAGE_TITLES = {
  '/': 'Tableau de bord',
  '/companies': 'Entreprises',
  '/employees': 'Employes',
  '/contracts': 'Contrats',
  '/payroll': 'Gestion de la Paie',
  '/leave': 'Conges & Absences',
  '/reports': 'Rapports & Analyses',
  '/settings': 'Parametres',
  '/users': 'Utilisateurs',
};

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const title = PAGE_TITLES[pathname]
    ?? PAGE_TITLES[Object.keys(PAGE_TITLES).find((key) => pathname.startsWith(key) && key !== '/') ?? '/']
    ?? 'SmartHR';

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
    <header className="bg-white border-b border-gray-200 px-6 h-16 flex items-center justify-between shrink-0 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h2>

      <div className="flex items-center gap-3 ml-auto">
        <ThemeToggle />
        <button
          type="button"
          className="relative p-2.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
          title="Notifications"
        >
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
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs font-medium text-gray-500 leading-tight truncate">
                {roleLabel}
              </p>
            </div>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden"
              role="menu"
            >
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
  );
}
