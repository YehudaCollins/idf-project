import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const charts = [
  { key: 'in_progress',      title: 'בתהליך',          color: '#14b8a6', bg: 'from-teal-50 to-cyan-50' },
  { key: 'waiting_approval', title: 'ממתין לאישור',     color: '#3b82f6', bg: 'from-blue-50 to-indigo-50' },
  { key: 'overdue',          title: 'בחריגה',           color: '#f43f5e', bg: 'from-rose-50 to-red-50' },
];

export function StatusPieCharts({ stats }) {
  return (
    <>
      {charts.map(({ key, title, color, bg }) => {
        const value = stats[key] || 0;
        const pct = stats.total > 0 ? Math.round((value / stats.total) * 100) : 0;
        const data = [
          { value, color },
          { value: Math.max(0, stats.total - value), color: '#e5e7eb' },
        ];
        return (
          <div key={key} className={`rounded-xl overflow-hidden border border-gray-100`}>
            <div className={`bg-gradient-to-br ${bg} px-4 pt-4 pb-0`}>
              <p className="text-center text-sm font-medium text-gray-500">{title}</p>
            </div>
            <div className={`bg-gradient-to-br ${bg} pb-4`}>
              <div className="h-36 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={3}
                      dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                      {data.map((entry, i) => (
                        <Cell key={i} fill={entry.color}
                          style={{ filter: i === 0 ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' : 'none' }} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-800">{pct}%</span>
                  <span className="text-xs text-gray-400">{value} / {stats.total}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
