import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute — redirects to login if not authenticated.
 * requiredRole: 'admin' | 'director' | undefined (any authenticated user)
 */
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-app)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginTop: 12, fontSize: 14 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Role guard
  if (requiredRole && user.role !== requiredRole) {
    // Director trying to access admin routes → send to director portal
    if (user.role === 'director') return <Navigate to="/director/dashboard" replace />;
    // Admin trying to access director routes → send to admin dashboard
    if (user.role === 'admin') return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
