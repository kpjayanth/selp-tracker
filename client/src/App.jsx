import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Programs from './pages/Programs';
import ProgramDetail from './pages/ProgramDetail';
import ParticipantDetail from './pages/ParticipantDetail';
import ImportPage from './pages/ImportPage';
import AuditPage from './pages/AuditPage';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/programs" replace />} />
          <Route path="programs" element={<Programs />} />
          <Route path="programs/:programId" element={<ProgramDetail />} />
          <Route path="programs/:programId/import" element={<ImportPage />} />
          <Route path="programs/:programId/audit" element={<AuditPage />} />
          <Route path="participants/:participantId" element={<ParticipantDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
