import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDirector } from '../../context/DirectorContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  LayoutDashboard, CheckSquare, Bell, Search,
  Settings, LogOut, ChevronDown, User,
  Plane, FileText, Receipt, Package, Calendar, Users
} from 'lucide-react';
import NotificationPanel from './NotificationPanel';
import SearchPanel from './SearchPanel';
import CalendarPanel from './CalendarPanel';
import ThemeToggle from './ThemeToggle';
import api from '../../services/api';
import styles from './DashboardLayout.module.css';

const navItems = [
  { path: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { path: '/tasks',        label: 'Tasks',        icon: CheckSquare },
  { path: '/travel',       label: 'Travel',       icon: Plane },
  { path: '/documents',    label: 'Documents',    icon: FileText },
  { path: '/bills',        label: 'Bills',        icon: Receipt },
  { path: '/assets',       label: 'Assets',       icon: Package },
  { path: '/events',       label: 'Events',       icon: Calendar },
  { path: '/family-tree',  label: 'Family Tree',  icon: Users },
];

const DashboardLayout = () => {
  const { user, logout, isAdmin } = useAuth();
  const { directors, selectedDirector, setSelectedDirector, activeDirectorId } = useDirector();
  const { notifications } = useNotifications();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showDirectorDropdown, setShowDirectorDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarData, setCalendarData] = useState({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch all 7 data sources for the calendar panel
  const fetchCalendarData = useCallback(async () => {
    if (!activeDirectorId) return;
    setCalendarLoading(true);
    try {
      const p = { directorId: activeDirectorId };
      const [events, tasks, reminders, travel, approvals, emails, meetings] =
        await Promise.allSettled([
          api.get('/events',    { params: p }),
          api.get('/tasks',     { params: p }),
          api.get('/reminders', { params: p }),
          api.get('/travel',    { params: p }),
          api.get('/approvals', { params: p }),
          api.get('/emails',    { params: p }),
          api.get('/meetings',  { params: p }),
        ]);
      setCalendarData({
        events:    events.status    === 'fulfilled' ? events.value.data    : [],
        tasks:     tasks.status     === 'fulfilled' ? tasks.value.data     : [],
        reminders: reminders.status === 'fulfilled' ? reminders.value.data : [],
        travel:    travel.status    === 'fulfilled' ? travel.value.data    : [],
        approvals: approvals.status === 'fulfilled' ? approvals.value.data : [],
        emails:    emails.status    === 'fulfilled' ? emails.value.data    : [],
        meetings:  meetings.status  === 'fulfilled' ? meetings.value.data  : [],
      });
    } catch {
      setCalendarData({});
    } finally {
      setCalendarLoading(false);
    }
  }, [activeDirectorId]);

  useEffect(() => { fetchCalendarData(); }, [fetchCalendarData]);

  // Global keyboard shortcut: Ctrl+K or Cmd+K opens search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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
          <button
            className={`${styles.iconBtn} ${showSearch ? styles.iconBtnActive : ''}`}
            aria-label="Search (Ctrl+K)"
            onClick={() => { setShowSearch(true); setShowNotifications(false); setShowUserMenu(false); setShowCalendar(false); }}
            title="Search (Ctrl+K)"
          >
            <Search size={18} />
          </button>

          {/* Search Panel */}
          {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}

          {/* Calendar */}
          <div className={styles.calendarWrapper}>
            <button
              className={`${styles.iconBtn} ${showCalendar ? styles.iconBtnActive : ''}`}
              aria-label="Calendar"
              onClick={() => {
                setShowCalendar(v => !v);
                setShowNotifications(false);
                setShowUserMenu(false);
                setShowSearch(false);
                if (!showCalendar) fetchCalendarData();
              }}
              title="Calendar"
            >
              <Calendar size={18} />
            </button>
            {showCalendar && (
              <CalendarPanel
                onClose={() => setShowCalendar(false)}
                data={calendarData}
                loading={calendarLoading}
                directorName={selectedDirector?.name || ''}
              />
            )}
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <div className={styles.notifWrapper}>
            <button
              className={`${styles.iconBtn} ${showNotifications ? styles.iconBtnActive : ''}`}
              aria-label="Notifications"
              onClick={() => { setShowNotifications(v => !v); setShowUserMenu(false); setShowSearch(false); }}
            >
              <Bell size={18} />
              {notifications.length > 0 && (
                <span className={styles.notifBadge}>
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>
            {showNotifications && (
              <NotificationPanel onClose={() => setShowNotifications(false)} />
            )}
          </div>

          {/* User Menu */}
          <div className={styles.userMenu}>
            <button
              className={styles.userBtn}
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); setShowSearch(false); }}
              aria-label="User menu"
            >
              {user?.avatarPhoto ? (
                <img src={user.avatarPhoto} alt={user.name} className={styles.userAvatarPhoto} />
              ) : (
                <div
                  className={styles.userAvatar}
                  style={user?.avatarColor ? { background: user.avatarColor } : {}}
                >
                  {user?.avatar || user?.name?.[0]}
                </div>
              )}
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
                <button className={styles.userDropdownItem} onClick={() => { setShowUserMenu(false); navigate('/profile'); }}>
                  <User size={15} /> Profile
                </button>
                <button className={styles.userDropdownItem} onClick={() => { setShowUserMenu(false); navigate('/settings'); }}>
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
