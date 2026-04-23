import React from 'react';
import styles from './FormField.module.css';

const FormField = ({ label, required, children, error }) => (
  <div className={styles.field}>
    <label className={styles.label}>
      {label} {required && <span className={styles.required}>*</span>}
    </label>
    {children}
    {error && <span className={styles.error}>{error}</span>}
  </div>
);

export const Input = ({ ...props }) => (
  <input className={styles.input} {...props} />
);

export const Textarea = ({ ...props }) => (
  <textarea className={styles.textarea} rows={3} {...props} />
);

export const Select = ({ children, ...props }) => (
  <select className={styles.select} {...props}>{children}</select>
);

export const FormActions = ({ onCancel, submitLabel = 'Save', loading }) => (
  <div className={styles.actions}>
    <button type="button" className={styles.cancelBtn} onClick={onCancel}>
      Cancel
    </button>
    <button type="submit" className={styles.submitBtn} disabled={loading}>
      {loading ? 'Saving...' : submitLabel}
    </button>
  </div>
);

export default FormField;
