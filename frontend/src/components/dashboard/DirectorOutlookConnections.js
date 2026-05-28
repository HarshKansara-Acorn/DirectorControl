import React, { useState, useEffect, useCallback } from 'react';
import { useDirector } from '../../context/DirectorContext';
import api from '../../services/api';
import DashboardCard from './DashboardCard';
import styles from './DirectorOutlookConnections.module.css';
import { CheckCircle2, Link2, RefreshCcw, XCircle, Calendar } from 'lucide-react';

const DirectorOutlookConnections = () => {
  const { directors } = useDirector();
  const [statuses, setStatuses]   = useState({});
  const [loading, setLoading]     = useState(true);
  const [feedback, setFeedback]   = useState({});
  const [syncing, setSyncing]     = useState({});
  const [successMsg, setSuccessMsg] = useState('');

  const fetchStatuses = useCallback(async () => {
    if (!directors.length) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        directors.map(d =>
          api.get(`/admin/director/${d.id}/outlook-status`)
            .then(res => ({ id: d.id, data: res.data }))
            .catch(() => ({ id: d.id, data: { connected: false, configured: true } }))
        )
      );
      const next = {};
      results.forEach(r => { next[r.id] = r.data; });
      setStatuses(next);
    } catch (err) {
      console.error('Failed to load Outlook statuses:', err);
    } finally {
      setLoading(false);
    }
  }, [directors]);

  // On mount: check if we just returned from Outlook OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('outlookConnected') === 'true') {
      setSuccessMsg('✅ Outlook connected successfully! Events will now sync automatically.');
      // Clean URL
      window.history.replaceState({}, '', '/admin-dashboard');
      // Refresh statuses after a short delay to let DB settle
      setTimeout(() => fetchStatuses(), 1000);
    }
    if (params.get('outlookError')) {
      setSuccessMsg(`❌ ${decodeURIComponent(params.get('outlookError'))}`);
      window.history.replaceState({}, '', '/admin-dashboard');
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (directors.length > 0) fetchStatuses();
  }, [directors, fetchStatuses]);

  const handleConnect = async (directorId) => {
    setFeedback(prev => ({ ...prev, [directorId]: 'Redirecting to Microsoft login...' }));
    try {
      const res = await api.post(`/admin/director/${directorId}/connect-outlook`);
      const authUrl = res.data.authUrl;
      if (!authUrl) {
        setFeedback(prev => ({ ...prev, [directorId]: '❌ Failed to generate Outlook connection link' }));
        return;
      }
      // Redirect current window — Microsoft will redirect back to admin-dashboard after auth
      window.location.href = authUrl;
    } catch (err) {
      setFeedback(prev => ({
        ...prev,
        [directorId]: err.response?.data?.message || '❌ Failed to start Outlook connection'
      }));
    }
  };

  const handleDisconnect = async (directorId) => {
    setFeedback(prev => ({ ...prev, [directorId]: 'Disconnecting...' }));
    try {
      await api.post(`/admin/director/${directorId}/disconnect-outlook`);
      await fetchStatuses();
      setFeedback(prev => ({ ...prev, [directorId]: '✅ Outlook disconnected.' }));
      setTimeout(() => setFeedback(prev => ({ ...prev, [directorId]: '' })), 3000);
    } catch (err) {
      setFeedback(prev => ({
        ...prev,
        [directorId]: err.response?.data?.message || '❌ Failed to disconnect'
      }));
    }
  };

  const handleSyncNow = async (directorId) => {
    setSyncing(prev => ({ ...prev, [directorId]: true }));
    setFeedback(prev => ({ ...prev, [directorId]: 'Syncing Outlook calendar...' }));
    try {
      const res = await api.get('/teams/auto-sync', { params: { directorId } });
      const msg = res.data.synced
        ? `✅ Synced — ${res.data.added} new, ${res.data.updated} updated`
        : '⚠️ Sync skipped (not connected)';
      setFeedback(prev => ({ ...prev, [directorId]: msg }));
      setTimeout(() => setFeedback(prev => ({ ...prev, [directorId]: '' })), 4000);
    } catch (err) {
      setFeedback(prev => ({ ...prev, [directorId]: '❌ Sync failed' }));
    } finally {
      setSyncing(prev => ({ ...prev, [directorId]: false }));
    }
  };

  return (
    <DashboardCard
      icon="📧"
      title="Director Outlook Connections"
      badge={directors.length}
      badgeColor="purple"
      onAdd={fetchStatuses}
      addLabel="Refresh"
    >
      {/* Success/error message after OAuth redirect */}
      {successMsg && (
        <div className={`${styles.globalMsg} ${successMsg.startsWith('✅') ? styles.globalMsgSuccess : styles.globalMsgError}`}>
          {successMsg}
        </div>
      )}

      <div className={styles.list}>
        {directors.length === 0 ? (
          <div className={styles.empty}>No directors available</div>
        ) : loading ? (
          <div className={styles.loading}>Loading connection status...</div>
        ) : (
          directors.map(director => {
            const status = statuses[director.id] || {};
            const connected = status.connected;
            return (
              <div key={director.id} className={styles.row}>
                <div className={styles.userInfo}>
                  <div className={styles.name}>{director.name}</div>
                  <div className={styles.meta}>
                    {connected ? (
                      <span className={styles.statusConnected}>
                        <CheckCircle2 size={14} /> Connected
                        {status.msUserEmail && <span className={styles.email}> · {status.msUserEmail}</span>}
                      </span>
                    ) : status.configured === false ? (
                      <span className={styles.statusError}><XCircle size={14} /> Azure AD not configured</span>
                    ) : (
                      <span className={styles.statusPending}><Link2 size={14} /> Not connected</span>
                    )}
                  </div>
                </div>

                <div className={styles.actions}>
                  {connected ? (
                    <>
                      <button
                        className={styles.syncBtn}
                        onClick={() => handleSyncNow(director.id)}
                        disabled={syncing[director.id]}
                        title="Sync Outlook calendar now"
                      >
                        <Calendar size={13} />
                        {syncing[director.id] ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <button
                        className={styles.disconnectBtn}
                        onClick={() => handleDisconnect(director.id)}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      className={styles.connectBtn}
                      onClick={() => handleConnect(director.id)}
                    >
                      Connect Outlook
                    </button>
                  )}
                </div>

                {feedback[director.id] && (
                  <div className={`${styles.feedback} ${feedback[director.id]?.startsWith('✅') ? styles.feedbackSuccess : ''}`}>
                    {feedback[director.id]}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className={styles.hint}>
        Click <strong>Connect Outlook</strong> to sign in with the director's Microsoft account.
        After sign-in, you'll be returned here and events will sync automatically every 5 minutes.
      </div>
    </DashboardCard>
  );
};

export default DirectorOutlookConnections;
