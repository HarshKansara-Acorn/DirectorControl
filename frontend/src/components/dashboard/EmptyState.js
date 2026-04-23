import React from 'react';
import styles from './EmptyState.module.css';

const EmptyState = ({ message }) => (
  <div className={styles.empty}>
    <p className={styles.message}>{message}</p>
  </div>
);

export default EmptyState;
