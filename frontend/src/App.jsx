import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Contrast, 
  Type, 
  Moon,
  Sun, 
  LayoutDashboard, 
  FileText, 
  History as HistoryIcon, 
  Settings as SettingsIcon,
  User as UserIcon,
  Mic
} from 'lucide-react';

import Dashboard from './components/views/Dashboard';
import Documents from './components/views/Documents';
import History from './components/views/History';
import Settings from './components/views/Settings';
import Profile from './components/views/Profile';

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
            width: '48px', height: '48px', 
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            margin: 0 // override margin from main-mic-btn class if any
          }}
          title="Toggle Global Microphone"
        >
          <div className="mic-icon-wrapper" style={{ transform: 'scale(0.8)' }}>
            <Mic size={24} strokeWidth={2.5} />
          </div>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [largeText, setLargeText] = useState(false);
  const [theme, setTheme] = useState('light');
  const [backendHealthy, setBackendHealthy] = useState(true);
  const [docInitialPrompt, setDocInitialPrompt] = useState('');

  // Apply Large Text
  useEffect(() => {
    if (largeText) document.documentElement.classList.add('large-text');
    else document.documentElement.classList.remove('large-text');
  }, [largeText]);

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Stop any playing audio / speech synthesis whenever user switches views
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('webease-stop-all-audio'));
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [currentView]);

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
      if (e.altKey && e.key === '5') setCurrentView('profile');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateDoc = (promptText = '') => {
    setDocInitialPrompt(promptText);
    setCurrentView('documents');
  };

  return (
    <div className="app-shell">
      <div id="extension-container">
        <div id="sr-announcer" className="sr-only" aria-live="polite" aria-atomic="true"></div>

        {/* Header Bar */}
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="logo-box">
              <Activity style={{ width: '18px', height: '18px' }} strokeWidth={2.5} />
            </div>
            <div>
              <div className="logo-title">
                WebEase
                <span className="version-badge">v2.4 AI</span>
              </div>
              <div className="logo-subtitle">Accessibility Assistant</div>
            </div>
          </div>

          <div className="header-tools">
            {/* Live Backend Indicator */}
            <div 
              className="status-badge-live" 
              title={backendHealthy ? "Backend connected (Azure AI + Speech)" : "Backend offline - Run uvicorn main:app"}
              style={{
                backgroundColor: backendHealthy ? 'var(--emerald-50)' : '#fef2f2',
                borderColor: backendHealthy ? 'var(--emerald-200)' : '#fecaca',
                color: backendHealthy ? 'var(--emerald-700)' : '#b91c1c'
              }}
            >
              <div className={`status-dot ${backendHealthy ? 'animate' : ''}`} style={{ backgroundColor: backendHealthy ? 'var(--emerald-500)' : '#ef4444' }}></div>
              <span>{backendHealthy ? 'Azure AI Online' : 'Offline'}</span>
            </div>

            {/* Dark / Light Toggle */}
            <button 
              className="tool-btn" 
              aria-label="Toggle Dark Mode" 
              title="Toggle Dark Mode"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>



            {/* Large Text */}
            <button 
              id="toggle-large-text" 
              className="tool-btn" 
              aria-label="Toggle Large Text Mode" 
              title="Large Text"
              onClick={() => setLargeText(!largeText)}
            >
              <Type size={15} />
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav aria-label="Navigation" style={{ display: 'flex', justifyContent: 'space-around' }}>
          <button 
            onClick={() => setCurrentView('dashboard')} 
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            title="Dashboard (Alt+1)"
          >
            <LayoutDashboard size={16} />
          </button>

          <button 
            onClick={() => setCurrentView('documents')} 
            className={`nav-item ${currentView === 'documents' ? 'active' : ''}`}
            title="Docs (Alt+2)"
          >
            <FileText size={16} />
          </button>

          <button 
            onClick={() => setCurrentView('history')} 
            className={`nav-item ${currentView === 'history' ? 'active' : ''}`}
            title="History (Alt+3)"
          >
            <HistoryIcon size={16} />
          </button>

          <button 
            onClick={() => setCurrentView('profile')} 
            className={`nav-item ${currentView === 'profile' ? 'active' : ''}`}
            title="Profile (Alt+5)"
          >
            <UserIcon size={16} />
          </button>

          <button 
            onClick={() => setCurrentView('settings')} 
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            title="Settings (Alt+4)"
          >
            <SettingsIcon size={16} />
          </button>
        </nav>

        {/* Main Body Content */}
        <div className="views-body" style={{ position: 'relative', paddingBottom: currentView !== 'dashboard' ? '80px' : '16px' }}>
          <div style={{ display: currentView === 'dashboard' ? 'block' : 'none', height: '100%' }}>
            <Dashboard 
              onNavigate={setCurrentView} 
              onCreateDoc={handleCreateDoc}
              onToggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              onToggleLargeText={() => setLargeText(prev => !prev)}
            />
          </div>
          {currentView === 'documents' && (
            <Documents 
              initialPrompt={docInitialPrompt} 
            />
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
          {currentView === 'profile' && (
            <Profile />
          )}
          {currentView === 'settings' && (
            <Settings 
              largeText={largeText} 
              setLargeText={setLargeText} 
              theme={theme}
              setTheme={setTheme}
            />
          )}

          <FloatingMic visible={currentView !== 'dashboard'} />
        </div>
      </div>
    </div>
  );
}
