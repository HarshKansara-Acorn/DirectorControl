import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDirector } from '../../context/DirectorContext';
import {
  LayoutDashboard, CheckSquare, Bell, Search,
  Settings, LogOut, ChevronDown, User
} from 'lucide-react';
import styles from './DashboardLayout.module.css';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
];

const DashboardLayout = () => {
  const { user, logout, isAdmin } = useAuth();
  const { directors, selectedDirector, setSelectedDirector } = useDirector();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showDirectorDropdown, setShowDirectorDropdown] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).toUpperCase();

  return (
    <div className={styles.layout}>
      {/* Top Navigation Bar */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {/* Brand */}
          <div className={styles.brand}>
            <div className={styles.logoIcon}>DC</div>
            <span className={styles.brandName}>DirectorControl</span>
          </div>

          {/* Nav Links */}
          <nav className={styles.nav}>
            {navItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                }
              >
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className={styles.headerRight}>
          {/* Director Switcher (Admin only) */}
          {isAdmin && directors.length > 0 && (
            <div className={styles.directorSwitcher}>
              <button
                className={styles.directorBtn}
                onClick={() => setShowDirectorDropdown(!showDirectorDropdown)}
              >
                <div className={styles.directorAvatar}>
                  {selectedDirector?.avatar || 'D'}
                </div>
                <span className={styles.directorName}>
                  {selectedDirector?.name || 'Select Director'}
                </span>
                <ChevronDown size={14} />
              </button>

              {showDirectorDropdown && (
                <div className={styles.dropdown}>
                  {directors.map((d) => (
                    <button
                      key={d.id}
                      className={`${styles.dropdownItem} ${selectedDirector?.id === d.id ? styles.dropdownItemActive : ''}`}
                      onClick={() => {
                        setSelectedDirector(d);
                        setShowDirectorDropdown(false);
                      }}
                    >
                      <div className={styles.dropdownAvatar}>{d.avatar}</div>
                      <div>
                        <div className={styles.dropdownName}>{d.name}</div>
                        <div className={styles.dropdownTitle}>{d.title}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search */}
          <button className={styles.iconBtn} aria-label="Search">
            <Search size={18} />
          </button>

          {/* Notifications */}
          <button className={styles.iconBtn} aria-label="Notifications">
            <Bell size={18} />
            <span className={styles.notifBadge}>3</span>
          </button>

          {/* User Menu */}
          <div className={styles.userMenu}>
            <button
              className={styles.userBtn}
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="User menu"
            >
              <div className={styles.userAvatar}>{user?.avatar || user?.name?.[0]}</div>
            </button>

            {showUserMenu && (
              <div className={styles.userDropdown}>
                <div className={styles.userInfo}>
                  <div className={styles.userInfoName}>{user?.name}</div>
                  <div className={styles.userInfoRole}>
                    {user?.role === 'admin' ? 'Personal Assistant' : 'Director'}
                  </div>
                </div>
                <hr className={styles.divider} />
                <button className={styles.userDropdownItem}>
                  <User size={15} /> Profile
                </button>
                <button className={styles.userDropdownItem}>
                  <Settings size={15} /> Settings
                </button>
                <hr className={styles.divider} />
                <button
                  className={`${styles.userDropdownItem} ${styles.logoutItem}`}
                  onClick={handleLogout}
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
