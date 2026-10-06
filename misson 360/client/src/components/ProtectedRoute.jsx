import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-md mx-auto mb-4">
          <svg className="h-7 w-7 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0 1 0 20" /><path d="M2 12h20" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">טוען...</p>
      </div>
    </div>
  );

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center bg-white p-8 rounded-xl shadow border border-gray-200">
        <p className="text-gray-600 font-medium mb-4">לא ניתן להתחבר לשרת</p>
        <button onClick={() => window.location.reload()} className="px-5 py-2 bg-teal-500 text-white text-sm rounded-lg hover:bg-teal-600">נסה שוב</button>
      </div>
    </div>
  );

  return children;
}
