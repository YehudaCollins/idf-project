const COLORS = ['#14b8a6', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

export function TasksByRoleChart({ data, total }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-800">משימות לפי בעל תפקיד</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">סה"כ: <span className="font-semibold text-teal-600">{total}</span></span>
        </div>
      </div>
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={item.role} className="flex items-center gap-4">
            <div className="w-32 text-sm text-right text-gray-700 font-medium truncate">{item.role}</div>
            <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-500 flex items-center justify-end px-3"
                style={{ width: `${Math.max((item.count / maxCount) * 100, 20)}%`, backgroundColor: COLORS[index % COLORS.length] }}
              >
                <span className="text-xs font-bold text-white">{item.count}</span>
              </div>
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="text-center text-gray-400 text-sm py-4">אין נתונים</p>}
      </div>

      {data.length > 0 && total > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="flex h-6 w-full overflow-hidden rounded-full">
            {data.map((item, index) => (
              <div key={item.role} className="h-full transition-all duration-500 first:rounded-r-full last:rounded-l-full"
                style={{ width: `${(item.count / total) * 100}%`, backgroundColor: COLORS[index % COLORS.length] }} />
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-3">
            {data.map((item, index) => (
              <div key={item.role} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-xs text-gray-400">{item.role} ({Math.round((item.count / total) * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
