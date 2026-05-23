import React from 'react';
import DirectorOutlookConnections from '../components/dashboard/DirectorOutlookConnections';
import styles from './Dashboard.module.css';

const AdminDashboard = () => {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.dateStr}>{today}</p>
          <h1 className={styles.greeting}>Admin Dashboard</h1>
          <p className={styles.summary}>
            Manage director Outlook sync connections from a dedicated admin view.
          </p>
        </div>
      </div>

      <section className={styles.adminSection}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionLabel}>Admin dashboard</p>
            <h2 className={styles.sectionTitle}>Director Outlook Connections</h2>
          </div>
          <p className={styles.sectionNote}>
            Use this section to review Outlook sync status and generate secure connection links for directors.
          </p>
        </div>
        <DirectorOutlookConnections />
      </section>
    </div>
  );
};

export default AdminDashboard;
