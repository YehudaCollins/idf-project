import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { MoreVertical } from 'lucide-react';

/** data מגיע רק מ-MongoDB (אגרגציה בדשבורד) — ללא נתוני דמה */
export function MonthlyChart({ data = [] }) {
  const hasData = data.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-800">הנחיות לפי חודשים</h3>
        <button type="button" className="p-1 text-gray-400 hover:text-gray-600 rounded">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
      {!hasData ? (
        <div className="h-52 flex items-center justify-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
          אין עדיין משימות עם תאריך מתן — הגרף יתמלא אוטומטית מהנתונים במסד
        </div>
      ) : (
        <>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="inProgressGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="overdueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={{ direction: 'rtl', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="inProgress" name="בתהליך" stroke="#14b8a6" strokeWidth={2} fill="url(#inProgressGradient)" dot={{ fill: '#14b8a6', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
                <Area type="monotone" dataKey="overdue" name="בחריגה" stroke="#f43f5e" strokeWidth={2} fill="url(#overdueGradient)" dot={{ fill: '#f43f5e', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex justify-center gap-6">
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-teal-500" /><span className="text-sm text-gray-400">בתהליך</span></div>
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-rose-500" /><span className="text-sm text-gray-400">בחריגה</span></div>
          </div>
        </>
      )}
    </div>
  );
}
