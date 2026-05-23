import React, { useState, useEffect } from 'react';
import { useDirector } from '../../context/DirectorContext';
import api from '../../services/api';
import DashboardCard from './DashboardCard';
import styles from './DirectorOutlookConnections.module.css';
import { CheckCircle2, Link2, RefreshCcw, XCircle } from 'lucide-react';

const DirectorOutlookConnections = () => {
  const { directors } = useDirector();
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({});

  const fetchStatuses = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(directors.map((director) =>
        api.get(`/admin/director/${director.id}/outlook-status`).then((res) => ({ id: director.id, data: res.data }))
      ));
      const next = {};
      results.forEach((result) => {
        next[result.id] = result.data;
      });
      setStatuses(next);
    } catch (err) {
      console.error('Failed to load Outlook statuses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (directors.length > 0) fetchStatuses();
  }, [directors]);

  const updateFeedback = (directorId, message) => {
    setFeedback((prev) => ({ ...prev, [directorId]: message }));
  };

  const handleConnect = async (directorId) => {
    updateFeedback(directorId, 'Generating secure connection link...');
    try {
      const res = await api.post(`/admin/director/${directorId}/connect-outlook`);
      const authUrl = res.data.authUrl;
      if (!authUrl) {
        updateFeedback(directorId, 'Failed to generate Outlook connection link');
        return;
      }

      try {
        await navigator.clipboard.writeText(authUrl);
        updateFeedback(directorId, 'Connection link copied to clipboard. Opened in a new tab for director use.');
      } catch {
        updateFeedback(directorId, 'Connection link generated. Please paste it into a message for the director.');
      }

      const popup = window.open('about:blank', '_blank');
      if (popup) {
        popup.location.href = authUrl;
      }
    } catch (err) {
      updateFeedback(directorId, err.response?.data?.message || 'Failed to start Outlook connection');
    }
  };

  const handleDisconnect = async (directorId) => {
    updateFeedback(directorId, 'Disconnecting Outlook...');
    try {
      await api.post(`/admin/director/${directorId}/disconnect-outlook`);
      await fetchStatuses();
      updateFeedback(directorId, 'Outlook disconnected successfully.');
    } catch (err) {
      updateFeedback(directorId, err.response?.data?.message || 'Failed to disconnect Outlook');
    }
  };

  const handleRefresh = async () => {
    await fetchStatuses();
    setFeedback({});
  };

  return (
    <DashboardCard
      icon="📧"
      title="Director Outlook Connections"
      badge={directors.length}
      badgeColor="purple"
      onAdd={handleRefresh}
      addLabel="Refresh connection status"
    >
      <div className={styles.list}>
        {directors.length === 0 ? (
          <div className={styles.empty}>No directors available</div>
        ) : loading ? (
          <div className={styles.loading}>Loading connection status...</div>
        ) : directors.map((director) => {
          const status = statuses[director.id] || {};
          const connected = status.connected;
          const pending = !status.configured ? false : !connected && status.msUserEmail;
          return (
            <div key={director.id} className={styles.row}>
              <div className={styles.userInfo}>
                <div className={styles.name}>{director.name}</div>
                <div className={styles.meta}>
                  {connected ? (
                    <span className={styles.statusConnected}><CheckCircle2 size={14} /> Connected</span>
                  ) : status.configured === false ? (
                    <span className={styles.statusError}><XCircle size={14} /> Not configured</span>
                  ) : (
                    <span className={styles.statusPending}><Link2 size={14} /> Not connected</span>
                  )}
                  {status.lastSync && (
                    <span className={styles.syncTime}>Last sync {new Date(status.lastSync).toLocaleString()}</span>
                  )}
                </div>
              </div>
              <div className={styles.actions}>
                {connected ? (
                  <button className={styles.disconnectBtn} onClick={() => handleDisconnect(director.id)}>
                    Disconnect
                  </button>
                ) : (
                  <button className={styles.connectBtn} onClick={() => handleConnect(director.id)}>
                    Connect Outlook
                  </button>
                )}
              </div>
              {feedback[director.id] && (
                <div className={styles.feedback}>{feedback[director.id]}</div>
              )}
            </div>
          );
        })}
      </div>
      <div className={styles.hint}>
        Admins can generate a secure Outlook authorization link for each director. The director must complete sign-in using their own Microsoft account.
      </div>
    </DashboardCard>
  );
};

export default DirectorOutlookConnections;
