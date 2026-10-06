import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  PlusCircle,
  LogIn,
  BrainCircuit,
  ClipboardList,
  Clock,
  ArrowLeft,
  Activity,
  Zap,
  GitBranch,
  Search,
} from 'lucide-react';
import { api } from '../api/client';
import { PageShell, LoadingScreen, ErrorBanner } from '../components/ui/page-shell';
import { StatCard } from '../components/ui/stat-card';
import { Card, CardBody, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar } from '../components/ui/avatar';
import { ConfidenceBar } from '../components/ui/confidence-bar';
import {
  DataTable,
  DataTableHead,
  DataTableHeader,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from '../components/ui/data-table';
import { formatDate } from '../lib/utils';
import { actionLabel } from '../lib/labels';
import { AiStatusBar } from '../components/ai/AiStatusBar';
import { IngestFlowBanner } from '../components/demo/IngestFlowBanner';

const QUICK = [
  { to: '/demo-login', icon: Zap, label: 'התחברות דמו' },
  { to: '/org-tree', icon: GitBranch, label: 'תרשים ארגוני' },
  { to: '/users', icon: Search, label: 'חיפוש משתמש' },
  { to: '/reviews', icon: ClipboardList, label: 'מרכז ביקורת' },
];

export function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboardStats,
    refetchInterval: 15000,
  });

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorBanner message={(error as Error).message} />;
  if (!data) return null;

  return (
    <PageShell
      title="לוח בקרה"
      description="מבט-על על משתמשים, עץ ארגוני והחלטות AI."
    >
      <div className="mb-6 space-y-4">
        <AiStatusBar />
        <IngestFlowBanner />
      </div>

      {data.pendingReviews > 0 && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[13px] font-medium text-amber-900">
            {data.pendingReviews} פריטים ממתינים לביקורת
          </p>
          <Link to="/reviews">
            <Button variant="outline" size="sm">
              לטיפול
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="משתמשים" value={data.totalUsers} icon={Users} />
        <StatCard label="יחידות" value={data.totalOrgUnits} icon={Building2} />
        <StatCard label="חדשות היום" value={data.orgUnitsToday} icon={PlusCircle} />
        <StatCard label="התחברויות" value={data.loginsToday} icon={LogIn} />
        <StatCard label="החלטות AI" value={data.aiDecisionsToday} icon={BrainCircuit} />
        <StatCard label="ביקורות" value={data.pendingReviews} icon={ClipboardList} />
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {QUICK.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to}>
            <Button variant="secondary" size="sm">
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={Activity}
            title="התחברויות אחרונות"
            action={
              <Link to="/demo-login">
                <Button variant="ghost" size="sm">
                  הכל
                </Button>
              </Link>
            }
          />
          <CardBody className="!p-0">
            <DataTable>
              <DataTableHead>
                <DataTableHeader>משתמש</DataTableHeader>
                <DataTableHeader>זמן</DataTableHeader>
              </DataTableHead>
              <DataTableBody>
                {data.recentLogins.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-5 py-12 text-center text-[13px] text-slate-500">
                      <Link to="/demo-login" className="font-semibold text-accent hover:underline">
                        הרץ התחברות דמו
                      </Link>
                    </td>
                  </tr>
                ) : (
                  data.recentLogins.map((l, i) => (
                    <DataTableRow key={i}>
                      <DataTableCell>
                        <div className="flex items-center gap-2">
                          <Avatar name={`${l.firstName} ${l.lastName}`} imageUrl={l.profileImageUrl} size="sm" />
                          <div>
                            <p className="font-medium text-slate-900">
                              {l.firstName} {l.lastName}
                            </p>
                            <p className="font-mono text-[10px] text-slate-500">{l.personalNumber}</p>
                          </div>
                        </div>
                      </DataTableCell>
                      <DataTableCell mono className="text-slate-400">
                        <Clock className="ml-1 inline h-3 w-3" />
                        {formatDate(l.createdAt)}
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={BrainCircuit}
            title="החלטות AI אחרונות"
            action={
              <Link to="/ai-decisions">
                <Button variant="ghost" size="sm">
                  הכל
                </Button>
              </Link>
            }
          />
          <CardBody className="!p-0">
            <DataTable>
              <DataTableHead>
                <DataTableHeader>ערך</DataTableHeader>
                <DataTableHeader>ביטחון</DataTableHeader>
              </DataTableHead>
              <DataTableBody>
                {data.recentDecisions.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-5 py-12 text-center text-[13px] text-slate-500">
                      אין החלטות עדיין
                    </td>
                  </tr>
                ) : (
                  data.recentDecisions.map((d) => (
                    <DataTableRow key={d._id}>
                      <DataTableCell>
                        <p className="font-medium text-slate-900">{d.rawValue}</p>
                        <p className="text-[11px] text-slate-500">{actionLabel(d.action)}</p>
                      </DataTableCell>
                      <DataTableCell>
                        <ConfidenceBar value={d.confidence} className="min-w-[100px]" />
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}
