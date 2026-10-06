import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Building2,
  LogIn,
  ClipboardCheck,
  PlusCircle,
  Tags,
  ArrowLeft,
  BrainCircuit,
} from 'lucide-react';
import { api } from '../api/client';
import { Page, Spinner, StatCard, Panel, Button, Alert, Badge, Table, Th, Td, Tr } from '../ui/primitives';
import { actionLabel } from '../lib/labels';
import { formatDate } from '../lib/utils';

export function HomePage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboardStats,
    refetchInterval: 15000,
  });

  const { data: aiStatus } = useQuery({
    queryKey: ['aiStatus'],
    queryFn: api.aiStatus,
  });

  if (isLoading) return <Spinner />;
  if (error) return <Alert>{(error as Error).message}</Alert>;
  if (!data) return null;

  const aiActive = aiStatus?.connected ?? aiStatus?.ready;

  return (
    <Page
      title="לוח בקרה"
      description="סקירה מהירה של פעילות המערכת — משתמשים, עץ ארגוני והחלטות AI."
      actions={
        <Link to="/ingest">
          <Button><LogIn className="h-4 w-4" />התחברות חדשה</Button>
        </Link>
      }
    >
      {data.pendingReviews > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-soft px-5 py-4">
          <p className="text-sm text-warning-text">
            <span className="font-semibold">{data.pendingReviews}</span> פריטים ממתינים לביקורת
          </p>
          <Link to="/reviews">
            <Button variant="secondary" size="sm">
              לטיפול <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="משתמשים" value={data.totalUsers} icon={Users} />
        <StatCard label="יחידות" value={data.totalOrgUnits} icon={Building2} />
        <StatCard label="כינויים" value={data.totalAliases ?? 0} icon={Tags} />
        <StatCard label="יחידות היום" value={data.orgUnitsToday} icon={PlusCircle} />
        <StatCard label="התחברויות היום" value={data.loginsToday} icon={LogIn} />
        <StatCard label="ביקורות פתוחות" value={data.pendingReviews} icon={ClipboardCheck} />
      </div>

      {aiStatus && (
        <div className="mb-8 flex items-center gap-4 rounded-2xl bg-surface px-5 py-4 shadow-[var(--shadow-card)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div className="flex-1 text-sm">
            <span className="font-medium">{aiStatus.provider}</span>
            <span className="text-subtle"> · </span>
            <span className="text-muted">{aiStatus.message}</span>
          </div>
          <Badge variant={aiActive ? 'success' : 'default'}>{aiActive ? 'פעיל' : 'לא מחובר'}</Badge>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="פעילות ingest אחרונה"
          action={<Link to="/ingest" className="text-sm font-medium text-brand-text hover:underline">הרצה חדשה</Link>}
        >
          {data.recentLogins.length === 0 ? (
            <p className="px-6 pb-8 text-center text-sm text-muted">אין התחברויות עדיין</p>
          ) : (
            <div className="px-2 pb-2">
              <Table>
                <thead>
                  <tr><Th>משתמש</Th><Th>תוצאה</Th><Th>זמן</Th></tr>
                </thead>
                <tbody>
                  {data.recentLogins.map((l, i) => (
                    <Tr key={i} onClick={() => navigate(`/users?pn=${encodeURIComponent(l.personalNumber)}`)}>
                      <Td>
                        <span className="font-medium">{l.firstName} {l.lastName}</span>
                        <span className="mt-0.5 block font-mono text-xs text-subtle">{l.personalNumber}</span>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {l.created ? <Badge variant="accent">חדש</Badge> : <Badge>עודכן</Badge>}
                          {(l.newOrgUnits ?? 0) > 0 && <Badge variant="warning">+{l.newOrgUnits}</Badge>}
                        </div>
                      </Td>
                      <Td className="text-xs text-muted">{formatDate(l.createdAt)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Panel>

        <Panel
          title="החלטות AI אחרונות"
          action={<Link to="/ai" className="text-sm font-medium text-brand-text hover:underline">הכל</Link>}
        >
          {data.recentDecisions.length === 0 ? (
            <p className="px-6 pb-8 text-center text-sm text-muted">אין החלטות עדיין</p>
          ) : (
            <div className="px-2 pb-2">
              <Table>
                <thead>
                  <tr><Th>ערך</Th><Th>פעולה</Th><Th>ביטחון</Th></tr>
                </thead>
                <tbody>
                  {data.recentDecisions.slice(0, 8).map((d) => (
                    <Tr key={d._id} onClick={() => navigate('/ai')}>
                      <Td className="font-medium">{d.rawValue}</Td>
                      <Td className="text-muted">{actionLabel(d.action)}</Td>
                      <Td><Badge>{Math.round(d.confidence * 100)}%</Badge></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Panel>
      </div>
    </Page>
  );
}
