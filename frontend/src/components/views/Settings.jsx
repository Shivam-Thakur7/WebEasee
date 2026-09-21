import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Moon, 
  Sun, 
  Volume2, 
  Sliders, 
  Command, 
  Sparkles, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

const BACKEND_URL = 'http://127.0.0.1:8000';

export default function Settings({ 
  largeText, 
  setLargeText, 
  highContrast, 
  setHighContrast, 
  theme, 
  setTheme 
}) {
  const [backendHealth, setBackendHealth] = useState(null);
  const [pingLatency, setPingLatency] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState('en-US-JennyNeural');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = async () => {
    setIsChecking(true);
    const start = performance.now();
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      const latency = Math.round(performance.now() - start);
      setPingLatency(latency);
      if (res.ok) {
        const data = await res.json();
        setBackendHealth(data);
      } else {
        setBackendHealth({ status: 'error' });
      }
    } catch (e) {
      setBackendHealth({ status: 'offline' });
      setPingLatency(null);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <section className="view-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>Preferences & Diagnostics</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Configure accessibility, voices & Azure connection</p>
        </div>
        <button 
          onClick={checkHealth}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '10.5px' }}
          disabled={isChecking}
        >
          <RefreshCw size={11} className={isChecking ? 'status-dot animate' : ''} />
          <span>Ping API</span>
        </button>
      </div>

      {/* Backend & Azure AI Status Card */}
      <div className="card" style={{ background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={15} color="var(--brand-600)" />
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>Azure AI & Speech Status</span>
          </div>
          {backendHealth?.status === 'healthy' ? (
            <span style={{ fontSize: '10.5px', color: 'var(--emerald-600)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Connected {pingLatency ? `(${pingLatency}ms)` : ''}
            </span>
          ) : (
            <span style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={13} /> {backendHealth?.status === 'degraded' ? 'Degraded config' : 'Offline'}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
          <div style={{ background: 'var(--bg-card-secondary)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9.5px', fontWeight: 700 }}>LLM MODEL</span>
            <span style={{ fontWeight: 700, color: 'var(--brand-700)' }}>Azure GPT-4.1-mini</span>
          </div>
          <div style={{ background: 'var(--bg-card-secondary)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9.5px', fontWeight: 700 }}>SPEECH REGION</span>
            <span style={{ fontWeight: 700, color: 'var(--emerald-700)' }}>Central India (Neural)</span>
          </div>
        </div>
      </div>

      {/* Accessibility Controls */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
          Accessibility & Display
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
          {/* Dark Mode */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-card-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {theme === 'dark' ? <Moon size={15} color="var(--brand-500)" /> : <Sun size={15} color="var(--amber-500)" />}
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Dark Theme</span>
            </div>
            <button 
              role="switch" 
              aria-checked={theme === 'dark'} 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{ width: '36px', height: '20px', background: theme === 'dark' ? 'var(--brand-600)' : 'var(--slate-300)', borderRadius: '9999px', border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <span style={{ display: 'block', width: '16px', height: '16px', background: 'white', borderRadius: '50%', transform: theme === 'dark' ? 'translateX(18px)' : 'translateX(2px)', transition: 'transform 0.2s' }}></span>
            </button>
          </div>

          {/* Large Text */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-card-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Large Text Mode (115%)</span>
            <button 
              role="switch" 
              aria-checked={largeText} 
              onClick={() => setLargeText(!largeText)}
              style={{ width: '36px', height: '20px', background: largeText ? 'var(--brand-600)' : 'var(--slate-300)', borderRadius: '9999px', border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <span style={{ display: 'block', width: '16px', height: '16px', background: 'white', borderRadius: '50%', transform: largeText ? 'translateX(18px)' : 'translateX(2px)', transition: 'transform 0.2s' }}></span>
            </button>
          </div>
          
          {/* High Contrast AAA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-card-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>High Contrast Mode (AAA)</span>
            <button 
              role="switch" 
              aria-checked={highContrast} 
              onClick={() => setHighContrast(!highContrast)}
              style={{ width: '36px', height: '20px', background: highContrast ? 'var(--brand-600)' : 'var(--slate-300)', borderRadius: '9999px', border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <span style={{ display: 'block', width: '16px', height: '16px', background: 'white', borderRadius: '50%', transform: highContrast ? 'translateX(18px)' : 'translateX(2px)', transition: 'transform 0.2s' }}></span>
            </button>
          </div>
        </div>
      </div>

      {/* Voice Preferences */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3 style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
          Azure Neural Voice Settings
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
          <div>
            <label style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Neural Voice Model</label>
            <select 
              value={selectedVoice} 
              onChange={(e) => setSelectedVoice(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', outline: 'none' }}
            >
              <option value="en-US-JennyNeural">Jenny (Neural - US Natural)</option>
              <option value="en-US-GuyNeural">Guy (Neural - US Male)</option>
              <option value="en-US-AriaNeural">Aria (Neural - Expressive)</option>
              <option value="en-IN-NeerjaNeural">Neerja (Neural - Indian English)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Cheatsheet */}
      <div style={{ background: 'var(--slate-900)', color: 'white', padding: '12px 14px', borderRadius: '12px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: 'var(--brand-200)' }}>
          <Command size={14} />
          <span>Keyboard Shortcuts</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-300)', marginTop: '2px' }}>
          <span>Toggle Microphone</span>
          <kbd style={{ padding: '1px 5px', background: 'var(--slate-800)', border: '1px solid var(--slate-700)', borderRadius: '4px', fontFamily: 'monospace' }}>Alt + V</kbd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-300)' }}>
          <span>Navigate Tabs (Dashboard / Docs / History / Settings)</span>
          <kbd style={{ padding: '1px 5px', background: 'var(--slate-800)', border: '1px solid var(--slate-700)', borderRadius: '4px', fontFamily: 'monospace' }}>Alt + 1-4</kbd>
        </div>
      </div>
    </section>
  );
}
