import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './shell/AppShell';
import { DemoAuthProvider, useDemoAuth } from './auth/DemoAuth';
import { HomePage } from './pages/HomePage';
import { IngestPage } from './pages/IngestPage';
import { OrgTreePage } from './pages/OrgTreePage';
import { UsersPage } from './pages/UsersPage';
import { AiPage } from './pages/AiPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { ApiDocsPage } from './pages/ApiDocsPage';

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5000, retry: 1, refetchOnWindowFocus: false },
  },
});

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useDemoAuth();
  return isAdmin ? <>{children}</> : <Navigate to="/org-tree" replace />;
}

function StartPage() {
  const { isAdmin } = useDemoAuth();
  return isAdmin ? <HomePage /> : <Navigate to="/org-tree" replace />;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { loading, authError, actor, refreshFromSharePoint } = useDemoAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-xl bg-brand-soft" />
          <p className="text-sm font-medium text-foreground">מזהה משתמש מ-SharePoint...</p>
          <p className="mt-1 text-xs text-muted">GetMyProperties / currentUser</p>
        </div>
      </div>
    );
  }

  if (!actor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
          <p className="text-base font-semibold text-foreground">לא זוהה משתמש</p>
          <p className="mt-2 text-sm text-muted">{authError || 'יש להיכנס דרך SharePoint'}</p>
          <button
            type="button"
            onClick={() => void refreshFromSharePoint()}
            className="mt-4 rounded-xl bg-brand-soft px-4 py-2 text-sm font-medium text-brand-text"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <DemoAuthProvider>
        <AuthGate>
          <BrowserRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<StartPage />} />
                <Route path="ingest" element={<AdminOnly><IngestPage /></AdminOnly>} />
                <Route path="demo-login" element={<AdminOnly><IngestPage /></AdminOnly>} />
                <Route path="org-tree" element={<OrgTreePage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="ai" element={<AdminOnly><AiPage /></AdminOnly>} />
                <Route path="ai-decisions" element={<AdminOnly><AiPage /></AdminOnly>} />
                <Route path="reviews" element={<AdminOnly><ReviewsPage /></AdminOnly>} />
                <Route path="docs-api" element={<AdminOnly><ApiDocsPage /></AdminOnly>} />
                <Route path="api-docs" element={<AdminOnly><ApiDocsPage /></AdminOnly>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthGate>
      </DemoAuthProvider>
    </QueryClientProvider>
  );
}
