import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DirectorProvider } from './context/DirectorContext';
import { NotificationProvider } from './context/NotificationContext';
import { SearchProvider } from './context/SearchContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardLayout from './components/layout/DashboardLayout';
import DirectorLayout from './components/layout/DirectorLayout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Travel from './pages/Travel';
import Documents from './pages/Documents';
import Bills from './pages/Bills';
import Assets from './pages/Assets';
import Events from './pages/Events';
import Teams from './pages/Teams';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import DirectorDashboard from './pages/director/DirectorDashboard';
import DirectorTasks from './pages/director/DirectorTasks';
import DirectorReminders from './pages/director/DirectorReminders';
import DirectorApprovals from './pages/director/DirectorApprovals';
import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <DirectorProvider>
        <NotificationProvider>
          <SearchProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* ── Admin / PA Routes ── */}
              <Route
                path="/"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="travel" element={<Travel />} />
                <Route path="documents" element={<Documents />} />
                <Route path="bills" element={<Bills />} />
                <Route path="assets" element={<Assets />} />
                <Route path="events" element={<Events />} />
                <Route path="teams" element={<Teams />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              {/* ── Director Routes ── */}
              <Route
                path="/director"
                element={
                  <ProtectedRoute requiredRole="director">
                    <DirectorLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/director/dashboard" replace />} />
                <Route path="dashboard"  element={<DirectorDashboard />} />
                <Route path="tasks"      element={<DirectorTasks />} />
                <Route path="reminders"  element={<DirectorReminders />} />
                <Route path="approvals"  element={<DirectorApprovals />} />
                <Route path="profile"    element={<Profile />} />
                <Route path="settings"   element={<Settings />} />
              </Route>

              {/* Catch-all: redirect based on role handled by login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
          </SearchProvider>
        </NotificationProvider>
      </DirectorProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
