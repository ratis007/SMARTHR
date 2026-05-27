import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { companiesApi } from '../services/api';

const CompanyContext = createContext(null);

/**
 * Provider à placer dans le layout de l'espace entreprise.
 * Lit le :companyId depuis l'URL et expose la company active.
 */
export function CompanyProvider({ children }) {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCompany = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data } = await companiesApi.getOne(companyId);
      setCompany(data);
      // Synchronise le store global (utilisé par l'intercepteur API)
      window.__activeCompanyId = String(companyId);
    } catch {
      // Entreprise introuvable → retour à la liste
      navigate('/companies', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [companyId, navigate]);

  useEffect(() => {
    loadCompany();
    return () => { window.__activeCompanyId = null; };
  }, [loadCompany]);

  return (
    <CompanyContext.Provider value={{ company, companyId: companyId ? Number(companyId) : null, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}

/** Hook principal — garantit qu'on est bien dans un espace entreprise */
export function useCurrentCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCurrentCompany must be used inside CompanyProvider');
  return ctx;
}
