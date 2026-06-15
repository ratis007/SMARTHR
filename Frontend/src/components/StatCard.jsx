export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const styles = {
    blue:   { bg: 'bg-blue-100',   icon: 'text-blue-700',    ring: 'ring-blue-200',   val: 'text-blue-900' },
    green:  { bg: 'bg-emerald-100', icon: 'text-emerald-700', ring: 'ring-emerald-200', val: 'text-emerald-900' },
    yellow: { bg: 'bg-amber-100',  icon: 'text-amber-700',   ring: 'ring-amber-200',  val: 'text-amber-900' },
    purple: { bg: 'bg-violet-100', icon: 'text-violet-700',  ring: 'ring-violet-200', val: 'text-violet-900' },
    red:    { bg: 'bg-red-100',    icon: 'text-red-700',     ring: 'ring-red-200',    val: 'text-red-900' },
    indigo: { bg: 'bg-indigo-100', icon: 'text-indigo-700',  ring: 'ring-indigo-200', val: 'text-indigo-900' },
  };
  const s = styles[color] ?? styles.blue;

  return (
    <div className="card flex items-center gap-4 hover:shadow-md transition-shadow duration-200">
      <div className={`w-13 h-13 w-[52px] h-[52px] rounded-2xl flex items-center justify-center shrink-0 ${s.bg} ring-2 ${s.ring}`}>
        <Icon className={`w-6 h-6 ${s.icon}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest truncate">{title}</p>
        <p className={`text-2xl font-extrabold mt-1 leading-tight ${s.val}`}>{value ?? '—'}</p>
        {subtitle && <p className="text-xs font-medium text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {trend !== undefined && (
        <div className={`text-xs font-bold px-2.5 py-1.5 rounded-xl ${trend >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </div>
      )}
    </div>
  );
}
