import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Route,
  AlertTriangle,
  UserPlus,
  History,
  ArrowLeft,
  PlusCircle,
} from 'lucide-react';
import type { LoginResult } from '../../api/client';
import { Card, CardBody } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { PathBreadcrumb } from '../ui/path-breadcrumb';
import { ConfidenceBar } from '../ui/confidence-bar';
import { Avatar } from '../ui/avatar';
import { actionLabel, confidenceVariant } from '../../lib/labels';
import { cn } from '../../lib/utils';

export function LoginResultEmpty() {
  return (
    <Card className="border-dashed">
      <CardBody className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
          <Route className="h-6 w-6 text-slate-400" />
        </div>
        <p className="font-semibold text-slate-800">בחר משתמש והתחבר</p>
        <p className="mt-1 max-w-[220px] text-[13px] text-slate-500">
          התוצאה תופיע כאן — פירוק, התאמות AI, ועדכון העץ
        </p>
      </CardBody>
    </Card>
  );
}

export function LoginResultPanel({ result }: { result: LoginResult }) {
  const createdUnits = result.decisions.filter((d) => d.created).length;
  const matchedExisting = createdUnits === 0;
  const leafUnitId = result.pathIds?.[result.pathIds.length - 1];
  const treeLink = leafUnitId ? `/org-tree?unit=${leafUnitId}` : '/org-tree';

  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <Avatar name={result.user.fullName} imageUrl={result.user.profileImageUrl} size="md" />
          <div>
            <p className="font-semibold text-slate-900">
              <CheckCircle2 className="ml-1 inline h-4 w-4 text-accent" />
              התחברות הושלמה
            </p>
            <p className="mt-0.5 text-[13px] text-slate-600">
              {result.user.fullName}
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="font-mono text-[12px]">{result.user.personalNumber}</span>
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {result.user.created && (
            <Badge variant="info">
              <UserPlus className="ml-1 h-3 w-3" />
              משתמש חדש
            </Badge>
          )}
          {matchedExisting ? (
            <Badge variant="success">הותאם לעץ קיים</Badge>
          ) : (
            <Badge variant="warning">
              <PlusCircle className="ml-1 h-3 w-3" />
              {createdUnits} יחידות חדשות
            </Badge>
          )}
          {result.orgHistoryCreated && (
            <Badge variant="default">
              <History className="ml-1 h-3 w-3" />
              מעבר ארגוני
            </Badge>
          )}
          {result.ai.needsReview && (
            <Badge variant="warning">{result.reviewIds.length} לביקורת</Badge>
          )}
        </div>
      </div>

      <CardBody className="space-y-5">
        {matchedExisting ? (
          <p className="rounded-lg bg-accent-soft px-3 py-2 text-[12px] text-accent">
            כל הקטעים הותאמו ליחידות קיימות. המשתמש נשמר והעץ עודכן.
          </p>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            נוצרו יחידות חדשות — המערכת מרחיבה את העץ אוטומטית מנתיבים לא מוכרים.
          </p>
        )}

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            נתיב מפורק
          </p>
          <PathBreadcrumb segments={result.parsed.segments} />
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600">
            {result.pathText}
          </p>
        </section>

        {result.parsed.suspectedMissingLevel && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>חשד לרמה חסרה בהיררכיה — לא נוצרה רמה מדומה</span>
          </div>
        )}

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            החלטות לפי קטע
          </p>
          <ul className="space-y-2">
            {result.decisions.map((d, i) => (
              <li
                key={i}
                className={cn(
                  'rounded-lg border border-slate-100 px-3 py-2.5',
                  d.created && 'border-r-2 border-r-amber-400'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-medium text-slate-900">{d.segment}</p>
                    <p className="text-[11px] text-slate-500">{actionLabel(d.action)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {d.created && (
                      <span className="text-[10px] font-semibold text-amber-700">חדש</span>
                    )}
                    <Badge variant={confidenceVariant(d.confidence)} className="font-mono text-[10px]">
                      {Math.round(d.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
                <ConfidenceBar value={d.confidence} className="mt-2 h-1" />
              </li>
            ))}
          </ul>
        </section>

        <div className="flex gap-2 border-t border-slate-100 pt-4">
          <Link to={treeLink} className="flex-1">
            <Button variant="primary" className="w-full" size="sm">
              {leafUnitId ? 'ראה בעץ' : 'תרשים ארגוני'}
            </Button>
          </Link>
          <Link to="/ai-decisions" className="flex-1">
            <Button variant="secondary" className="w-full" size="sm">
              יומן AI
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
