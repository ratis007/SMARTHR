/**
 * Paramètres — scoped par companyId.
 * Affiche les taux légaux RDC + infos de l'entreprise active.
 */
import { useEffect, useState } from 'react';
import { useCurrentCompany } from '../../contexts/CompanyContext';
import api from '../../services/api';
import { Cog6ToothIcon, ShieldCheckIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';

const RDC_RATES = [
  { key: 'cnss', label: 'CNSS', fullLabel: 'Caisse Nationale de Sécurité Sociale', color: 'blue' },
  { key: 'ipr',  label: 'IPR',  fullLabel: 'Impôt Professionnel sur le Revenu',     color: 'green' },
  { key: 'inpp', label: 'INPP', fullLabel: 'Institut National de Préparation Prof.', color: 'yellow' },
  { key: 'onem', label: 'ONEM', fullLabel: "Office National de l'Emploi",            color: 'red' },
];
const colorMap = {
  blue:   'bg-blue-50 text-blue-700 border-blue-100',
  green:  'bg-emerald-50 text-emerald-700 border-emerald-100',
  yellow: 'bg-amber-50 text-amber-700 border-amber-100',
  red:    'bg-red-50 text-red-700 border-red-100',
};

export default function CompanySettings() {
  const { company } = useCurrentCompany();
  const [rates, setRates] = useState(null);

  useEffect(() => {
    api.get('/settings/rates').then(({ data }) => setRates(data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="page-title">Paramètres</h1>
        <p className="page-subtitle">Configuration de l'espace entreprise</p>
      </div>

      {/* Infos entreprise */}
      {company && (
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center ring-1 ring-indigo-100">
              <BuildingOfficeIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Informations de l'entreprise</h2>
          </div>
          <div className="space-y-3 text-sm">
            {[
              ['Nom', company.name],
              ['RCCM', company.rccm || '—'],
              ['ID National', company.idNat || '—'],
              ['Numéro Fiscal', company.taxNumber || '—'],
              ['Adresse', company.address || '—'],
              ['Téléphone', company.phone || '—'],
              ['Email', company.email || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-800 text-right max-w-xs">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Taux légaux RDC */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center ring-1 ring-green-100">
            <ShieldCheckIcon className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Taux légaux — RDC</h2>
            <p className="text-xs text-gray-400 mt-0.5">Appliqués automatiquement lors du calcul de la paie</p>
          </div>
        </div>
        {rates ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {RDC_RATES.map(({ key, label, fullLabel, color }) => (
              <div key={key} className={`rounded-2xl border p-4 ${colorMap[color]}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-lg">{label}</span>
                  <span className="text-2xl font-black">{rates[key]}%</span>
                </div>
                <p className="text-sm font-medium opacity-80">{fullLabel}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {RDC_RATES.map(({ key }) => <div key={key} className="rounded-2xl border border-gray-100 p-4 bg-gray-50 animate-pulse h-20" />)}
          </div>
        )}
      </div>
    </div>
  );
}
