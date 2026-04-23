import React from 'react';
import DashboardCard from './DashboardCard';
import styles from './TaskSummaryCard.module.css';

const TaskSummaryCard = ({ tasks }) => {
  const today = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length;
  const dueToday = tasks.filter(t => t.dueDate === today && t.status !== 'done').length;
  const completed = tasks.filter(t => t.status === 'done').length;

  return (
    <DashboardCard icon="📋" title="Task Summary" badgeColor="gray">
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryIcon}>🔴</div>
          <div>
            <div className={styles.summaryLabel}>Overdue</div>
            <div className={styles.summaryValue}>{overdue}</div>
          </div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryIcon}>🟡</div>
          <div>
            <div className={styles.summaryLabel}>Due Today</div>
            <div className={styles.summaryValue}>{dueToday}</div>
          </div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryIcon}>🟢</div>
          <div>
            <div className={styles.summaryLabel}>Completed</div>
            <div className={styles.summaryValue}>{completed}</div>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
};

export default TaskSummaryCard;
