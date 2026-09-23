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
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Preferences & Diagnostics</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Configure accessibility, voices & Azure connection</p>
        </div>
        <button 
          onClick={checkHealth}
          className="btn-secondary"
          disabled={isChecking}
        >
          <RefreshCw size={14} className={isChecking ? 'status-dot animate' : ''} />
          <span>Ping API</span>
        </button>
      </div>

      {/* Backend & Azure AI Status Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="var(--aurora-cyan)" />
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Azure AI & Speech Status</span>
          </div>
          {backendHealth?.status === 'healthy' ? (
            <span style={{ fontSize: '11px', color: 'var(--aurora-emerald)', fontWeight: 700, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={14} /> Connected {pingLatency ? `(${pingLatency}ms)` : ''}
            </span>
          ) : (
            <span style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 700, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={14} /> {backendHealth?.status === 'degraded' ? 'Degraded config' : 'Offline'}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', fontFamily: 'monospace', fontWeight: 700 }}>LLM MODEL</span>
            <span style={{ fontWeight: 700, color: 'var(--aurora-cyan)' }}>Azure GPT-4.1-mini</span>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', fontFamily: 'monospace', fontWeight: 700 }}>SPEECH REGION</span>
            <span style={{ fontWeight: 700, color: 'var(--aurora-emerald)' }}>Central India (Neural)</span>
          </div>
        </div>
      </div>

      {/* Accessibility Controls */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'monospace', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
          Accessibility & Display
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
          {/* Large Text */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-glass)', borderRadius: '12px' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Large Text Mode (115%)</span>
            <button 
              role="switch" 
              aria-checked={largeText} 
              onClick={() => setLargeText(!largeText)}
              style={{ width: '42px', height: '24px', background: largeText ? 'var(--aurora-emerald)' : 'rgba(15, 23, 42, 0.2)', borderRadius: '9999px', border: '1px solid var(--border-glass)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <span style={{ display: 'block', width: '18px', height: '18px', background: largeText ? '#0b0e14' : '#ffffff', borderRadius: '50%', transform: largeText ? 'translateX(20px)' : 'translateX(2px)', transition: 'transform 0.2s' }}></span>
            </button>
          </div>
        </div>
      </div>

      {/* Voice Preferences */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'monospace', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
          Azure Neural Voice Settings
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
          <div>
            <label style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Neural Voice Model</label>
            <select 
              value={selectedVoice} 
              onChange={(e) => setSelectedVoice(e.target.value)}
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
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: 'var(--aurora-cyan)', fontSize: '13px' }}>
          <Command size={16} />
          <span>Keyboard Shortcuts</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px' }}>
          <span>Toggle Microphone</span>
          <kbd style={{ padding: '2px 7px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid var(--border-glass)', borderRadius: '6px', fontFamily: 'monospace', color: 'var(--aurora-cyan)' }}>Alt + V</kbd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px' }}>
          <span>Navigate Tabs (Dashboard / Docs / History / Settings)</span>
          <kbd style={{ padding: '2px 7px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid var(--border-glass)', borderRadius: '6px', fontFamily: 'monospace', color: 'var(--aurora-cyan)' }}>Alt + 1-4</kbd>
        </div>
      </div>
    </section>
  );
}
