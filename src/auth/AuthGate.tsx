/**
 * Lớp bảo vệ trang: PIN local (không backend) + tùy chọn Firebase email/password.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  firebaseLogin,
  firebaseRegister,
  firebaseLogout,
  watchFirebaseUser,
} from './firebase';

const PIN_HASH_KEY = 'ketcau-pin-hash-v1';
const UNLOCK_KEY = 'ketcau-unlocked-v1';

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hasPin(): boolean {
  try {
    return !!localStorage.getItem(PIN_HASH_KEY);
  } catch {
    return false;
  }
}

function isSessionUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

function setSessionUnlocked(v: boolean) {
  try {
    if (v) sessionStorage.setItem(UNLOCK_KEY, '1');
    else sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

type Mode = 'pin' | 'firebase' | 'setup';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [mode, setMode] = useState<Mode>('pin');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fbUser, setFbUser] = useState<string | null>(null);
  const [needSetup, setNeedSetup] = useState(false);

  useEffect(() => {
    const setup = !hasPin();
    setNeedSetup(setup);
    if (setup) setMode('setup');
    if (isSessionUnlocked()) {
      setUnlocked(true);
      setReady(true);
      return;
    }
    const unsub = watchFirebaseUser((u) => {
      if (u) {
        setFbUser(u.email || u.uid);
        setSessionUnlocked(true);
        setUnlocked(true);
      }
      setReady(true);
    });
    const t = setTimeout(() => setReady(true), 1500);
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, []);

  const unlock = () => {
    setSessionUnlocked(true);
    setUnlocked(true);
    setError('');
    setPin('');
    setPassword('');
  };

  const onSetupPin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (pin.length < 4) {
      setError('PIN tối thiểu 4 ký tự.');
      return;
    }
    if (pin !== pin2) {
      setError('PIN nhập lại không khớp.');
      return;
    }
    const hash = await sha256(pin);
    localStorage.setItem(PIN_HASH_KEY, hash);
    setNeedSetup(false);
    unlock();
  };

  const onPinLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const stored = localStorage.getItem(PIN_HASH_KEY);
    if (!stored) {
      setNeedSetup(true);
      setMode('setup');
      return;
    }
    const hash = await sha256(pin);
    if (hash !== stored) {
      setError('PIN không đúng.');
      return;
    }
    unlock();
  };

  const onFirebaseLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await firebaseLogin(email.trim(), password);
      unlock();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('auth/') ? 'Email/mật khẩu không đúng hoặc chưa bật Email Auth trên Firebase.' : msg);
    } finally {
      setBusy(false);
    }
  };

  const onFirebaseRegister = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    if (password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.');
      setBusy(false);
      return;
    }
    try {
      await firebaseRegister(email.trim(), password);
      unlock();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.includes('email-already')
          ? 'Email đã được đăng ký — hãy đăng nhập.'
          : msg.includes('auth/')
            ? 'Không tạo được tài khoản. Bật Email/Password trong Firebase Console → Authentication.'
            : msg,
      );
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    setSessionUnlocked(false);
    setUnlocked(false);
    setFbUser(null);
    try {
      await firebaseLogout();
    } catch {
      /* ignore */
    }
  };

  if (!ready) {
    return (
      <div className="auth-gate">
        <div className="auth-card">
          <div className="auth-brand">BTCT 5574:2018</div>
          <p className="muted">Đang tải…</p>
        </div>
      </div>
    );
  }

  if (unlocked) {
    return (
      <>
        {children}
        <button type="button" className="auth-logout" title="Khóa trang" onClick={() => void onLogout()}>
          🔒 Khóa
        </button>
      </>
    );
  }

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <div className="auth-brand">
          BTCT <span>5574:2018</span>
        </div>
        <p className="muted">Dầm · Cột · Sàn · Móng — bảo vệ truy cập</p>

        <div className="auth-tabs">
          {!needSetup && (
            <button type="button" className={mode === 'pin' ? 'active' : ''} onClick={() => { setMode('pin'); setError(''); }}>
              PIN
            </button>
          )}
          {needSetup && (
            <button type="button" className={mode === 'setup' ? 'active' : ''} onClick={() => { setMode('setup'); setError(''); }}>
              Tạo PIN
            </button>
          )}
          <button type="button" className={mode === 'firebase' ? 'active' : ''} onClick={() => { setMode('firebase'); setError(''); }}>
            Tài khoản Firebase
          </button>
        </div>

        {mode === 'setup' && (
          <form onSubmit={onSetupPin} className="auth-form">
            <p className="auth-hint">Lần đầu: đặt PIN (lưu trên máy, không gửi server).</p>
            <label>
              PIN mới
              <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus minLength={4} />
            </label>
            <label>
              Nhập lại PIN
              <input type="password" value={pin2} onChange={(e) => setPin2(e.target.value)} minLength={4} />
            </label>
            <button type="submit" className="primary">
              Lưu PIN & vào app
            </button>
          </form>
        )}

        {mode === 'pin' && !needSetup && (
          <form onSubmit={onPinLogin} className="auth-form">
            <label>
              PIN truy cập
              <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
            </label>
            <button type="submit" className="primary">
              Mở khóa
            </button>
          </form>
        )}

        {mode === 'firebase' && (
          <form className="auth-form" onSubmit={onFirebaseLogin}>
            <p className="auth-hint">
              Dùng Firebase project <code>tinhketcau-btct-5574-24f5e</code>. Cần bật Email/Password trong Console.
            </p>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
            </label>
            <label>
              Mật khẩu
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Đang xử lý…' : 'Đăng nhập'}
            </button>
            <button type="button" disabled={busy} onClick={(e) => void onFirebaseRegister(e as unknown as FormEvent)}>
              Tạo tài khoản mới
            </button>
          </form>
        )}

        {error && <div className="auth-error">{error}</div>}
        {fbUser && <div className="auth-hint">Đã đăng nhập: {fbUser}</div>}
      </div>
    </div>
  );
}
