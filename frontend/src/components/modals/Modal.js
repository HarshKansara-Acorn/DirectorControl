import React, { useEffect } from 'react';
import styles from './Modal.module.css';
import { X } from 'lucide-react';

const Modal = ({ title, onClose, children, size = 'md' }) => {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`${styles.modal} ${styles[`modal_${size}`]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
