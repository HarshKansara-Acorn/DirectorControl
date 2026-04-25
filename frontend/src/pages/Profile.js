import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  User, Mail, Phone, MapPin, Briefcase, Building2,
  Save, Camera, Upload, Trash2, X, ZoomIn, ZoomOut, Check
} from 'lucide-react';
import styles from './Profile.module.css';

const AVATAR_COLORS = [
  '#1e40af', '#7c3aed', '#0f766e', '#b45309',
  '#be123c', '#0369a1', '#15803d', '#9333ea',
  '#c2410c', '#0e7490',
];

// Output size for the saved photo (square, px)
const OUTPUT_SIZE = 300;

// ─────────────────────────────────────────────────────────────────────────────
// Canvas crop/resize helper — returns a compressed JPEG data URL
// ─────────────────────────────────────────────────────────────────────────────
function cropAndResize(imageSrc, cropState, outputSize = OUTPUT_SIZE) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');

      // cropState: { scale, offsetX, offsetY } where offset is in image-pixel space
      const { scale, offsetX, offsetY } = cropState;

      // The visible square in image-pixel space
      const visibleSize = outputSize / scale;

      ctx.drawImage(
        img,
        offsetX, offsetY,          // source x, y (image pixels)
        visibleSize, visibleSize,   // source width, height
        0, 0,                       // dest x, y
        outputSize, outputSize      // dest width, height
      );

      // Compress to JPEG at 85% quality — keeps file small
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CropModal — drag + zoom to position the photo in a circular preview
// Zoom range: 0% (image fills circle) → 100% (2× zoom)
// ─────────────────────────────────────────────────────────────────────────────
const CropModal = ({ imageSrc, onSave, onCancel, saving }) => {
  const canvasRef   = useRef(null);
  const imgRef      = useRef(null);
  const dragging    = useRef(false);
  const lastPos     = useRef({ x: 0, y: 0 });

  const PREVIEW = 280; // preview canvas size in px

  // fitScale = scale at which the image exactly fills the preview circle (0%)
  // maxScale = fitScale * 2 (100%)
  const fitScaleRef = useRef(1);

  const [scale, setScale]       = useState(1);
  const [zoomPct, setZoomPct]   = useState(0);   // 0–100 displayed to user
  const [offset, setOffset]     = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize]   = useState({ w: 1, h: 1 });

  // Load image — initialise to 0% zoom (image fills circle, centred)
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });

      // fitScale: smallest scale so the image covers the full preview square
      const fitScale = PREVIEW / Math.min(img.naturalWidth, img.naturalHeight);
      fitScaleRef.current = fitScale;

      setScale(fitScale);
      setZoomPct(0);

      // Centre the image
      const visibleSize = PREVIEW / fitScale;
      setOffset({
        x: (img.naturalWidth  - visibleSize) / 2,
        y: (img.naturalHeight - visibleSize) / 2,
      });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Redraw canvas whenever scale/offset changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    const visibleSize = PREVIEW / scale;
    ctx.drawImage(
      imgRef.current,
      offset.x, offset.y,
      visibleSize, visibleSize,
      0, 0,
      PREVIEW, PREVIEW
    );
  }, [scale, offset]);

  // Clamp offset so image never leaves the crop square
  const clampOffset = useCallback((ox, oy, sc) => {
    const visibleSize = PREVIEW / sc;
    return {
      x: Math.max(0, Math.min(ox, imgSize.w - visibleSize)),
      y: Math.max(0, Math.min(oy, imgSize.h - visibleSize)),
    };
  }, [imgSize]);

  // ── Drag handlers ──
  const onMouseDown = (e) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    const imgDelta = 1 / scale;
    setOffset(prev => clampOffset(prev.x - dx * imgDelta, prev.y - dy * imgDelta, scale));
  }, [scale, clampOffset]);

  const onMouseUp = () => { dragging.current = false; };

  // Touch support
  const onTouchStart = (e) => {
    dragging.current = true;
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - lastPos.current.x;
    const dy = e.touches[0].clientY - lastPos.current.y;
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    const imgDelta = 1 / scale;
    setOffset(prev => clampOffset(prev.x - dx * imgDelta, prev.y - dy * imgDelta, scale));
  }, [scale, clampOffset]);

  // ── Zoom — accepts 0–100 percentage ──
  const handleZoomPct = useCallback((pct) => {
    const clamped = Math.max(0, Math.min(100, pct));
    const fitScale = fitScaleRef.current;
    // 0% → fitScale, 100% → fitScale * 2
    const newScale = fitScale * (1 + clamped / 100);

    // Keep the centre of the visible area fixed while zooming
    const oldVisible = PREVIEW / scale;
    const newVisible = PREVIEW / newScale;
    const cx = offset.x + oldVisible / 2;
    const cy = offset.y + oldVisible / 2;
    const newOffset = clampOffset(cx - newVisible / 2, cy - newVisible / 2, newScale);

    setScale(newScale);
    setZoomPct(clamped);
    setOffset(newOffset);
  }, [scale, offset, clampOffset]);

  // ── Save ──
  const handleSave = async () => {
    const dataUrl = await cropAndResize(imageSrc, { scale, offsetX: offset.x, offsetY: offset.y });
    onSave(dataUrl);
  };

  return (
    <div className={styles.cropOverlay} role="dialog" aria-modal="true" aria-label="Crop photo">
      <div className={styles.cropModal}>
        <div className={styles.cropHeader}>
          <h3 className={styles.cropTitle}>Adjust Profile Photo</h3>
          <button className={styles.cropCloseBtn} onClick={onCancel} aria-label="Cancel">
            <X size={16} />
          </button>
        </div>

        <p className={styles.cropHint}>Drag to reposition · Use slider to zoom</p>

        {/* Circular preview canvas */}
        <div className={styles.cropCanvasWrap}>
          <canvas
            ref={canvasRef}
            width={PREVIEW}
            height={PREVIEW}
            className={styles.cropCanvas}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onMouseUp}
            style={{ cursor: 'grab' }}
          />
          <div className={styles.cropCircleMask} />
        </div>

        {/* Zoom slider — 0% to 100% */}
        <div className={styles.zoomRow}>
          <button
            className={styles.zoomBtn}
            onClick={() => handleZoomPct(zoomPct - 5)}
            aria-label="Zoom out"
            disabled={zoomPct <= 0}
          >
            <ZoomOut size={16} />
          </button>
          <input
            type="range"
            className={styles.zoomSlider}
            min="0"
            max="100"
            step="1"
            value={zoomPct}
            onChange={e => handleZoomPct(parseInt(e.target.value, 10))}
            aria-label="Zoom level"
          />
          <button
            className={styles.zoomBtn}
            onClick={() => handleZoomPct(zoomPct + 5)}
            aria-label="Zoom in"
            disabled={zoomPct >= 100}
          >
            <ZoomIn size={16} />
          </button>
          <span className={styles.zoomLabel}>{zoomPct}%</span>
        </div>

        {/* Actions */}
        <div className={styles.cropActions}>
          <button className={styles.cropCancelBtn} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className={styles.cropSaveBtn} onClick={handleSave} disabled={saving}>
            {saving ? (
              <><span className={styles.btnSpinner} /> Saving...</>
            ) : (
              <><Check size={14} /> Apply Photo</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Profile component
// ─────────────────────────────────────────────────────────────────────────────
const Profile = () => {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    phone: '', bio: '', location: '',
    department: '', title: '', avatar: '', avatarColor: '#1e40af',
  });
  const [avatarPhoto, setAvatarPhoto]       = useState(null);
  const [cropSrc, setCropSrc]               = useState(null);   // raw file src for crop modal
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [photoSaving, setPhotoSaving]       = useState(false);
  const [success, setSuccess]               = useState('');
  const [error, setError]                   = useState('');
  const [photoError, setPhotoError]         = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [dragOver, setDragOver]             = useState(false);

  // ── Load profile ────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/users/me').then(res => {
      const u = res.data;
      setForm({
        firstName:   u.firstName   || u.name?.split(' ')[0] || '',
        lastName:    u.lastName    || u.name?.split(' ').slice(1).join(' ') || '',
        email:       u.email       || '',
        phone:       u.phone       || '',
        bio:         u.bio         || '',
        location:    u.location    || '',
        department:  u.department  || '',
        title:       u.title       || '',
        avatar:      u.avatar      || '',
        avatarColor: u.avatarColor || '#1e40af',
      });
      setAvatarPhoto(u.avatarPhoto || null);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  // ── Form ────────────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setSuccess(''); setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setSuccess(''); setError('');
    try {
      const res = await api.put('/users/me/profile', form);
      updateUser(res.data);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save profile');
    } finally { setSaving(false); }
  };

  // ── Avatar colour / initials ────────────────────────────────────────────────
  const handleAvatarColorChange = async (color) => {
    setForm(f => ({ ...f, avatarColor: color }));
    setShowColorPicker(false);
    try {
      await api.put('/users/me/avatar', { avatar: form.avatar, avatarColor: color });
      updateUser({ avatarColor: color });
    } catch (err) { console.error(err); }
  };

  const handleAvatarTextChange = async (e) => {
    const val = e.target.value.toUpperCase().slice(0, 2);
    setForm(f => ({ ...f, avatar: val }));
    try {
      await api.put('/users/me/avatar', { avatar: val, avatarColor: form.avatarColor });
      updateUser({ avatar: val });
    } catch (err) { console.error(err); }
  };

  // ── File selection — opens crop modal ──────────────────────────────────────
  const openCropModal = (file) => {
    setPhotoError('');
    if (!file) return;

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setPhotoError('Only JPEG, PNG, GIF or WebP images are allowed.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setPhotoError('File is too large. Please choose an image under 20 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setCropSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e) => {
    openCropModal(e.target.files?.[0]);
    e.target.value = ''; // reset so same file can be re-selected
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    openCropModal(e.dataTransfer.files?.[0]);
  };

  // ── After crop — upload to server ──────────────────────────────────────────
  const handleCropSave = async (dataUrl) => {
    setPhotoSaving(true);
    try {
      await api.put('/users/me/photo', { photo: dataUrl });
      setAvatarPhoto(dataUrl);
      updateUser({ avatarPhoto: dataUrl });
      setCropSrc(null);
      setShowColorPicker(false);
      setSuccess('Profile photo updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setPhotoError(err.response?.data?.message || 'Failed to upload photo. Please try again.');
    } finally { setPhotoSaving(false); }
  };

  // ── Remove photo ────────────────────────────────────────────────────────────
  const handleRemovePhoto = async () => {
    setPhotoError('');
    try {
      await api.delete('/users/me/photo');
      setAvatarPhoto(null);
      updateUser({ avatarPhoto: null });
      setSuccess('Profile photo removed.');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setPhotoError('Failed to remove photo.'); }
  };

  const displayInitials = form.avatar ||
    `${form.firstName?.[0] || ''}${form.lastName?.[0] || ''}`.toUpperCase() ||
    user?.name?.[0]?.toUpperCase() || '?';

  if (loading) return <div className={styles.loading}>Loading profile...</div>;

  return (
    <div className={styles.page}>
      {/* Crop modal */}
      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          onSave={handleCropSave}
          onCancel={() => setCropSrc(null)}
          saving={photoSaving}
        />
      )}

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Profile</h1>
        <p className={styles.pageSubtitle}>Manage your personal information</p>
      </div>

      <div className={styles.layout}>
        {/* ── Left: Avatar Card ── */}
        <div className={styles.avatarCard}>

          {/* Avatar display + drag target */}
          <div
            className={`${styles.avatarWrap} ${dragOver ? styles.avatarWrapDrag : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {avatarPhoto ? (
              <img src={avatarPhoto} alt="Profile" className={styles.avatarPhoto} />
            ) : (
              <div className={styles.avatar} style={{ background: form.avatarColor }}>
                {displayInitials}
              </div>
            )}

            {/* Camera button — toggles editor panel */}
            <button
              className={styles.avatarEditBtn}
              onClick={() => setShowColorPicker(v => !v)}
              aria-label="Edit profile photo"
              title="Edit profile photo"
            >
              <Camera size={14} />
            </button>
          </div>

          <p className={styles.dragHint}>Drag & drop a photo, or click the camera icon</p>

          {photoError && (
            <div className={styles.photoError} role="alert">
              <X size={12} /> {photoError}
            </div>
          )}

          {/* ── Editor panel ── */}
          {showColorPicker && (
            <div className={styles.colorPicker}>

              {/* Upload section */}
              <p className={styles.colorPickerLabel}>Profile Photo</p>
              <div className={styles.uploadBtns}>
                <button
                  className={styles.uploadBtn}
                  onClick={() => fileInputRef.current?.click()}
                  title="Choose a photo from your computer"
                >
                  <Upload size={13} /> Upload Photo
                </button>
                {avatarPhoto && (
                  <button className={styles.removePhotoBtn} onClick={handleRemovePhoto}>
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>
              <p className={styles.uploadHint}>JPEG · PNG · GIF · WebP · Max 20 MB</p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                className={styles.fileInput}
                onChange={handleFileInput}
                aria-label="Upload profile photo"
              />

              {/* Divider */}
              {!avatarPhoto && <div className={styles.pickerDivider} />}

              {/* Colour + initials (only when no photo) */}
              {!avatarPhoto && (
                <>
                  <p className={styles.colorPickerLabel}>Initials Colour</p>
                  <div className={styles.colorGrid}>
                    {AVATAR_COLORS.map(c => (
                      <button
                        key={c}
                        className={`${styles.colorSwatch} ${form.avatarColor === c ? styles.colorSwatchActive : ''}`}
                        style={{ background: c }}
                        onClick={() => handleAvatarColorChange(c)}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                  </div>
                  <div className={styles.avatarInitialsRow}>
                    <label className={styles.colorPickerLabel}>Custom Initials (max 2)</label>
                    <input
                      className={styles.initialsInput}
                      value={form.avatar}
                      onChange={handleAvatarTextChange}
                      maxLength={2}
                      placeholder="CP"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Name / role */}
          <div className={styles.avatarName}>{form.firstName} {form.lastName}</div>
          <div className={styles.avatarRole}>
            {user?.role === 'admin' ? 'Personal Assistant' : 'Director'}
          </div>
          {form.department && <div className={styles.avatarDept}>{form.department}</div>}

          <div className={styles.infoList}>
            {form.email && (
              <div className={styles.infoItem}>
                <Mail size={13} color="var(--text-muted)" />
                <span>{form.email}</span>
              </div>
            )}
            {form.phone && (
              <div className={styles.infoItem}>
                <Phone size={13} color="var(--text-muted)" />
                <span>{form.phone}</span>
              </div>
            )}
            {form.location && (
              <div className={styles.infoItem}>
                <MapPin size={13} color="var(--text-muted)" />
                <span>{form.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Edit Form ── */}
        <div className={styles.formCard}>
          <form onSubmit={handleSave}>
            <div className={styles.section}>
              <div className={styles.sectionTitle}><User size={15} /> Personal Information</div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>First Name</label>
                  <input className={styles.input} name="firstName" value={form.firstName} onChange={handleChange} placeholder="First name" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Last Name</label>
                  <input className={styles.input} name="lastName" value={form.lastName} onChange={handleChange} placeholder="Last name" />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email Address</label>
                <input className={`${styles.input} ${styles.inputReadonly}`} value={form.email} readOnly />
                <span className={styles.fieldHint}>Email cannot be changed. Contact your administrator.</span>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Phone Number</label>
                <div className={styles.inputIcon}>
                  <Phone size={15} className={styles.inputIconEl} />
                  <input className={styles.input} name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" type="tel" />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}><Briefcase size={15} /> Work Information</div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Job Title</label>
                  <input className={styles.input} name="title" value={form.title} onChange={handleChange} placeholder="e.g. Director, Personal Assistant" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Department</label>
                  <div className={styles.inputIcon}>
                    <Building2 size={15} className={styles.inputIconEl} />
                    <input className={styles.input} name="department" value={form.department} onChange={handleChange} placeholder="e.g. Finance, Operations" />
                  </div>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Location / Office</label>
                <div className={styles.inputIcon}>
                  <MapPin size={15} className={styles.inputIconEl} />
                  <input className={styles.input} name="location" value={form.location} onChange={handleChange} placeholder="e.g. Mumbai, India" />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}><User size={15} /> About Me</div>
              <div className={styles.field}>
                <label className={styles.label}>Bio</label>
                <textarea
                  className={styles.textarea}
                  name="bio"
                  value={form.bio}
                  onChange={handleChange}
                  placeholder="A short bio about yourself..."
                  rows={4}
                  maxLength={500}
                />
                <span className={styles.fieldHint}>{form.bio.length}/500 characters</span>
              </div>
            </div>

            {success && <div className={styles.successMsg}>✅ {success}</div>}
            {error   && <div className={styles.errorMsg}>❌ {error}</div>}

            <div className={styles.formActions}>
              <button type="submit" className={styles.saveBtn} disabled={saving}>
                <Save size={15} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
