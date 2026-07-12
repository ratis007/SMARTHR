import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  BellIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { employeesApi, timeAttendanceApi } from '../../services/api';
import { useCurrentCompany } from '../../contexts/CompanyContext';

const STATUS_COLORS = {
  present: '#10b981',
  absent: '#ef4444',
  leave: '#f59e0b',
  off: '#94a3b8',
};

const STATUS_LABELS = {
  present: 'Present',
  absent: 'Absent',
  leave: 'Conge',
  off: 'Repos',
};

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
};

export default function CompanyTimeAttendance() {
  const { companyId: rawId } = useParams();
  const companyId = rawId ? Number(rawId) : null;
  const { company } = useCurrentCompany();
  const [date, setDate] = useState(today());
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [configuration, setConfiguration] = useState(null);
  const [days, setDays] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileForm, setProfileForm] = useState({
    code: 'ADMIN',
    name: 'Horaire administratif',
    startTime: '08:00',
    endTime: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00',
    graceLateMinutes: 5,
  });
  const [clockForm, setClockForm] = useState({ employeeId: '', eventType: 'entry', eventTime: '' });
  const [terminalForm, setTerminalForm] = useState({
    terminalId: 'TERMINAL-01',
    source: 'api_terminal',
    rows: '',
  });
  const [rotationForm, setRotationForm] = useState({
    code: 'ROT-14-7',
    name: 'Rotation 14/7',
    rotationType: 'work_rest',
    workDays: 14,
    restDays: 7,
    cycleStartDate: dateFrom,
    dayProfileId: '',
    nightProfileId: '',
  });
  const [scheduleForm, setScheduleForm] = useState({
    rotationPatternId: '',
    profileId: '',
    employeeId: '',
    department: '',
    overwrite: true,
  });
  const [planningFilters, setPlanningFilters] = useState({
    viewMode: 'month',
    employeeId: '',
    teamId: '',
  });
  const [scheduleEdit, setScheduleEdit] = useState({
    scheduleId: '',
    profileId: '',
    status: 'planned',
    plannedStart: '',
    plannedEnd: '',
    shiftLabel: '',
    recalculate: true,
  });
  const [draggedScheduleId, setDraggedScheduleId] = useState(null);
  const [notificationForm, setNotificationForm] = useState({ simulateProviders: true });
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Vue d’ensemble' },
    { id: 'planning', label: 'Planning' },
    { id: 'monitoring', label: 'Suivi' },
    { id: 'days', label: 'Journées' },
  ];
  const quickActions = [
    { id: 'planning', title: 'Créer un planning', description: 'Rotations, profils et génération', icon: CalendarDaysIcon, badge: 'Planning' },
    { id: 'monitoring', title: 'Contrôler les alertes', description: 'Retards, absences et notifications', icon: BellIcon, badge: 'Suivi' },
    { id: 'days', title: 'Consulter les journées', description: 'Présences, validation et export', icon: CheckIcon, badge: 'Journées' },
  ];

  const approvedCount = useMemo(
    () => days.filter((item) => ['hr_approved', 'closed'].includes(item.workflowStatus)).length,
    [days],
  );
  const openAlerts = useMemo(() => alerts.filter((item) => item.status === 'open').length, [alerts]);
  const outboxSummary = useMemo(() => outbox.reduce((acc, item) => {
    const status = item.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {}), [outbox]);

  const calendarCells = useMemo(() => buildCalendar(dateFrom, days), [dateFrom, days]);
  const scheduleCalendarCells = useMemo(
    () => buildScheduleCalendar(dateFrom, schedule, planningFilters.viewMode),
    [dateFrom, schedule, planningFilters.viewMode],
  );
  const planningTeamSummary = useMemo(() => summarizePlanningTeams(schedule), [schedule]);
  const selectedSchedule = useMemo(
    () => schedule.find((item) => Number(item.id) === Number(scheduleEdit.scheduleId)),
    [schedule, scheduleEdit.scheduleId],
  );
  const statusData = useMemo(
    () => (analytics?.statusDistribution || []).map((item) => ({
      ...item,
      name: STATUS_LABELS[item.status] || item.status,
      color: STATUS_COLORS[item.status] || '#6366f1',
    })),
    [analytics],
  );

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [dashRes, analyticsRes, configRes, daysRes, scheduleRes, alertsRes, outboxRes, jobsRes, employeesRes] = await Promise.all([
        timeAttendanceApi.dashboard(companyId, date),
        timeAttendanceApi.analytics({ companyId, dateFrom, dateTo }),
        timeAttendanceApi.configuration(companyId),
        timeAttendanceApi.days({ companyId, dateFrom, dateTo }),
        timeAttendanceApi.schedule({
          companyId,
          dateFrom,
          dateTo,
          ...(planningFilters.employeeId ? { employeeId: Number(planningFilters.employeeId) } : {}),
          ...(planningFilters.teamId ? { teamId: Number(planningFilters.teamId) } : {}),
        }),
        timeAttendanceApi.alerts({ companyId, dateFrom, dateTo, status: 'open' }),
        timeAttendanceApi.notificationOutbox({ companyId, limit: 100 }),
        timeAttendanceApi.jobs({ companyId, limit: 20 }),
        employeesApi.getAll(companyId),
      ]);
      setDashboard(dashRes.data);
      setAnalytics(analyticsRes.data);
      setConfiguration(configRes.data);
      setDays(daysRes.data);
      setSchedule(scheduleRes.data);
      setAlerts(alertsRes.data);
      setOutbox(outboxRes.data);
      setJobs(jobsRes.data);
      setEmployees(employeesRes.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Chargement temps/presence impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId, date, dateFrom, dateTo, planningFilters.employeeId, planningFilters.teamId]);

  const createProfile = async (event) => {
    event.preventDefault();
    const days = Array.from({ length: 7 }, (_, index) => {
      const weekday = index + 1;
      const isWorkingDay = weekday <= 5;
      return {
        weekday,
        isWorkingDay,
        startTime: profileForm.startTime,
        endTime: profileForm.endTime,
        breakStart: profileForm.breakStart,
        breakEnd: profileForm.breakEnd,
        expectedMinutes: isWorkingDay ? 480 : 0,
      };
    });
    try {
      await timeAttendanceApi.createWorkProfile({
        code: profileForm.code,
        name: profileForm.name,
        profileType: 'standard',
        graceLateMinutes: Number(profileForm.graceLateMinutes || 0),
        days,
      }, companyId);
      toast.success('Profil horaire enregistre');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Creation du profil impossible');
    }
  };

  const createRotation = async (event) => {
    event.preventDefault();
    if (!rotationForm.dayProfileId) return toast.error('Profil jour obligatoire');
    try {
      await timeAttendanceApi.createRotation({
        code: rotationForm.code,
        name: rotationForm.name,
        rotationType: rotationForm.rotationType,
        workDays: Number(rotationForm.workDays || 0),
        restDays: Number(rotationForm.restDays || 0),
        cycleStartDate: rotationForm.cycleStartDate || dateFrom,
        dayProfileId: Number(rotationForm.dayProfileId),
        nightProfileId: rotationForm.nightProfileId ? Number(rotationForm.nightProfileId) : undefined,
      }, companyId);
      toast.success('Rotation enregistree');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Creation rotation impossible');
    }
  };

  const generateSchedule = async () => {
    if (!scheduleForm.rotationPatternId && !scheduleForm.profileId) return toast.error('Rotation ou profil obligatoire');
    try {
      const payload = {
        dateFrom,
        dateTo,
        overwrite: scheduleForm.overwrite,
        rotationPatternId: scheduleForm.rotationPatternId ? Number(scheduleForm.rotationPatternId) : undefined,
        profileId: scheduleForm.profileId ? Number(scheduleForm.profileId) : undefined,
        employeeIds: scheduleForm.employeeId ? [Number(scheduleForm.employeeId)] : undefined,
        department: scheduleForm.department || undefined,
      };
      const { data } = await timeAttendanceApi.generateSchedule(payload, companyId);
      toast.success(`${data.success} ligne(s) planning generee(s), ${data.failed} erreur(s)`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation planning impossible');
    }
  };

  const movePlanningWindow = (direction) => {
    const anchor = new Date(`${dateFrom}T00:00:00`);
    if (planningFilters.viewMode === 'week') {
      anchor.setDate(anchor.getDate() + (direction * 7));
      const start = normalizeDate(startOfWeek(anchor));
      const endDate = new Date(`${start}T00:00:00`);
      endDate.setDate(endDate.getDate() + 6);
      setDateFrom(start);
      setDateTo(normalizeDate(endDate));
      return;
    }

    const moved = new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
    setDateFrom(normalizeDate(moved));
    setDateTo(normalizeDate(endOfMonth(moved)));
  };

  const resetPlanningWindow = () => {
    if (planningFilters.viewMode === 'week') {
      const start = normalizeDate(startOfWeek(new Date()));
      const endDate = new Date(`${start}T00:00:00`);
      endDate.setDate(endDate.getDate() + 6);
      setDateFrom(start);
      setDateTo(normalizeDate(endDate));
      return;
    }
    setDateFrom(monthStart());
    setDateTo(normalizeDate(endOfMonth(new Date())));
  };

  const editSchedule = (item) => {
    setScheduleEdit({
      scheduleId: item.id,
      profileId: item.profileId || '',
      status: item.status || 'planned',
      plannedStart: toTimeInput(item.plannedStart),
      plannedEnd: toTimeInput(item.plannedEnd),
      shiftLabel: item.shiftLabel || item.profileName || '',
      recalculate: true,
    });
  };

  const saveScheduleEdit = async () => {
    if (!scheduleEdit.scheduleId) return toast.error('Selectionner une ligne de planning');
    try {
      await timeAttendanceApi.updateScheduleEntry(scheduleEdit.scheduleId, {
        status: scheduleEdit.status,
        profileId: scheduleEdit.profileId && scheduleEdit.status !== 'rest' ? Number(scheduleEdit.profileId) : undefined,
        plannedStart: scheduleEdit.status !== 'rest' ? scheduleEdit.plannedStart || undefined : undefined,
        plannedEnd: scheduleEdit.status !== 'rest' ? scheduleEdit.plannedEnd || undefined : undefined,
        shiftLabel: scheduleEdit.shiftLabel || undefined,
        recalculate: scheduleEdit.recalculate,
      }, companyId);
      toast.success('Planning mis a jour');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Mise a jour planning impossible');
    }
  };

  const moveScheduleToDate = async (item, workDate) => {
    if (!item || normalizeDate(item.workDate) === workDate) return;
    try {
      await timeAttendanceApi.updateScheduleEntry(item.id, {
        workDate,
        recalculate: true,
      }, companyId);
      toast.success('Planning deplace');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Deplacement planning impossible');
    } finally {
      setDraggedScheduleId(null);
    }
  };

  const detectAlerts = async () => {
    try {
      const { data } = await timeAttendanceApi.detectAlerts({
        dateFrom,
        dateTo,
        alertTypes: ['late', 'absence', 'missed_punch', 'early_departure'],
      }, companyId);
      toast.success(`${data.created} alerte(s) creee(s), ${data.updated} mise(s) a jour`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Detection alertes impossible');
    }
  };

  const updateAlert = async (item, status) => {
    try {
      await timeAttendanceApi.updateAlert(item.id, { status }, companyId);
      toast.success(status === 'resolved' ? 'Alerte resolue' : 'Alerte traitee');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Traitement alerte impossible');
    }
  };

  const dispatchNotifications = async () => {
    try {
      const { data } = await timeAttendanceApi.dispatchNotifications({
        limit: 50,
        simulateProviders: notificationForm.simulateProviders,
      }, companyId);
      toast.success(`${data.sent} notification(s) envoyee(s), ${data.skipped} en attente fournisseur`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Dispatch notifications impossible');
    }
  };

  const dispatchNotificationsAsync = async () => {
    try {
      const { data } = await timeAttendanceApi.dispatchNotificationsAsync({
        limit: 50,
        simulateProviders: notificationForm.simulateProviders,
      }, companyId);
      toast.success(`Job notification #${data.id} lance`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Job notification impossible');
    }
  };

  const retryNotification = async (item) => {
    try {
      await timeAttendanceApi.retryNotification(item.id, companyId);
      toast.success('Notification remise en file');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Retry notification impossible');
    }
  };

  const createClockEvent = async (event) => {
    event.preventDefault();
    if (!clockForm.employeeId) return toast.error('Employe obligatoire');
    try {
      await timeAttendanceApi.createClockEvent({
        employeeId: Number(clockForm.employeeId),
        eventType: clockForm.eventType,
        eventTime: clockForm.eventTime ? new Date(clockForm.eventTime).toISOString() : undefined,
        method: 'manual',
      }, companyId);
      toast.success('Pointage enregistre');
      setClockForm({ ...clockForm, eventTime: '' });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Pointage impossible');
    }
  };

  const importTerminalRows = async (event) => {
    event.preventDefault();
    const parsed = parseTerminalRows(terminalForm.rows);
    if (!parsed.length) return toast.error('Aucune ligne terminal valide');
    try {
      const { data } = await timeAttendanceApi.importClockEvents({
        terminalId: terminalForm.terminalId,
        source: terminalForm.source || 'api_terminal',
        batchReference: `WEB-${Date.now()}`,
        events: parsed,
      }, companyId);
      toast.success(`${data.success} pointage(s), ${data.duplicates} doublon(s), ${data.failed} erreur(s)`);
      setTerminalForm({ ...terminalForm, rows: '' });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import terminal impossible');
    }
  };

  const calculate = async () => {
    try {
      const { data } = await timeAttendanceApi.calculate({ dateFrom, dateTo }, companyId);
      toast.success(`${data.success} journee(s) calculee(s), ${data.failed} erreur(s)`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Calcul impossible');
    }
  };

  const calculateAsync = async () => {
    try {
      const { data } = await timeAttendanceApi.calculateAsync({ dateFrom, dateTo }, companyId);
      toast.success(`Job calcul #${data.id} lance`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Job calcul impossible');
    }
  };

  const detectAlertsAsync = async () => {
    try {
      const { data } = await timeAttendanceApi.detectAlertsAsync({
        dateFrom,
        dateTo,
        alertTypes: ['late', 'absence', 'missed_punch', 'early_departure'],
      }, companyId);
      toast.success(`Job alertes #${data.id} lance`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Job alertes impossible');
    }
  };

  const cancelJob = async (item) => {
    try {
      await timeAttendanceApi.cancelJob(item.id, companyId);
      toast.success('Job annule');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Annulation job impossible');
    }
  };

  const approve = async (item) => {
    try {
      await timeAttendanceApi.workflow(item.id, 'hr_approved', companyId);
      toast.success('Journee approuvee');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Validation impossible');
    }
  };

  const exportPayroll = async () => {
    const target = new Date(`${dateFrom}T00:00:00`);
    try {
      const { data } = await timeAttendanceApi.exportPayroll({ month: target.getMonth() + 1, year: target.getFullYear() }, companyId);
      toast.success(`${data.employees} employe(s) exporte(s) vers la paie`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export vers la paie impossible');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Temps et presence</h1>
          <p className="page-subtitle">{company?.name} - workforce management multi-sites et paie</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input className="input w-40" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <button className="btn-secondary flex items-center gap-2" onClick={load}><ArrowPathIcon className="w-4 h-4" /> Actualiser</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <Kpi icon={UsersIcon} label="Effectif actif" value={dashboard?.activeEmployees || 0} tone="indigo" />
            <Kpi icon={CheckIcon} label="Presents" value={dashboard?.present || 0} tone="emerald" />
            <Kpi icon={CalendarDaysIcon} label="Absents" value={dashboard?.absent || 0} tone="red" />
            <Kpi icon={ClockIcon} label="Retards" value={dashboard?.late || 0} tone="amber" />
            <Kpi icon={ChartBarIcon} label="Alertes" value={openAlerts} tone="red" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="card space-y-4">
              <PanelTitle title="Actions rapides" subtitle="Accédez directement aux tâches les plus courantes" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => setActiveTab(action.id)}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-indigo-600">
                          <Icon className="h-4 w-4" />
                          <span className="font-semibold text-gray-900">{action.title}</span>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600 shadow-sm">
                          {action.badge}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{action.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card space-y-3">
              <PanelTitle title="Calcul et paie" subtitle="Période active" />
              <div className="grid grid-cols-2 gap-3">
                <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button className="btn-secondary w-full justify-center flex items-center gap-2" type="button" onClick={calculate}>
                  <SparklesIcon className="h-4 w-4" /> Calculer
                </button>
                <button className="btn-primary w-full justify-center flex items-center gap-2" type="button" onClick={calculateAsync}>
                  <ArrowPathIcon className="h-4 w-4" /> Job calcul
                </button>
              </div>
              <button className="btn-primary w-full justify-center flex items-center gap-2" type="button" onClick={exportPayroll}>
                <DocumentArrowDownIcon className="h-4 w-4" /> Exporter vers paie
              </button>
              <p className="text-xs text-gray-500">{approvedCount} journée(s) approuvée(s) exportables.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card xl:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <PanelTitle title="Tendance presence" subtitle={`${analytics?.dateFrom || dateFrom} - ${analytics?.dateTo || dateTo}`} />
                <ChartBarIcon className="w-5 h-5 text-indigo-500" />
              </div>
              {loading || !analytics?.trend?.length ? (
                <EmptyChart loading={loading} />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={analytics.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip labelFormatter={longDate} />
                    <Line type="monotone" dataKey="present" name="Presents" stroke="#10b981" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="absent" name="Absents" stroke="#ef4444" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="late" name="Retards" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <PanelTitle title="Statuts" subtitle="Repartition periode" />
              {loading || !statusData.length ? (
                <EmptyChart loading={loading} />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="48%" outerRadius={88} innerRadius={48} dataKey="count" paddingAngle={3}>
                      {statusData.map((item) => <Cell key={item.status} fill={item.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card xl:col-span-2">
              <PanelTitle title="Presence par departement" subtitle="Presents, absents, retards" />
              {loading || !analytics?.byDepartment?.length ? (
                <EmptyChart loading={loading} />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.byDepartment}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="department" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="present" name="Presents" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" name="Absents" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late" name="Retards" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <PanelTitle title="Calendrier" subtitle={calendarTitle(dateFrom)} />
              <div className="grid grid-cols-7 gap-1 mt-4 text-center text-[11px] font-bold uppercase text-gray-400">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => <div key={`${day}-${index}`}>{day}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 mt-2">
                {calendarCells.map((cell) => <CalendarCell key={cell.key} cell={cell} />)}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'planning' && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <form onSubmit={createRotation} className="card space-y-3">
              <PanelTitle title="Rotation" subtitle="Cycle travail/repos" />
              <div className="grid grid-cols-2 gap-3">
                <input className="input" value={rotationForm.code} onChange={(e) => setRotationForm({ ...rotationForm, code: e.target.value })} placeholder="Code" />
                <input className="input" value={rotationForm.name} onChange={(e) => setRotationForm({ ...rotationForm, name: e.target.value })} placeholder="Nom" />
                <input className="input" type="number" min="1" value={rotationForm.workDays} onChange={(e) => setRotationForm({ ...rotationForm, workDays: e.target.value })} />
                <input className="input" type="number" min="0" value={rotationForm.restDays} onChange={(e) => setRotationForm({ ...rotationForm, restDays: e.target.value })} />
                <select className="input" value={rotationForm.rotationType} onChange={(e) => setRotationForm({ ...rotationForm, rotationType: e.target.value })}>
                  <option value="work_rest">Travail / repos</option>
                  <option value="day_night">Jour / nuit</option>
                </select>
                <input className="input" type="date" value={rotationForm.cycleStartDate} onChange={(e) => setRotationForm({ ...rotationForm, cycleStartDate: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select className="input" value={rotationForm.dayProfileId} onChange={(e) => setRotationForm({ ...rotationForm, dayProfileId: e.target.value })}>
                  <option value="">Profil jour</option>
                  {(configuration?.profiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.code} - {profile.name}</option>)}
                </select>
                <select className="input" value={rotationForm.nightProfileId} onChange={(e) => setRotationForm({ ...rotationForm, nightProfileId: e.target.value })}>
                  <option value="">Profil nuit</option>
                  {(configuration?.profiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.code} - {profile.name}</option>)}
                </select>
              </div>
              <button className="btn-primary w-full justify-center flex items-center gap-2" type="submit">
                <CalendarDaysIcon className="h-4 w-4" /> Enregistrer rotation
              </button>
            </form>

            <div className="card space-y-3">
              <PanelTitle title="Generer planning" subtitle="Applique rotation ou profil fixe" />
              <div className="grid grid-cols-2 gap-3">
                <select className="input" value={scheduleForm.rotationPatternId} onChange={(e) => setScheduleForm({ ...scheduleForm, rotationPatternId: e.target.value, profileId: '' })}>
                  <option value="">Rotation</option>
                  {(configuration?.rotations || []).map((rotation) => <option key={rotation.id} value={rotation.id}>{rotation.code} - {rotation.name}</option>)}
                </select>
                <select className="input" value={scheduleForm.profileId} onChange={(e) => setScheduleForm({ ...scheduleForm, profileId: e.target.value, rotationPatternId: '' })}>
                  <option value="">Profil fixe</option>
                  {(configuration?.profiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.code} - {profile.name}</option>)}
                </select>
                <select className="input" value={scheduleForm.employeeId} onChange={(e) => setScheduleForm({ ...scheduleForm, employeeId: e.target.value })}>
                  <option value="">Tous les employes</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.matricule} - {employee.lastName}</option>)}
                </select>
                <input className="input" value={scheduleForm.department} onChange={(e) => setScheduleForm({ ...scheduleForm, department: e.target.value })} placeholder="Departement" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={scheduleForm.overwrite} onChange={(e) => setScheduleForm({ ...scheduleForm, overwrite: e.target.checked })} />
                Remplacer les lignes existantes
              </label>
              <button className="btn-secondary w-full justify-center flex items-center gap-2" type="button" onClick={generateSchedule}>
                <SparklesIcon className="h-4 w-4" /> Générer planning
              </button>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <PanelTitle title="Planning genere" subtitle={`${schedule.length} ligne(s) sur la periode`} />
                <CalendarDaysIcon className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="mt-4 max-h-64 overflow-auto space-y-2">
                {schedule.slice(0, 12).map((item) => (
                  <div key={item.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-900">{new Date(item.workDate).toLocaleDateString('fr-FR')}</span>
                      <span className={item.status === 'rest' ? 'badge-gray' : 'badge-blue'}>{item.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{item.matricule} - {item.lastName} {item.firstName}</div>
                    <div className="mt-1 text-xs text-gray-500">{item.profileName || item.shiftLabel || 'Repos'} {item.plannedStart ? `(${item.plannedStart} - ${item.plannedEnd})` : ''}</div>
                  </div>
                ))}
                {!schedule.length && <p className="text-sm text-gray-400">Aucun planning genere sur cette periode.</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PanelTitle title="Calendrier planning" subtitle="Deplacer une carte, filtrer par equipe ou passer en vue semaine" />
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn-secondary py-2 px-3" type="button" onClick={() => movePlanningWindow(-1)}>
                    Prec.
                  </button>
                  <button
                    className={planningFilters.viewMode === 'month' ? 'btn-primary py-2 px-3' : 'btn-secondary py-2 px-3'}
                    type="button"
                    onClick={() => setPlanningFilters({ ...planningFilters, viewMode: 'month' })}
                  >
                    Mois
                  </button>
                  <button
                    className={planningFilters.viewMode === 'week' ? 'btn-primary py-2 px-3' : 'btn-secondary py-2 px-3'}
                    type="button"
                    onClick={() => setPlanningFilters({ ...planningFilters, viewMode: 'week' })}
                  >
                    Semaine
                  </button>
                  <button className="btn-secondary py-2 px-3" type="button" onClick={() => movePlanningWindow(1)}>
                    Suiv.
                  </button>
                  <button className="btn-secondary py-2 px-3" type="button" onClick={resetPlanningWindow}>
                    Aujourd'hui
                  </button>
                  <span className="badge-blue">{schedule.length} shift(s)</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                <select className="input" value={planningFilters.teamId} onChange={(e) => setPlanningFilters({ ...planningFilters, teamId: e.target.value })}>
                  <option value="">Toutes les equipes</option>
                  {(configuration?.teams || []).map((team) => <option key={team.id} value={team.id}>{team.code} - {team.name}</option>)}
                </select>
                <select className="input" value={planningFilters.employeeId} onChange={(e) => setPlanningFilters({ ...planningFilters, employeeId: e.target.value })}>
                  <option value="">Tous les employes</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.matricule} - {employee.lastName}</option>)}
                </select>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  {planningWindowLabel(dateFrom, dateTo, planningFilters.viewMode)}
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 mt-4 text-center text-[11px] font-bold uppercase text-gray-400">
                {scheduleCalendarCells.map((cell) => <div key={`planning-head-${cell.key}`}>{cell.weekdayLabel}</div>)}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 mt-2">
                {scheduleCalendarCells.map((cell) => (
                  <ScheduleCalendarCell
                    key={cell.key}
                    cell={cell}
                    draggedScheduleId={draggedScheduleId}
                    onDragStart={setDraggedScheduleId}
                    onDrop={(workDate) => {
                      const item = schedule.find((row) => Number(row.id) === Number(draggedScheduleId));
                      moveScheduleToDate(item, workDate);
                    }}
                    onEdit={editSchedule}
                  />
                ))}
              </div>
            </div>

            <div className="card space-y-3">
              <PanelTitle title="Edition planning" subtitle={selectedSchedule ? `${selectedSchedule.matricule} - ${selectedSchedule.lastName}` : 'Selectionner une carte'} />
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="text-[11px] font-bold uppercase text-gray-400">Charge equipes</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {planningTeamSummary.slice(0, 6).map((item) => (
                    <span key={item.key} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600">
                      {item.label}: {item.count}
                    </span>
                  ))}
                  {!planningTeamSummary.length && <span className="text-xs text-gray-400">Aucune equipe visible sur la periode.</span>}
                </div>
              </div>
              <select className="input" value={scheduleEdit.scheduleId} onChange={(e) => {
                const item = schedule.find((row) => Number(row.id) === Number(e.target.value));
                if (item) editSchedule(item);
                else setScheduleEdit({ ...scheduleEdit, scheduleId: '' });
              }}>
                <option value="">Ligne de planning</option>
                {schedule.slice(0, 500).map((item) => (
                  <option key={item.id} value={item.id}>
                    {new Date(item.workDate).toLocaleDateString('fr-FR')} - {item.matricule} - {item.lastName}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <select className="input" value={scheduleEdit.status} onChange={(e) => setScheduleEdit({ ...scheduleEdit, status: e.target.value })}>
                  <option value="planned">Planifie</option>
                  <option value="rest">Repos</option>
                  <option value="leave">Conge</option>
                  <option value="training">Formation</option>
                  <option value="suspended">Suspendu</option>
                </select>
                <select className="input" value={scheduleEdit.profileId} onChange={(e) => setScheduleEdit({ ...scheduleEdit, profileId: e.target.value })} disabled={scheduleEdit.status === 'rest'}>
                  <option value="">Profil actuel</option>
                  {(configuration?.profiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.code} - {profile.name}</option>)}
                </select>
                <input className="input" type="time" value={scheduleEdit.plannedStart} onChange={(e) => setScheduleEdit({ ...scheduleEdit, plannedStart: e.target.value })} disabled={scheduleEdit.status === 'rest'} />
                <input className="input" type="time" value={scheduleEdit.plannedEnd} onChange={(e) => setScheduleEdit({ ...scheduleEdit, plannedEnd: e.target.value })} disabled={scheduleEdit.status === 'rest'} />
              </div>
              <input className="input" value={scheduleEdit.shiftLabel} onChange={(e) => setScheduleEdit({ ...scheduleEdit, shiftLabel: e.target.value })} placeholder="Libelle shift" />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={scheduleEdit.recalculate} onChange={(e) => setScheduleEdit({ ...scheduleEdit, recalculate: e.target.checked })} />
                Recalculer la journee
              </label>
              <button className="btn-primary w-full justify-center flex items-center gap-2" type="button" onClick={saveScheduleEdit}>
                <CheckIcon className="h-4 w-4" /> Enregistrer modification
              </button>
              {selectedSchedule && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
                  {new Date(selectedSchedule.workDate).toLocaleDateString('fr-FR')} - {selectedSchedule.profileName || selectedSchedule.shiftLabel || selectedSchedule.status}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'monitoring' && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PanelTitle title="Alertes automatiques" subtitle="Retards, absences, oublis de pointage et departs anticipes" />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary flex items-center gap-2" type="button" onClick={detectAlerts}>
                    <ArrowPathIcon className="w-4 h-4" /> Detecter alertes
                  </button>
                  <button className="btn-primary flex items-center gap-2" type="button" onClick={detectAlertsAsync}>
                    <ArrowPathIcon className="w-4 h-4" /> Job alertes
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {alerts.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-lg border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={alertBadge(item.alertType)}>{alertLabel(item.alertType)}</span>
                          <span className={severityBadge(item.severity)}>{item.severity}</span>
                        </div>
                        <div className="mt-2 font-bold text-gray-900">{item.title}</div>
                        <div className="mt-1 text-xs text-gray-500">{new Date(item.alertDate).toLocaleDateString('fr-FR')} - {item.matricule} - {item.lastName} {item.firstName}</div>
                        <p className="mt-2 text-sm text-gray-600">{item.message}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button className="btn-secondary py-1 px-2 text-xs" type="button" onClick={() => updateAlert(item, 'acknowledged')}>Vu</button>
                        <button className="btn-primary py-1 px-2 text-xs" type="button" onClick={() => updateAlert(item, 'resolved')}>Resoudre</button>
                      </div>
                    </div>
                  </div>
                ))}
                {!alerts.length && <p className="text-sm text-gray-400">Aucune alerte ouverte sur cette periode.</p>}
              </div>
            </div>

            <div className="card space-y-4">
              <div className="flex items-center justify-between gap-3">
                <PanelTitle title="Notifications" subtitle="Outbox interne, email, SMS et WhatsApp" />
                <BellIcon className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <OutboxStat label="A envoyer" value={(outboxSummary.queued || 0) + (outboxSummary.retry || 0)} tone="blue" />
                <OutboxStat label="Provider" value={outboxSummary.pending_provider || 0} tone="amber" />
                <OutboxStat label="Envoyees" value={outboxSummary.sent || 0} tone="green" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={notificationForm.simulateProviders}
                  onChange={(event) => setNotificationForm({ ...notificationForm, simulateProviders: event.target.checked })}
                />
                Simuler SMS et WhatsApp
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button className="btn-secondary w-full justify-center flex items-center gap-2" type="button" onClick={dispatchNotifications}>
                  <ArrowPathIcon className="w-4 h-4" /> Dispatcher
                </button>
                <button className="btn-primary w-full justify-center flex items-center gap-2" type="button" onClick={dispatchNotificationsAsync}>
                  <ArrowPathIcon className="w-4 h-4" /> Job dispatch
                </button>
              </div>
              <div className="max-h-80 overflow-auto space-y-2">
                {outbox.slice(0, 10).map((item) => (
                  <div key={item.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={channelBadge(item.channel)}>{notificationChannelLabel(item.channel)}</span>
                      <span className={notificationStatusBadge(item.status)}>{notificationStatusLabel(item.status)}</span>
                    </div>
                    <div className="mt-2 font-bold text-gray-900">{item.subject || alertLabel(item.alertType)}</div>
                    <div className="mt-1 text-xs text-gray-500">{item.recipient || 'Destinataire interne'}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {item.matricule ? `${item.matricule} - ${item.lastName} ${item.firstName}` : 'Alerte systeme'}
                    </div>
                    {item.lastError && <p className="mt-2 text-xs text-red-500">{item.lastError}</p>}
                    {item.status !== 'sent' && (
                      <button className="btn-secondary mt-3 py-1 px-2 text-xs" type="button" onClick={() => retryNotification(item)}>
                        Remettre en file
                      </button>
                    )}
                  </div>
                ))}
                {!outbox.length && <p className="text-sm text-gray-400">Aucune notification en file.</p>}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <PanelTitle title="Jobs temps" subtitle="Calcul, alertes et notifications en tache de fond" />
              <button className="btn-secondary flex items-center gap-2" type="button" onClick={load}>
                <ArrowPathIcon className="w-4 h-4" /> Actualiser jobs
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
              {jobs.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge-blue">{jobTypeLabel(item.jobType)}</span>
                        <span className={jobStatusBadge(item.status)}>{item.status}</span>
                      </div>
                      <div className="mt-2 font-bold text-gray-900">Job #{item.id}</div>
                      <div className="mt-1 text-xs text-gray-500">{item.processedCount}/{item.totalCount} traite(s) - {item.progress}%</div>
                      {item.failedCount > 0 && <div className="mt-1 text-xs text-red-500">{item.failedCount} echec(s)</div>}
                    </div>
                    {['queued', 'running'].includes(item.status) && (
                      <button className="btn-secondary py-1 px-2 text-xs" type="button" onClick={() => cancelJob(item)}>
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!jobs.length && <p className="text-sm text-gray-400">Aucun job temps lance pour cette entreprise.</p>}
            </div>
          </div>
        </>
      )}

      {activeTab === 'days' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card">
            <h2 className="font-bold text-gray-900 mb-3">Profils actifs</h2>
            <div className="space-y-2">
              {(configuration?.profiles || []).slice(0, 6).map((profile) => (
                <div key={profile.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="font-bold text-gray-900">{profile.name}</div>
                  <div className="text-xs text-gray-500">{profile.code} - {profile.profileType} - {profile.weeklyHours}h/semaine</div>
                </div>
              ))}
              {!configuration?.profiles?.length && <p className="text-sm text-gray-400">Aucun profil configure.</p>}
            </div>
          </div>

          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">Journees calculees</h2>
              <span className="badge-gray">{days.length} ligne(s)</span>
            </div>
            {loading ? (
              <p className="text-sm text-gray-400">Chargement...</p>
            ) : days.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune journee calculee sur cette periode.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead><tr>{['Date', 'Employe', 'Presence', 'Travaille', 'HS', 'Retard', 'Workflow', 'Action'].map((header) => <th key={header} className="th">{header}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {days.slice(0, 80).map((item) => (
                      <tr key={item.id} className="tr-hover">
                        <td className="td">{new Date(item.workDate).toLocaleDateString('fr-FR')}</td>
                        <td className="td">{item.matricule} - {item.lastName} {item.firstName}</td>
                        <td className="td"><PresenceBadge status={item.presenceStatus} /></td>
                        <td className="td">{minutes(item.workedMinutes)}</td>
                        <td className="td">{minutes(item.overtimeMinutes)}</td>
                        <td className="td">{item.lateMinutes || 0} min</td>
                        <td className="td"><span className="badge-blue">{item.workflowStatus}</span></td>
                        <td className="td">
                          {item.workflowStatus !== 'hr_approved' && <button className="btn-secondary py-1 px-2 text-xs flex items-center gap-1" onClick={() => approve(item)}><CheckIcon className="h-3 w-3" /> Approuver</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PanelTitle({ title, subtitle }) {
  return (
    <div>
      <h2 className="font-bold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }) {
  const colors = {
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    red: 'border-red-100 bg-red-50 text-red-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
  }[tone];
  return (
    <div className={`card ${colors}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide opacity-75">{label}</p>
        <Icon className="w-5 h-5 opacity-70" />
      </div>
      <p className="text-3xl font-extrabold mt-2">{value}</p>
    </div>
  );
}

function OutboxStat({ label, value, tone }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  }[tone] || 'bg-gray-50 text-gray-700 border-gray-100';
  return (
    <div className={`rounded-lg border p-2 ${colors}`}>
      <div className="text-[10px] font-bold uppercase">{label}</div>
      <div className="text-xl font-extrabold">{value}</div>
    </div>
  );
}

function PresenceBadge({ status }) {
  const cls = {
    present: 'badge-green',
    absent: 'badge-red',
    leave: 'badge-yellow',
    off: 'badge-gray',
  }[status] || 'badge-gray';
  return <span className={cls}>{STATUS_LABELS[status] || status || '-'}</span>;
}

function CalendarCell({ cell }) {
  const tone = {
    present: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    absent: 'bg-red-50 border-red-200 text-red-700',
    leave: 'bg-amber-50 border-amber-200 text-amber-700',
    off: 'bg-gray-50 border-gray-200 text-gray-400',
  }[cell.status] || 'bg-white border-gray-100 text-gray-700';
  return (
    <div className={`min-h-[54px] rounded-lg border p-1.5 text-xs ${cell.inMonth ? tone : 'bg-gray-50 border-gray-100 text-gray-300'}`}>
      <div className="font-bold">{cell.day}</div>
      {cell.count > 0 && <div className="mt-1 text-[10px] font-semibold">{cell.count} ligne(s)</div>}
    </div>
  );
}

function ScheduleCalendarCell({ cell, draggedScheduleId, onDragStart, onDrop, onEdit }) {
  const teamSummary = summarizePlanningTeams(cell.items);
  return (
    <div
      className={`min-h-[128px] rounded-lg border p-2 text-xs ${cell.inMonth ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 text-gray-300'} ${draggedScheduleId ? 'ring-1 ring-indigo-100' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDrop(cell.key)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-gray-700">{cell.day}</span>
        {cell.items.length > 0 && <span className="text-[10px] font-bold text-indigo-500">{cell.items.length}</span>}
      </div>
      {teamSummary.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {teamSummary.slice(0, 2).map((team) => (
            <span key={team.key} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
              {team.label} {team.count}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 space-y-1.5">
        {cell.items.slice(0, 3).map((item) => (
          <button
            key={item.id}
            type="button"
            draggable
            onDragStart={() => onDragStart(item.id)}
            onClick={() => onEdit(item)}
            className={`w-full rounded-md border px-2 py-1.5 text-left transition ${scheduleStatusTone(item.status)}`}
          >
            <div className="truncate font-bold">{item.matricule} - {item.lastName}</div>
            <div className="truncate text-[10px] opacity-80">
              {[item.teamCode || item.teamName, item.profileName || item.shiftLabel || scheduleStatusLabel(item.status)].filter(Boolean).join(' - ')}
            </div>
          </button>
        ))}
        {cell.items.length > 3 && <div className="text-[10px] font-semibold text-gray-400">+{cell.items.length - 3} autre(s)</div>}
      </div>
    </div>
  );
}

function EmptyChart({ loading }) {
  return <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">{loading ? 'Chargement...' : 'Aucune donnee disponible'}</div>;
}

function parseTerminalRows(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [matricule, eventType, eventTime] = line.split(/[;,]/).map((item) => item?.trim());
      return matricule && eventType && eventTime ? { matricule, eventType: eventType.toLowerCase(), eventTime } : null;
    })
    .filter(Boolean);
}

function buildCalendar(dateFrom, rows) {
  const base = new Date(`${dateFrom.slice(0, 7)}-01T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const byDate = new Map();

  rows.forEach((row) => {
    const key = normalizeDate(row.workDate);
    const current = byDate.get(key) || { count: 0, present: 0, absent: 0, leave: 0, off: 0 };
    current.count += 1;
    current[row.presenceStatus] = (current[row.presenceStatus] || 0) + 1;
    byDate.set(key, current);
  });

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = normalizeDate(date);
    const summary = byDate.get(key);
    return {
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      count: summary?.count || 0,
      status: dominantStatus(summary),
    };
  });
}

function buildScheduleCalendar(dateFrom, rows, viewMode = 'month') {
  const base = new Date(`${dateFrom}T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = viewMode === 'week' ? startOfWeek(base) : new Date(year, month, 1);
  const offset = viewMode === 'week' ? 0 : (first.getDay() + 6) % 7;
  const start = new Date(first);
  if (viewMode !== 'week') start.setDate(first.getDate() - offset);
  const byDate = new Map();

  rows.forEach((row) => {
    const key = normalizeDate(row.workDate);
    const list = byDate.get(key) || [];
    list.push(row);
    byDate.set(key, list);
  });

  const total = viewMode === 'week' ? 7 : 42;
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = normalizeDate(date);
    return {
      key,
      day: date.getDate(),
      inMonth: viewMode === 'week' ? true : date.getMonth() === month,
      weekdayLabel: shortWeekday(date),
      items: byDate.get(key) || [],
    };
  });
}

function summarizePlanningTeams(rows) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = row.teamCode || row.teamName || 'Sans equipe';
    const current = counts.get(key) || 0;
    counts.set(key, current + 1);
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ key: label, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function dominantStatus(summary) {
  if (!summary) return null;
  if (summary.absent) return 'absent';
  if (summary.leave) return 'leave';
  if (summary.present) return 'present';
  return summary.off ? 'off' : null;
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function shortDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function longDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function calendarTitle(value) {
  return new Date(`${value.slice(0, 7)}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function planningWindowLabel(dateFrom, dateTo, viewMode) {
  const start = new Date(`${dateFrom}T00:00:00`);
  if (viewMode === 'week') {
    const end = new Date(`${dateTo}T00:00:00`);
    return `Vue hebdomadaire du ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`;
  }
  return `Vue mensuelle ${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
}

function startOfWeek(date) {
  const copy = new Date(date);
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function shortWeekday(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'narrow' }).toUpperCase();
}

function toTimeInput(value) {
  return value ? String(value).slice(0, 5) : '';
}

function scheduleStatusLabel(status) {
  return {
    planned: 'Planifie',
    rest: 'Repos',
    leave: 'Conge',
    training: 'Formation',
    suspended: 'Suspendu',
  }[status] || status || 'Planning';
}

function scheduleStatusTone(status) {
  return {
    planned: 'border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    rest: 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100',
    leave: 'border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100',
    training: 'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100',
    suspended: 'border-red-100 bg-red-50 text-red-700 hover:bg-red-100',
  }[status] || 'border-gray-100 bg-white text-gray-700 hover:bg-gray-50';
}

function alertLabel(type) {
  return {
    late: 'Retard',
    absence: 'Absence',
    missed_punch: 'Pointage',
    early_departure: 'Depart',
  }[type] || type || 'Alerte';
}

function alertBadge(type) {
  return {
    late: 'badge-yellow',
    absence: 'badge-red',
    missed_punch: 'badge-blue',
    early_departure: 'badge-gray',
  }[type] || 'badge-gray';
}

function severityBadge(severity) {
  return {
    high: 'badge-red',
    medium: 'badge-yellow',
    low: 'badge-gray',
  }[severity] || 'badge-gray';
}

function notificationChannelLabel(channel) {
  return {
    internal: 'Interne',
    email: 'Email',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
  }[channel] || channel || 'Canal';
}

function channelBadge(channel) {
  return {
    internal: 'badge-blue',
    email: 'badge-green',
    sms: 'badge-yellow',
    whatsapp: 'badge-gray',
  }[channel] || 'badge-gray';
}

function notificationStatusLabel(status) {
  return {
    queued: 'File',
    retry: 'Retry',
    pending_provider: 'Provider',
    sent: 'Envoyee',
    failed: 'Echec',
  }[status] || status || 'Statut';
}

function notificationStatusBadge(status) {
  return {
    queued: 'badge-blue',
    retry: 'badge-yellow',
    pending_provider: 'badge-gray',
    sent: 'badge-green',
    failed: 'badge-red',
  }[status] || 'badge-gray';
}

function jobTypeLabel(type) {
  return {
    calculate: 'Calcul',
    detect_alerts: 'Alertes',
    dispatch_notifications: 'Notifications',
  }[type] || type || 'Job';
}

function jobStatusBadge(status) {
  return {
    queued: 'badge-blue',
    running: 'badge-yellow',
    completed: 'badge-green',
    completed_with_errors: 'badge-yellow',
    cancelled: 'badge-gray',
    failed: 'badge-red',
  }[status] || 'badge-gray';
}

function minutes(value) {
  const total = Number(value || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h${String(mins).padStart(2, '0')}`;
}
