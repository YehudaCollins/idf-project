import { ArrowLeft, GitBranch, UserPlus, Wand2 } from 'lucide-react';

const STEPS = [
  {
    icon: UserPlus,
    title: 'קלט התחברות',
    desc: 'שם + נתיב ארגוני גולמי',
  },
  {
    icon: Wand2,
    title: 'פירוק והתאמה',
    desc: 'כל קטע: exact → alias → fuzzy → AI',
  },
  {
    icon: GitBranch,
    title: 'עדכון העץ',
    desc: 'התאמה ליחידה קיימת, או יצירת יחידה חדשה',
  },
];

export function IngestFlowBanner() {
  return (
    <div className="panel mb-6 overflow-hidden">
      <div className="panel-header bg-slate-50/80">
        <p className="text-[13px] font-semibold text-slate-800">איך זה עובד?</p>
        <p className="mt-0.5 text-[12px] text-slate-500">
          כן — המערכת בונה ומרחיבה את העץ אוטומטית ממשתמשים חדשים. אם הנתיב לא קיים, נוצרות יחידות
          חדשות (ללא המצאת רמות — רק סימון <code className="rounded bg-slate-200/80 px-1 text-[11px]">suspectedMissingLevel</code>).
        </p>
      </div>
      <div className="grid gap-0 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex items-start gap-3 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent ring-1 ring-teal-100">
              <step.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-accent">שלב {i + 1}</p>
              <p className="text-[13px] font-semibold text-slate-900">{step.title}</p>
              <p className="mt-0.5 text-[12px] text-slate-500">{step.desc}</p>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowLeft className="mr-auto hidden h-4 w-4 text-slate-300 sm:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
