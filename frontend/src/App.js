import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DirectorProvider } from './context/DirectorContext';
import { NotificationProvider } from './context/NotificationContext';
import { SearchProvider } from './context/SearchContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Travel from './pages/Travel';
import Documents from './pages/Documents';
import Bills from './pages/Bills';
import Assets from './pages/Assets';
import Events from './pages/Events';
import Teams from './pages/Teams';
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
              <Route
                path="/"
                element={
                  <ProtectedRoute>
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
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
