import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminPage from './pages/AdminPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProtectedRoute from './components/ProtectedRoute';

/**
 * RootRedirect
 *
 * אם יש טוקן תקף → מפנה לפי תפקיד
 * אם אין → מחכה לחוגר (לא מנסה להתחבר אוטומטית)
 */
function RootRedirect() {
  const { user, loading, isSuperAdmin, envPermissions } = useAuth();

  if (loading) return <Spinner />;

  if (!user) return <WaitingForTag />;

  if (isSuperAdmin) return <Navigate to="/admin" replace />;
  if (envPermissions.some(p => p.type === 'manager')) return <Navigate to="/admin" replace />;
  return <Navigate to="/admin/my-tasks" replace />;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="text-center">
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-5"
          style={{ background: 'linear-gradient(135deg, #c47f17, #a0660e)' }}>
          <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0 1 0 20" /><path d="M2 12h20" />
          </svg>
        </div>
        <p className="text-slate-500 text-[14px]">טוען...</p>
      </div>
    </div>
  );
}

function WaitingForTag() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="text-center">
        <div className="h-20 w-20 rounded-3xl flex items-center justify-center shadow-xl mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg, #c47f17, #a0660e)' }}>
          <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-slate-800 mb-2">MISSIONS 360</h1>
        <p className="text-[15px] text-slate-500">אין הרשאת גישה למערכת</p>
        <p className="text-[12px] text-slate-400 mt-1">
          פנה למנהל המערכת לרישום
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/admin/*"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/commander" element={<Navigate to="/admin/my-tasks" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
