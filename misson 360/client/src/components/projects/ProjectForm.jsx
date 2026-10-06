import { useState, useEffect } from 'react';
import { Calendar, FolderOpen } from 'lucide-react';

const fieldBase =
  'w-full rounded-lg border border-slate-200/95 bg-slate-100/90 px-3 py-2.5 text-[13px] text-slate-800 shadow-inner placeholder:text-slate-400 focus:border-[#c47f17] focus:outline-none focus:ring-2 focus:ring-[#c47f17]/25 dark:border-slate-600 dark:bg-slate-800/85 dark:text-slate-100 dark:placeholder:text-slate-500';

const today = () => new Date().toISOString().slice(0, 10);
const dateInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return x.toISOString().slice(0, 10);
};

function Label({ children, required }) {
  return (
    <label className="mb-1.5 block text-[12px] font-semibold text-slate-700 dark:text-slate-200">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </label>
  );
}

function DateField({ value, onChange, id, required }) {
  return (
    <div className="relative">
      <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        id={id}
        type="date"
        value={value}
        onChange={onChange}
        required={required}
        className={fieldBase + ' pr-10'}
      />
    </div>
  );
}

export function ProjectForm({ initialProject = null, onSubmit, formId, showFooterActions = true, submitLabel }) {
  const isEdit = Boolean(initialProject?._id);
  const [form, setForm] = useState(() => ({
    name: initialProject?.name || '',
    description: initialProject?.description || '',
    givenDate: dateInput(initialProject?.givenDate) || today(),
  }));

  useEffect(() => {
    setForm({
      name: initialProject?.name || '',
      description: initialProject?.description || '',
      givenDate: dateInput(initialProject?.givenDate) || today(),
    });
  }, [initialProject?._id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      givenDate: form.givenDate ? new Date(form.givenDate) : new Date(),
    });
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-amber-100/80 bg-amber-50/40 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-950/15">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-900/60">
          <FolderOpen className="h-4.5 w-4.5 text-[#c47f17]" />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-[#a0660e] dark:text-amber-200">
            תיקיית פרויקט
          </p>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
            פרויקט מאגד מספר משימות תחת תאריך מתן משותף
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 sm:col-span-2">
          <Label required>שם הפרויקט</Label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            required
            placeholder="לדוגמא: הכנת תרגיל יחידתי"
            className={fieldBase}
          />
        </div>
        <div className="min-w-0 sm:col-span-2">
          <Label>פירוט נושא <span className="font-normal text-slate-400">(אופציונלי)</span></Label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
            placeholder="תיאור קצר של הפרויקט…"
            className={fieldBase + ' min-h-[88px] resize-none'}
          />
        </div>
        <div className="min-w-0 sm:col-span-2">
          <Label required>תאריך מתן (משותף לכל המשימות בפרויקט)</Label>
          <DateField value={form.givenDate} onChange={e => set('givenDate', e.target.value)} id="pf-given" required />
        </div>
      </div>

      {showFooterActions ? (
        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="submit"
            className="w-full rounded-lg border-2 border-[#a0660e] bg-gradient-to-l from-[#c47f17] to-[#a0660e] py-3 text-[14px] font-bold text-white shadow-md transition hover:brightness-105 sm:max-w-xs sm:shrink-0"
          >
            {submitLabel || (isEdit ? 'עדכן פרויקט' : 'צור פרויקט')}
          </button>
        </div>
      ) : null}
    </form>
  );
}
