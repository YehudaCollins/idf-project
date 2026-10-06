import { Bell, Search } from 'lucide-react';

function getWeekNumber(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((date - start) / 604800000);
}

export function Header({ environmentName = 'Mission 360' }) {
  const week = getWeekNumber(new Date());

  return (
    <header className="w-full h-14 shrink-0 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center px-6 shadow-sm z-10 no-print">
      {/* Right — Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            placeholder="חיפוש..."
            className="w-full pr-9 pl-4 h-9 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 transition-colors"
          />
        </div>
      </div>

      {/* Center */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-[#fef9ee] dark:bg-[#1a1600] border border-[#c47f17]/20 dark:border-[#c47f17]/40 px-4 py-1.5 rounded-full">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="font-semibold text-[#c47f17] dark:text-[#f0c040] text-sm">{environmentName}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
          <span className="text-sm">שבוע</span>
          <span className="text-[16px] font-bold text-slate-700 dark:text-slate-300">{week}</span>
        </div>
      </div>

      {/* Left — Bell */}
      <div className="flex items-center gap-2">
        <button className="relative p-2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 left-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>
      </div>
    </header>
  );
}
