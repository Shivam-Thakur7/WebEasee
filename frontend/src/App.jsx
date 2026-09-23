import React, { useState, useEffect } from 'react';
import logoSrc from './assets/logo.png';
import { 
  Contrast, 
  Type, 
  Moon,
  Sun,
  LayoutDashboard, 
  FileText, 
  History as HistoryIcon, 
  Settings as SettingsIcon,
  ArrowUpRight,
  Waves,
  Mic
} from 'lucide-react';

import Dashboard from './components/views/Dashboard';
import Documents from './components/views/Documents';
import History from './components/views/History';
import Settings from './components/views/Settings';

function FloatingMic({ visible }) {
  const [micState, setMicState] = useState({
    isListening: false,
    isProcessing: false,
    statusMessage: '',
    micError: false,
    liveSpeech: ''
  });

  useEffect(() => {
    const handleStateUpdate = (e) => setMicState(e.detail);
    window.addEventListener('webease-mic-state', handleStateUpdate);
    return () => window.removeEventListener('webease-mic-state', handleStateUpdate);
  }, []);

  if (!visible) return null;

  return (
    <div 
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px'
      }}
    >
      {micState.statusMessage && (
        <div style={{
          background: 'rgba(0,0,0,0.75)',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '12px',
          fontSize: '11px',
          maxWidth: '200px',
          textAlign: 'right',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {micState.statusMessage}
        </div>
      )}
      
      <div style={{ position: 'relative' }}>
        {micState.isListening && (
          <>
            <div className="pulse-ring pulse-ring-1"></div>
            <div className="pulse-ring pulse-ring-2"></div>
          </>
        )}
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('webease-toggle-mic'))}
          className={`main-mic-btn ${micState.isListening ? 'listening' : ''} ${micState.micError ? 'error' : ''}`}
          style={{ 
            width: '56px', height: '56px', 
            borderRadius: '50%',
            boxShadow: micState.isListening ? '0 4px 20px rgba(239, 68, 68, 0.4)' : '0 4px 15px rgba(0,0,0,0.3)',
            backgroundColor: micState.isListening ? '#ef4444' : 'var(--bg-dark-card)',
            color: micState.isListening ? '#ffffff' : 'var(--text-primary)',
            border: micState.isListening ? 'none' : '1px solid var(--border-glass)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          title="Toggle Global Microphone"
        >
          <Mic size={24} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [backendHealthy, setBackendHealthy] = useState(true);
  const [docInitialPrompt, setDocInitialPrompt] = useState('');

  // Apply Large Text
  useEffect(() => {
    if (largeText) document.documentElement.classList.add('large-text');
    else document.documentElement.classList.remove('large-text');
  }, [largeText]);

  // Apply High Contrast
  useEffect(() => {
    if (highContrast) document.documentElement.classList.add('high-contrast');
    else document.documentElement.classList.remove('high-contrast');
  }, [highContrast]);

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Check Backend Health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/health');
        if (res.ok) setBackendHealthy(true);
        else setBackendHealthy(false);
      } catch (e) {
        setBackendHealthy(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        const mainMicBtn = document.getElementById('main-mic-button');
        if (mainMicBtn) mainMicBtn.click();
      }
      if (e.altKey && e.key === '1') setCurrentView('dashboard');
      if (e.altKey && e.key === '2') setCurrentView('documents');
      if (e.altKey && e.key === '3') setCurrentView('history');
      if (e.altKey && e.key === '4') setCurrentView('settings');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateDoc = (promptText = '') => {
    setDocInitialPrompt(promptText);
    setCurrentView('documents');
  };

  const handleMicTrigger = () => {
    setCurrentView('dashboard');
    setTimeout(() => {
      const mainMicBtn = document.getElementById('main-mic-button');
      if (mainMicBtn) mainMicBtn.click();
    }, 100);
  };

  return (
    <div className="app-shell">
      <div id="extension-container">
        <div id="sr-announcer" className="sr-only" aria-live="polite" aria-atomic="true"></div>

        {/* Side-Panel Optimized Header */}
        <header>
          <div className="brand-lockup">
            <img 
              src={logoSrc} 
              alt="WebEase Logo" 
              style={{ 
                width: '32px', 
                height: '32px', 
                objectFit: 'contain',
                flexShrink: 0,
                filter: 'invert(1)'
              }} 
            />
          </div>

          <div className="header-tools">
            {/* Live Azure Backend Indicator */}
            <div 
              className="status-badge-live" 
              title={backendHealthy ? "Backend connected (Azure AI + Speech)" : "Backend offline - Run uvicorn main:app"}
            >
              <div className="status-dot animate"></div>
              <span>AZURE ONLINE</span>
            </div>

            {/* Header Quick Voice Mic Trigger */}
            <button
              className="tool-btn"
              aria-label="Quick Voice Command"
              title="Click to Speak Voice Command"
              onClick={handleMicTrigger}
              style={{ color: 'var(--aurora-emerald)' }}
            >
              <Mic size={15} />
            </button>



            {/* Large Text Mode Toggle */}
            <button 
              id="toggle-large-text" 
              className={`tool-btn ${largeText ? 'active' : ''}`}
              aria-label="Toggle Large Text Typography Mode" 
              title={largeText ? "Large Text: ON (115%)" : "Large Text: OFF"}
              onClick={() => setLargeText(!largeText)}
            >
              <Type size={15} />
              {largeText && <span className="tool-btn-badge">+A</span>}
            </button>
          </div>
        </header>

        {/* Minimalist Navigation Bar */}
        <nav aria-label="Module Navigation">
          <button 
            onClick={() => setCurrentView('dashboard')} 
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard size={15} />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentView('documents')} 
            className={`nav-item ${currentView === 'documents' ? 'active' : ''}`}
          >
            <FileText size={15} />
            <span>Live Docs</span>
          </button>

          <button 
            onClick={() => setCurrentView('history')} 
            className={`nav-item ${currentView === 'history' ? 'active' : ''}`}
          >
            <HistoryIcon size={15} />
            <span>History</span>
          </button>

          <button 
            onClick={() => setCurrentView('settings')} 
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          >
            <SettingsIcon size={15} />
            <span>Settings</span>
          </button>
        </nav>

        {/* Main Body Content */}
        <div className="views-body" style={{ position: 'relative', paddingBottom: currentView !== 'dashboard' ? '80px' : '16px' }}>
          <div style={{ display: currentView === 'dashboard' ? 'block' : 'none' }}>
            <Dashboard 
              onNavigate={setCurrentView} 
              onCreateDoc={handleCreateDoc}
              backendHealthy={backendHealthy}
            />
          </div>
          {currentView === 'documents' && (
            <Documents initialPrompt={docInitialPrompt} />
          )}
          {currentView === 'history' && (
            <History onRerunCommand={(cmd) => {
              setCurrentView('dashboard');
              setTimeout(() => {
                const event = new CustomEvent('webease-rerun-command', { detail: cmd });
                window.dispatchEvent(event);
              }, 100);
            }} />
          )}
          {currentView === 'settings' && (
            <Settings 
              largeText={largeText} 
              setLargeText={setLargeText} 
              highContrast={highContrast} 
              setHighContrast={setHighContrast} 
              theme={theme}
              setTheme={setTheme}
            />
          )}

          <FloatingMic visible={currentView !== 'dashboard' && currentView !== 'history'} />
        </div>
      </div>
    </div>
  );
}
