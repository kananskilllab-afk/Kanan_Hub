import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, IdCard, Pencil, Camera, Trophy, Award } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { assetUrl } from '../utils/assetUrl';

export default function Profile() {
  const { setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ mobile: '', personalEmail: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/hrm/profile');
      setProfile(res.data.profile);
      setForm({ mobile: res.data.profile.mobile || '', personalEmail: res.data.profile.personalEmail || '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaveError('');
    setSaving(true);
    try {
      const res = await api.patch('/hrm/profile', form);
      setProfile((prev) => ({ ...prev, ...res.data.profile }));
      setEditing(false);
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhotoError('');
    if (!file.type.startsWith('image/')) return setPhotoError('Please choose an image file.');
    if (file.size > 3 * 1024 * 1024) return setPhotoError('Image must be under 3MB.');

    const formData = new FormData();
    formData.append('photo', file);

    setUploadingPhoto(true);
    try {
      const res = await api.post('/hrm/profile/photo', formData);
      setProfile((prev) => ({ ...prev, avatarUrl: res.data.avatarUrl }));
      setUser((prev) => (prev ? { ...prev, avatarUrl: res.data.avatarUrl } : prev));
    } catch (err) {
      setPhotoError(err.response?.data?.message || 'Could not upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading) return <div className="empty-state">Loading profile…</div>;
  if (error) {
    return (
      <div className="empty-state">
        <div className="es-icon"><AlertTriangle size={30} /></div>
        {error}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1><IdCard size={19} /> Personal Profile</h1>
          <p>View your employee profile and update your contact details</p>
        </div>
        <div className="page-header-right">
          {!editing && <button className="btn btn-primary" onClick={() => setEditing(true)}><Pencil size={13} /> Edit Contact Info</button>}
        </div>
      </div>

      <div className="profile-hero">
        <div className="profile-photo-upload">
          <div className="profile-avatar" style={{ overflow: 'hidden' }}>
            {profile.avatarUrl ? (
              <img className="avatar-img" src={assetUrl(profile.avatarUrl)} alt="" />
            ) : (
              profile.initials
            )}
          </div>
          <button
            type="button"
            className="avatar-camera-btn"
            title="Change photo"
            disabled={uploadingPhoto}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadingPhoto ? '…' : <Camera size={12} />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={uploadPhoto}
          />
        </div>
        <div>
          <div style={{ fontFamily: 'Sora,sans-serif', fontSize: 20, fontWeight: 700, marginBottom: 3 }}>{profile.name}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>{profile.designation} · {profile.department}</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '3px 11px', fontSize: 11.5 }}>{profile.employmentType}</span>
            <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '3px 11px', fontSize: 11.5 }}>{profile.branch}</span>
            <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '3px 11px', fontSize: 11.5 }}>{profile.employeeId}</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'Sora,sans-serif' }}>{profile.kPoints.toLocaleString()}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>K Points</div>
          <div style={{ marginTop: 6 }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              Rank #{profile.leaderboardRank} <Trophy size={12} style={{ verticalAlign: -2 }} />
            </span>
          </div>
        </div>
      </div>
      {photoError && <div className="form-error" style={{ marginBottom: 14 }}>{photoError}</div>}

      <div className="grid g-2">
        <div className="card">
          <div className="card-header"><span className="card-title"><IdCard size={15} /> Contact Information</span></div>
          <div className="card-body">
            {saveError && <div className="form-error">{saveError}</div>}
            {!editing ? (
              <table>
                <tbody>
                  <ProfileRow label="Work Email" value={profile.email} />
                  <ProfileRow label="Personal Email" value={profile.personalEmail || '—'} />
                  <ProfileRow label="Mobile" value={profile.mobile || '—'} />
                  <ProfileRow label="Branch" value={profile.branch} />
                  <ProfileRow label="Date of Joining" value={new Date(profile.joinDate).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })} />
                  <ProfileRow label="Reporting To" value={profile.manager ? `${profile.manager.name} (${profile.manager.designation})` : '—'} />
                </tbody>
              </table>
            ) : (
              <form onSubmit={save}>
                <table style={{ marginBottom: 14 }}>
                  <tbody>
                    <ProfileRow label="Work Email" value={profile.email} />
                    <ProfileRow label="Branch" value={profile.branch} />
                    <ProfileRow label="Date of Joining" value={new Date(profile.joinDate).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })} />
                    <ProfileRow label="Reporting To" value={profile.manager ? `${profile.manager.name} (${profile.manager.designation})` : '—'} />
                  </tbody>
                </table>
                <div className="form-group">
                  <label className="form-label">Personal Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={form.personalEmail}
                    onChange={(e) => setForm({ ...form, personalEmail: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile</label>
                  <input
                    className="form-input"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditing(false);
                      setSaveError('');
                      setForm({ mobile: profile.mobile || '', personalEmail: profile.personalEmail || '' });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title"><Award size={15} /> Achievements</span></div>
          <div className="card-body" style={{ textAlign: 'center', padding: '28px 18px' }}>
            <Award size={40} style={{ marginBottom: 6, color: 'var(--gold)' }} />
            <div style={{ fontFamily: 'Sora,sans-serif', fontSize: 24, fontWeight: 700 }}>{profile.badgesEarned}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Badge{profile.badgesEarned === 1 ? '' : 's'} Earned</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value }) {
  return (
    <tr>
      <td style={{ color: 'var(--text-muted)', width: 140, padding: '8px 0' }}>{label}</td>
      <td>{value}</td>
    </tr>
  );
}
