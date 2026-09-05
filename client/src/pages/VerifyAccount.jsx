import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

export default function VerifyAccount() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // checking | ready | invalid | done
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get(`/verify/${token}`)
      .then((res) => {
        setEmployeeInfo(res.data);
        setStatus('ready');
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Verification link is invalid.');
        setStatus('invalid');
      });
  }, [token]);

  async function handleActivate(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setSaving(true);
    try {
      await api.post(`/verify/${token}`, { password, confirmPassword });
      setStatus('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not activate your account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img src="/logo.jpeg" alt="Kanan.co" className="auth-logo-img" />

        {status === 'checking' && <div className="auth-sub">Checking your verification link…</div>}

        {status === 'invalid' && (
          <>
            <div className="auth-sub">Verify Your Account</div>
            <div className="form-error">{error}</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10 }}>
              Ask HR to resend your verification email, then try the new link.
            </p>
          </>
        )}

        {status === 'ready' && employeeInfo && (
          <>
            <div className="auth-sub">Verify Your Account</div>
            <p style={{ fontSize: 13, marginBottom: 14 }}>Welcome, <strong>{employeeInfo.name}</strong></p>
            <div className="form-group">
              <label className="form-label">Official Email</label>
              <input className="form-input" value={employeeInfo.email} disabled />
            </div>
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={handleActivate}>
              <div className="form-group">
                <label className="form-label">Create Password</label>
                <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
                {saving ? 'Activating…' : 'Activate Account'}
              </button>
            </form>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="auth-sub">✓ Account Verified Successfully</div>
            <p style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 16 }}>
              Welcome to Kanan. Your employee account is now active.
            </p>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/login')}>
              Go to Login
            </button>
          </>
        )}

        <div className="auth-hint"><Link to="/login" className="text-link">Back to login</Link></div>
      </div>
    </div>
  );
}
