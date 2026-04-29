import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  LayoutDashboard, CheckSquare, Bell,
  LogOut, User, Settings, Search, Calendar
} from 'lucide-react';
import NotificationPanel from './NotificationPanel';
import SearchPanel from './SearchPanel';
import CalendarPanel from './CalendarPanel';
import ThemeToggle from './ThemeToggle';
import api from '../../services/api';
import styles from './DirectorLayout.module.css';

const navItems = [
  { path: '/director/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/director/tasks',      label: 'My Tasks',   icon: CheckSquare },
  { path: '/director/reminders',  label: 'Reminders',  icon: Bell },
  { path: '/director/approvals',  label: 'Approvals',  icon: CheckSquare },
];

const DirectorLayout = () => {
  const { user, logout } = useAuth();
  const { notifications } = useNotifications();
  const [showUserMenu, setShowUserMenu]           = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch]               = useState(false);
  const [showCalendar, setShowCalendar]           = useState(false);
  const [calendarEvents, setCalendarEvents]       = useState([]);
  const navigate = useNavigate();

  const fetchCalendarEvents = useCallback(async () => {
    try {
      const res = await api.get('/events');
      setCalendarEvents(res.data || []);
    } catch {
      setCalendarEvents([]);
    }
  }, []);

  useEffect(() => { fetchCalendarEvents(); }, [fetchCalendarEvents]);

  // Ctrl+K shortcut
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

  const handleLogout = () => { logout(); navigate('/login'); };

  // Director-only notifications: tasks, reminders, approvals
  const directorNotifs = notifications.filter(n =>
    ['task', 'reminder', 'approval', 'event'].includes(n.type)
  );

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {/* Brand */}
          <div className={styles.brand}>
            <div className={styles.logoIcon}>DC</div>
            <div>
              <span className={styles.brandName}>DirectorControl</span>
              <span className={styles.rolePill}>Director</span>
            </div>
          </div>

          {/* Nav */}
          <nav className={styles.nav}>
            {navItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                }
              >
                <Icon size={15} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className={styles.headerRight}>
          {/* Search */}
          <button
            className={`${styles.iconBtn} ${showSearch ? styles.iconBtnActive : ''}`}
            aria-label="Search"
            onClick={() => { setShowSearch(true); setShowNotifications(false); setShowUserMenu(false); setShowCalendar(false); }}
            title="Search (Ctrl+K)"
          >
            <Search size={17} />
          </button>
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
                if (!showCalendar) fetchCalendarEvents();
              }}
              title="Calendar"
            >
              <Calendar size={17} />
            </button>
            {showCalendar && (
              <CalendarPanel
                onClose={() => setShowCalendar(false)}
                events={calendarEvents}
              />
            )}
          </div>

          {/* Theme */}
          <ThemeToggle />

          {/* Notifications */}
          <div className={styles.notifWrapper}>
            <button
              className={`${styles.iconBtn} ${showNotifications ? styles.iconBtnActive : ''}`}
              aria-label="Notifications"
              onClick={() => { setShowNotifications(v => !v); setShowUserMenu(false); setShowSearch(false); }}
            >
              <Bell size={17} />
              {directorNotifs.length > 0 && (
                <span className={styles.notifBadge}>
                  {directorNotifs.length > 9 ? '9+' : directorNotifs.length}
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
                  <div className={styles.userInfoRole}>Director</div>
                  <div className={styles.userInfoEmail}>{user?.email}</div>
                </div>
                <hr className={styles.divider} />
                <button className={styles.dropdownItem} onClick={() => { setShowUserMenu(false); navigate('/director/profile'); }}>
                  <User size={14} /> Profile
                </button>
                <button className={styles.dropdownItem} onClick={() => { setShowUserMenu(false); navigate('/director/settings'); }}>
                  <Settings size={14} /> Settings
                </button>
                <hr className={styles.divider} />
                <button className={`${styles.dropdownItem} ${styles.logoutItem}`} onClick={handleLogout}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
};

export default DirectorLayout;
