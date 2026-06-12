import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BanknotesIcon, Cog6ToothIcon, PlusIcon, ShieldCheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import api, { companiesApi, platformSettingsApi } from '../services/api';

const settingTypes = [
  ['department', 'Departements'],
  ['position', 'Postes'],
  ['document_type', 'Types documents'],
  ['category', 'Categories'],
  ['status', 'Statuts'],
  ['field', 'Champs'],
  ['workflow', 'Workflows'],
  ['notification', 'Notifications'],
  ['numbering', 'Numerotation'],
];

const emptySetting = { settingType: 'department', name: '', code: '', description: '', isRequired: false, isActive: true };

export default function SettingsPage() {
  const [rates, setRates] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [settings, setSettings] = useState([]);
  const [currency, setCurrency] = useState(null);
  const [history, setHistory] = useState([]);
  const [conversion, setConversion] = useState(null);
  const [amount, setAmount] = useState(100);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [form, setForm] = useState(emptySetting);

  const grouped = useMemo(() => settings.reduce((acc, item) => {
    acc[item.settingType] = [...(acc[item.settingType] || []), item];
    return acc;
  }, {}), [settings]);

  useEffect(() => {
    Promise.all([api.get('/settings/rates'), companiesApi.getAll()])
      .then(([rateRes, companiesRes]) => {
        setRates(rateRes.data);
        setCompanies(companiesRes.data);
        if (companiesRes.data[0]) setCompanyId(String(companiesRes.data[0].id));
      })
      .catch(() => toast.error('Chargement des parametres impossible'));
  }, []);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      platformSettingsApi.getCompanySettings(companyId),
      platformSettingsApi.getCurrency(companyId),
      platformSettingsApi.rateHistory(companyId),
    ]).then(([settingsRes, currencyRes, historyRes]) => {
      setSettings(settingsRes.data);
      setCurrency(currencyRes.data);
      setHistory(historyRes.data);
    }).catch(() => toast.error('Parametres entreprise indisponibles'));
  }, [companyId]);

  const saveSetting = async (e) => {
    e.preventDefault();
    await platformSettingsApi.createCompanySetting(companyId, form);
    toast.success('Parametre ajoute');
    setForm(emptySetting);
    const { data } = await platformSettingsApi.getCompanySettings(companyId);
    setSettings(data);
  };

  const removeSetting = async (id) => {
    await platformSettingsApi.deleteCompanySetting(id);
    setSettings((prev) => prev.filter((item) => item.id !== id));
  };

  const saveCurrency = async (e) => {
    e.preventDefault();
    const { data } = await platformSettingsApi.updateCurrency(companyId, {
      ...currency,
      usdToCdfRate: Number(currency.usdToCdfRate),
      roundingPrecision: Number(currency.roundingPrecision),
    });
    setCurrency(data);
    const historyRes = await platformSettingsApi.rateHistory(companyId);
    setHistory(historyRes.data);
    toast.success('Configuration devise enregistree');
  };

  const fetchCurrencyRate = async () => {
    try {
      const { data } = await platformSettingsApi.fetchCurrencyRate(companyId);
      setCurrency(data);
      const historyRes = await platformSettingsApi.rateHistory(companyId);
      setHistory(historyRes.data);
      toast.success('Taux automatique applique');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Taux automatique indisponible');
    }
  };

  const convert = async () => {
    const { data } = await platformSettingsApi.convert(companyId, amount, fromCurrency);
    setConversion(data);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Parametres</h1>
          <p className="page-subtitle">Configuration plateforme, entreprise et multidevise</p>
        </div>
        <select className="input max-w-xs" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheckIcon className="w-6 h-6 text-emerald-600" />
            <h2 className="font-bold">Taux legaux RDC</h2>
          </div>
          {rates && (
            <div className="grid grid-cols-2 gap-3">
              {['cnss', 'ipr', 'inpp', 'onem'].map((key) => (
                <div key={key} className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  <div className="text-xs font-bold uppercase text-gray-500">{key}</div>
                  <div className="text-2xl font-black text-gray-900">{rates[key]}%</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={saveCurrency} className="card xl:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <BanknotesIcon className="w-6 h-6 text-indigo-600" />
            <h2 className="font-bold">Conversion FC / USD</h2>
          </div>
          {currency && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select className="input" value={currency.primaryCurrency} onChange={(e) => setCurrency({ ...currency, primaryCurrency: e.target.value })}>
                  <option value="CDF">CDF / FC</option>
                  <option value="USD">USD</option>
                </select>
                <input className="input" type="number" step="0.0001" value={currency.usdToCdfRate} onChange={(e) => setCurrency({ ...currency, usdToCdfRate: e.target.value })} />
                <select className="input" value={currency.rateSource} onChange={(e) => setCurrency({ ...currency, rateSource: e.target.value })}>
                  <option value="manual">Manuel</option>
                  <option value="api">API</option>
                </select>
                <select className="input" value={currency.roundingMode} onChange={(e) => setCurrency({ ...currency, roundingMode: e.target.value })}>
                  <option value="nearest">Arrondi proche</option>
                  <option value="up">Arrondi superieur</option>
                  <option value="down">Arrondi inferieur</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" type="submit">Enregistrer devise</button>
                <button className="btn-secondary" type="button" onClick={fetchCurrencyRate}>Taux API</button>
              </div>
            </>
          )}
          <div className="flex flex-col md:flex-row gap-3 pt-3 border-t border-gray-100">
            <input className="input md:max-w-xs" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select className="input md:max-w-[160px]" value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="CDF">CDF / FC</option>
            </select>
            <button className="btn-secondary" type="button" onClick={convert}>Convertir</button>
            {conversion && <div className="rounded-xl bg-indigo-50 text-indigo-900 px-4 py-2 text-sm font-bold">USD {conversion.USD} · FC {conversion.CDF}</div>}
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form onSubmit={saveSetting} className="card space-y-4">
          <div className="flex items-center gap-3">
            <Cog6ToothIcon className="w-6 h-6 text-indigo-600" />
            <h2 className="font-bold">Parametre entreprise</h2>
          </div>
          <select className="input" value={form.settingType} onChange={(e) => setForm({ ...form, settingType: e.target.value })}>
            {settingTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input className="input" placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Code ou reference" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <textarea className="input min-h-[96px]" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isRequired} onChange={(e) => setForm({ ...form, isRequired: e.target.checked })} /> Obligatoire</label>
          <button className="btn-primary" type="submit"><PlusIcon className="w-4 h-4" /> Ajouter</button>
        </form>

        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {settingTypes.map(([type, label]) => (
            <div key={type} className="card">
              <h3 className="font-bold text-gray-900 mb-3">{label}</h3>
              <div className="space-y-2">
                {(grouped[type] || []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-gray-100 p-3">
                    <div>
                      <div className="font-semibold text-sm">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.code || item.description || 'Sans reference'}</div>
                    </div>
                    <button className="btn-ghost text-red-600" onClick={() => removeSetting(item.id)}><TrashIcon className="w-4 h-4" /></button>
                  </div>
                ))}
                {!(grouped[type] || []).length && <p className="text-sm text-gray-400">Aucun element.</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">Historique des taux</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {history.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 p-3 text-sm">
              <div className="font-bold">1 {item.fromCurrency} = {Number(item.rate).toLocaleString()} {item.toCurrency}</div>
              <div className="text-gray-500">{item.source} · {new Date(item.effectiveAt).toLocaleString()}</div>
            </div>
          ))}
          {!history.length && <p className="text-sm text-gray-500">Aucun taux historique.</p>}
        </div>
      </div>
    </div>
  );
}
