/**
 * FileUploadButton — reusable file upload/download/remove component.
 *
 * Props:
 *   itemId       — the record ID to upload to
 *   endpoint     — API base path e.g. '/documents', '/bills'
 *   hasFile      — boolean, whether a file is already attached
 *   fileName     — current file name (for display)
 *   fileData     — base64 data URL (for download)
 *   onSuccess    — callback after upload/remove succeeds
 *   disabled     — disable all actions
 *   label        — button label (default: 'Upload')
 *   accept       — file input accept string
 */
import React, { useRef, useState } from 'react';
import api from '../../services/api';
import { Upload, Download, Trash2, Paperclip, Loader } from 'lucide-react';
import styles from './FileUploadButton.module.css';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ACCEPT_DEFAULT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp';

const FileUploadButton = ({
  itemId,
  endpoint,
  hasFile,
  fileName,
  fileData,
  fileType,
  onSuccess,
  disabled = false,
  label = 'Upload',
  accept = ACCEPT_DEFAULT,
}) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving]   = useState(false);
  const [error, setError]         = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side size check
    if (file.size > MAX_SIZE_BYTES) {
      setError('File too large. Maximum size is 10MB.');
      e.target.value = '';
      return;
    }

    setError('');
    setUploading(true);

    try {
      // Read as base64 data URL
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await api.post(`${endpoint}/${itemId}/upload`, {
        fileData,
        fileName: file.name,
      });

      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = () => {
    if (!fileData) return;
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRemove = async () => {
    if (!window.confirm(`Remove "${fileName}"?`)) return;
    setRemoving(true);
    setError('');
    try {
      await api.delete(`${endpoint}/${itemId}/upload`);
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove file.');
    } finally {
      setRemoving(false);
    }
  };

  // File type icon
  const getIcon = (type) => {
    if (!type) return '📎';
    if (['jpg','jpeg','png','gif','webp'].includes(type)) return '🖼️';
    if (type === 'pdf') return '📄';
    if (['doc','docx'].includes(type)) return '📝';
    if (['xls','xlsx'].includes(type)) return '📊';
    if (['ppt','pptx'].includes(type)) return '📋';
    return '📎';
  };

  return (
    <div className={styles.wrap}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.hiddenInput}
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      {hasFile ? (
        /* ── File attached state ── */
        <div className={styles.attachedRow}>
          <span className={styles.fileIcon}>{getIcon(fileType)}</span>
          <span className={styles.fileName} title={fileName}>{fileName}</span>
          <div className={styles.attachedActions}>
            <button
              type="button"
              className={styles.downloadBtn}
              onClick={handleDownload}
              title="Download"
              disabled={!fileData}
            >
              <Download size={13} />
            </button>
            {!disabled && (
              <>
                <button
                  type="button"
                  className={styles.replaceBtn}
                  onClick={() => inputRef.current?.click()}
                  title="Replace file"
                  disabled={uploading}
                >
                  <Upload size={13} />
                </button>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={handleRemove}
                  title="Remove file"
                  disabled={removing}
                >
                  {removing ? <Loader size={13} className={styles.spin} /> : <Trash2 size={13} />}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── No file state ── */
        <button
          type="button"
          className={styles.uploadBtn}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading
            ? <><Loader size={13} className={styles.spin} /> Uploading...</>
            : <><Paperclip size={13} /> {label}</>
          }
        </button>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};

export default FileUploadButton;
