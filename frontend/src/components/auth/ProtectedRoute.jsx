// =====================================================
// 9. src/components/auth/ProtectedRoute.jsx
// =====================================================

import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
