import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import Logo from '../components/Logo';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch {
      toast.error('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Panneau gauche ───────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/25 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative">
          <div className="mb-10" style={{ '--logo-text-color': '#ffffff', '--logo-accent-color': '#818cf8', '--logo-sub-color': 'rgba(255,255,255,0.55)' }}>
            <Logo size={56} showText={true} textSize="text-2xl" />
          </div>
          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            Gestion RH & Paie<br />
            <span className="text-indigo-400">pour la RDC</span>
          </h1>
          <p className="text-slate-300 text-base leading-relaxed font-medium">
            Solution complète pour cabinets RH multi-entreprises.<br />
            Conformité CNSS, IPR, INPP et ONEM intégrée.
          </p>
        </div>

        {/* Features */}
        <div className="relative space-y-4">
          {[
            { icon: '🏢', label: 'Multi-entreprises & multi-sites' },
            { icon: '💰', label: 'Calcul automatique CNSS · IPR · INPP · ONEM' },
            { icon: '📊', label: 'Rapports et analyses avancés' },
            { icon: '🔒', label: 'Sécurité & audit complet' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-3 text-slate-200 text-sm font-medium">
              <span className="text-lg">{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <p className="relative text-slate-500 text-xs font-medium">© 2026 SmartHR · Powered by Boost-Tech</p>
      </div>

      {/* ── Panneau droit ────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <Logo size={40} showText={true} textSize="text-lg" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-gray-900">Connexion</h2>
            <p className="text-gray-500 text-sm font-medium mt-1">Accédez à votre espace de gestion RH</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Adresse email</label>
              <input
                type="email"
                className="input"
                placeholder="admin@smarthr.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-3 px-4 rounded-xl transition-all duration-150 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connexion en cours...
                </>
              ) : 'Se connecter'}
            </button>
          </form>

          {/* Credentials hint */}
          <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
            <p className="text-sm font-bold text-indigo-800 mb-2">Compte administrateur</p>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-indigo-700">📧 admin@smarthr.com</p>
              <p className="text-sm font-semibold text-indigo-700">🔑 SmartHR@2026</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
