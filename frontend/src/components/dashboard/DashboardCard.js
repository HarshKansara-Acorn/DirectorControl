import React from 'react';
import styles from './DashboardCard.module.css';

const DashboardCard = ({ icon, title, badge, badgeColor = 'blue', onAdd, children, addLabel = 'Add' }) => {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.icon}>{icon}</span>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.actions}>
          {badge !== undefined && (
            <span className={`${styles.badge} ${styles[`badge_${badgeColor}`]}`}>
              {badge}
            </span>
          )}
          {onAdd && (
            <button className={styles.addBtn} onClick={onAdd} aria-label={addLabel}>
              +
            </button>
          )}
        </div>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
};

export default DashboardCard;
