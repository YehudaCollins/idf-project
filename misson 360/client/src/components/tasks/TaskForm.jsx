import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, FolderOpen, Paperclip, X, File, Image, FileText, Users, Check, Search } from 'lucide-react';
import clsx from 'clsx';
import { CascadingLevelPicker } from './CascadingLevelPicker';
import { safeImageSrc } from '../../lib/safeImageSrc';

const today = () => new Date().toISOString().split('T')[0];

const fieldBase =
  'w-full rounded-lg border border-slate-200/95 bg-slate-100/90 px-3 py-2.5 text-[13px] text-slate-800 shadow-inner placeholder:text-slate-400 focus:border-[#c47f17] focus:outline-none focus:ring-2 focus:ring-[#c47f17]/25 dark:border-slate-600 dark:bg-slate-800/85 dark:text-slate-100 dark:placeholder:text-slate-500';

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

function dateInput(d) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return x.toISOString().slice(0, 10);
}

function normalizeCustomFieldsMap(task) {
  const cf = task?.customFields;
  if (!cf || typeof cf !== 'object' || Array.isArray(cf)) return {};
  return { ...cf };
}

function emptyForm() {
  return {
    title: '',
    description: '',
    targetRole: '',
    dueDate: '',
    level1: '',
    level2: '',
    level3: '',
    level4: '',
    level5: '',
    customFields: {},
  };
}

function taskToForm(task) {
  if (!task) return emptyForm();
  return {
    title: task.title || '',
    description: task.description || '',
    targetRole: task.targetRole || '',
    dueDate: dateInput(task.dueDate),
    level1: task.level1 || '',
    level2: task.level2 || '',
    level3: task.level3 || '',
    level4: task.level4 || '',
    level5: task.level5 || '',
    customFields: normalizeCustomFieldsMap(task),
  };
}

function fileIcon(mime) {
  if (!mime) return File;
  if (mime.startsWith('image/')) return Image;
  if (mime.includes('pdf') || mime.includes('text')) return FileText;
  return File;
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeLevel(value) {
  const text = String(value || '').trim();
  return text && text !== '---' ? text : '';
}

export function TaskForm({
  users = [],
  template = null,
  project = null,
  onSubmit,
  initialTask = null,
  formId,
  showFooterActions = true,
  submitLabel,
}) {
  const responsibilityLevels = template?.responsibilityLevels ?? 4;
  const customColumns = template?.customColumns ?? [];
  const isEdit = Boolean(initialTask?._id);

  const [form, setForm] = useState(() => taskToForm(initialTask));
  const [pendingFiles, setPendingFiles] = useState([]); // קבצים שנבחרו לפני שמירה
  // הקצאה ידנית למספר אנשים — זמין רק במצב יצירה (לא בעריכה)
  const [assignedToIds, setAssignedToIds] = useState([]);
  const [peopleSearch, setPeopleSearch] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    setForm(taskToForm(initialTask));
    setPendingFiles([]);
    setAssignedToIds([]);
    setPeopleSearch('');
  }, [initialTask?._id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCustomField = (id, val) =>
    setForm(f => ({
      ...f,
      customFields: { ...f.customFields, [id]: val },
    }));

  const handleLevelsChange = levels => setForm(f => ({ ...f, ...levels }));

  const levelSnapshot = useMemo(
    () => ({
      level1: form.level1,
      level2: form.level2,
      level3: form.level3,
      level4: form.level4,
      level5: form.level5,
    }),
    [form.level1, form.level2, form.level3, form.level4, form.level5],
  );

  const pickerKey = `${initialTask?._id || 'new'}-${responsibilityLevels}`;

  const handleFileChange = (e) => {
    const chosen = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...chosen]);
    e.target.value = '';
  };

  const removePending = (idx) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = e => {
    e.preventDefault();
    const { customFields, targetRole, ...rest } = form;
    onSubmit({
      ...rest,
      targetRole: targetRole?.trim() || '',
      customFields,
      dueDate: form.dueDate ? new Date(form.dueDate) : null,
      pendingFiles,
      // נשלח רק במצב יצירה (לא בעריכה) — כך התנהגות עריכה נשארת כשהייתה
      assignedToIds: isEdit ? undefined : assignedToIds,
    });
  };

  // משתמשים שתואמים לרמות שנבחרו (אם נבחרו). שימושי לסינון רשימת האנשים.
  const matchingUsers = useMemo(() => {
    if (!users.length) return [];
    return users.filter(u => {
      if (normalizeLevel(form.level1) && normalizeLevel(u.level1) !== normalizeLevel(form.level1)) return false;
      if (normalizeLevel(form.level2) && normalizeLevel(u.level2) !== normalizeLevel(form.level2)) return false;
      if (normalizeLevel(form.level3) && normalizeLevel(u.level3) !== normalizeLevel(form.level3)) return false;
      if (normalizeLevel(form.level4) && normalizeLevel(u.level4) !== normalizeLevel(form.level4)) return false;
      if (normalizeLevel(form.level5) && normalizeLevel(u.level5) !== normalizeLevel(form.level5)) return false;
      return true;
    });
  }, [users, form.level1, form.level2, form.level3, form.level4, form.level5]);

  const visiblePeople = useMemo(() => {
    const q = peopleSearch.trim();
    const list = matchingUsers;
    if (!q) return list;
    return list.filter(u =>
      (u.name && u.name.includes(q)) ||
      (u.username && u.username.includes(q)) ||
      (u.jobTitle && u.jobTitle.includes(q)) ||
      (u.rank && u.rank.includes(q)) ||
      (u.militaryRole && u.militaryRole.includes(q)) ||
      (u.tagId && String(u.tagId).includes(q)),
    );
  }, [matchingUsers, peopleSearch]);

  const togglePerson = (userId) => {
    setAssignedToIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
    );
  };

  const selectAllVisible = () => {
    const ids = visiblePeople.map(u => u._id);
    setAssignedToIds(prev => {
      const set = new Set(prev);
      ids.forEach(id => set.add(id));
      return [...set];
    });
  };

  const clearAllSelected = () => setAssignedToIds([]);

  const customColsPairs = [];
  for (let i = 0; i < customColumns.length; i += 2) {
    customColsPairs.push(customColumns.slice(i, i + 2));
  }

  const projectGiven = project?.givenDate ? new Date(project.givenDate) : (initialTask?.givenDate ? new Date(initialTask.givenDate) : null);

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      {project && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-100/70 bg-amber-50/40 px-3.5 py-2.5 dark:border-amber-900/30 dark:bg-amber-950/20">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-900/60">
            <FolderOpen className="h-3.5 w-3.5 text-[#c47f17]" />
          </div>
          <div className="min-w-0 text-[12px] leading-snug">
            <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{project.name}</p>
            <p className="text-slate-500 dark:text-slate-400">
              תאריך מתן (מהפרויקט): <span className="font-semibold text-slate-700 dark:text-slate-200">{projectGiven ? projectGiven.toLocaleDateString('he-IL') : '—'}</span>
            </p>
          </div>
        </div>
      )}

      {/* שורה 1: נושא | תג"ב */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <Label required>נושא ההנחיה</Label>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            required
            placeholder="כותרת קצרה וברורה"
            className={fieldBase}
          />
        </div>
        <div className="min-w-0">
          <Label>
            תאריך גמר ביצוע (תג״ב) <span className="font-normal text-slate-400">(אופציונלי)</span>
          </Label>
          <div className="flex items-stretch gap-2">
            <div className="min-w-0 flex-1">
              <DateField
                value={form.dueDate}
                onChange={e => set('dueDate', e.target.value)}
                id="tf-due"
              />
            </div>
            {form.dueDate && (
              <button
                type="button"
                onClick={() => set('dueDate', '')}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-semibold text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-950/30"
                title="נקה — ללא תג״ב"
              >
                ללא תג״ב
              </button>
            )}
          </div>
        </div>
      </div>

      {/* שורה 2: פירוט (כל הרוחב) */}
      <div className="min-w-0">
        <Label required>פירוט ההנחיה</Label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={4}
          placeholder="תיאור מפורט של ההנחיה…"
          className={fieldBase + ' min-h-[104px] resize-none'}
        />
      </div>

      {customColumns.length > 0 && (
        <div className="space-y-4">
          <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">שדות נוספים</p>
          {customColsPairs.map((pair, rowIdx) => (
            <div key={rowIdx} className="grid gap-4 sm:grid-cols-2">
              {pair.map(col => (
                <div key={col.id} className="min-w-0">
                  <Label>{col.label}</Label>
                  <input
                    value={form.customFields[col.id] || ''}
                    onChange={e => setCustomField(col.id, e.target.value)}
                    placeholder={`${col.label}…`}
                    className={fieldBase}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-200/90 pt-4 dark:border-slate-700">
        <p className="mb-3 text-[13px] font-bold text-slate-800 dark:text-slate-100">שיוך לצוות (רמות)</p>
        {users.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-[13px] text-slate-400 dark:border-slate-600 dark:bg-slate-900/40">
            אין משתמשים בסביבה — הוסף משתמשים כדי לבנות את רשימת הרמות
          </div>
        ) : (
          <CascadingLevelPicker
            key={pickerKey}
            users={users}
            responsibilityLevels={responsibilityLevels}
            onLevelsChange={handleLevelsChange}
            embeddedLevels={levelSnapshot}
            syncKey={initialTask?._id || 'new'}
            ui="select"
          />
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-end">
          <div className="min-w-0 sm:col-span-2">
            <Label>
              תפקיד רלוונטי <span className="font-normal text-slate-400">(אופציונלי)</span>
            </Label>
            <input
              value={form.targetRole}
              onChange={e => set('targetRole', e.target.value)}
              placeholder="למשל: ק״אג״מ · רמ״ד · תפקיד רלוונטי…"
              className={fieldBase}
            />
          </div>
        </div>

        {!isEdit && users.length > 0 && (
          <div className="mt-5 rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/30">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#c47f17]" />
                <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
                  הקצאה למספר אנשים <span className="font-normal text-slate-400">(אופציונלי)</span>
                </p>
              </div>
              {assignedToIds.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllSelected}
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-200/60 dark:hover:bg-slate-800"
                >
                  נקה בחירה
                </button>
              )}
            </div>

            <p className="mb-3 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              {assignedToIds.length === 0
                ? 'אם לא נבחר אף אחד — המערכת תשייך אוטומטית למשתמש המתאים ביותר לרמות. בחר אדם אחד או יותר כדי לשייך ישירות.'
                : `${assignedToIds.length} אנשים נבחרו — תיווצר הנחיה אחת לכל אדם (חולקות אותו תוכן ותג״ב).`}
            </p>

            <div className="mb-2 flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={peopleSearch}
                  onChange={e => setPeopleSearch(e.target.value)}
                  placeholder="חיפוש שם, מס׳ אישי, תפקיד…"
                  className={fieldBase + ' py-2 pr-9 text-[12.5px]'}
                />
              </div>
              {visiblePeople.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-[#c47f17]/40 hover:bg-amber-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  בחר את הכל ({visiblePeople.length})
                </button>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50">
              {visiblePeople.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12.5px] text-slate-400">
                  {matchingUsers.length === 0
                    ? 'אין משתמשים תואמים לרמות שנבחרו'
                    : 'אין תוצאות לחיפוש'}
                </div>
              ) : (
                visiblePeople.map(u => {
                  const checked = assignedToIds.includes(u._id);
                  return (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => togglePerson(u._id)}
                      className={clsx(
                        'flex w-full items-center gap-2.5 border-b border-slate-100 px-3 py-2 text-right text-[13px] transition last:border-0 dark:border-slate-800',
                        checked
                          ? 'bg-amber-50/60 hover:bg-amber-50/80 dark:bg-amber-950/25 dark:hover:bg-amber-950/35'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                      )}
                    >
                      <span
                        className={clsx(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                          checked
                            ? 'border-[#c47f17] bg-[#c47f17] text-white'
                            : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800',
                        )}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        {safeImageSrc(u.profileImageUrl) ? (
                          <img src={safeImageSrc(u.profileImageUrl)} alt="" className="h-full w-full object-cover" />
                        ) : (u.name || '?').charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-800 dark:text-slate-100">
                        {u.name}
                      </span>
                      {u.jobTitle && (
                        <span className="shrink-0 truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                          {u.jobTitle}
                        </span>
                      )}
                      {u.tagId && (
                        <span className="shrink-0 font-mono text-[10.5px] text-slate-400">{u.tagId}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {assignedToIds.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {assignedToIds.map(id => {
                  const u = users.find(x => x._id === id);
                  if (!u) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11.5px] font-semibold text-[#a0660e] dark:bg-amber-950/40 dark:text-amber-200"
                    >
                      {u.name}
                      <button
                        type="button"
                        onClick={() => togglePerson(id)}
                        className="rounded-full p-0.5 text-amber-700 hover:bg-amber-200/70 dark:text-amber-300 dark:hover:bg-amber-900/40"
                        aria-label="הסר"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* אזור העלאת קבצים */}
      <div className="border-t border-slate-200/90 pt-4 dark:border-slate-700">
        <p className="mb-2.5 text-[13px] font-bold text-slate-800 dark:text-slate-100">
          <Paperclip className="ml-1.5 inline-block h-3.5 w-3.5 text-slate-400" />
          קבצים מצורפים
        </p>

        {/* אזור גרירה / לחיצה */}
        <div
          className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300/90 bg-slate-50/80 p-4 text-center transition-colors hover:border-[#c47f17]/50 hover:bg-amber-50/30 dark:border-slate-600 dark:bg-slate-900/30"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <FolderOpen className="mx-auto mb-1.5 h-7 w-7 text-slate-400" />
          <p className="text-[13px] font-medium text-slate-600 dark:text-slate-400">לחץ כאן להוספת קובץ</p>
          <p className="mt-0.5 text-[11px] text-slate-400">כל סוג קובץ · עד 20MB לקובץ</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* רשימת קבצים ממתינים */}
        {pendingFiles.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {pendingFiles.map((f, i) => {
              const Icon = fileIcon(f.type);
              return (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-lg border border-amber-100/80 bg-gradient-to-l from-amber-50/40 to-white px-3 py-2 dark:border-amber-900/30 dark:from-amber-950/20 dark:to-slate-900/40"
                >
                  <Icon className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">
                    {f.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">{formatBytes(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => removePending(i)}
                    className="shrink-0 rounded p-0.5 text-slate-400 hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* קבצים קיימים (בעריכה) */}
        {isEdit && initialTask?.attachments?.length > 0 && (
          <div className="mt-2.5">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">מצורפים כבר</p>
            <div className="space-y-1.5">
              {initialTask.attachments.map(a => {
                const Icon = fileIcon(a.mimeType);
                return (
                  <div
                    key={a.filename}
                    className="flex items-center gap-2.5 rounded-lg border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                    <a
                      href={`/uploads/attachments/${a.filename}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#c47f17] underline-offset-2 hover:underline"
                    >
                      {a.originalName}
                    </a>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatBytes(a.size)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showFooterActions ? (
        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="submit"
            className="w-full rounded-lg border-2 border-[#a0660e] bg-gradient-to-l from-[#c47f17] to-[#a0660e] py-3 text-[14px] font-bold text-white shadow-md transition hover:brightness-105 sm:max-w-xs sm:shrink-0"
          >
            {submitLabel || (isEdit ? 'ערוך הנחיה' : 'הוסף הנחיה')}
          </button>
        </div>
      ) : null}
    </form>
  );
}
