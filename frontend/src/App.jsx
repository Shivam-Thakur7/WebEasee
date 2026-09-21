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
  Wifi,
  WifiOff
} from 'lucide-react';

import Dashboard from './components/views/Dashboard';
import Documents from './components/views/Documents';
import History from './components/views/History';
import Settings from './components/views/Settings';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [theme, setTheme] = useState('light');
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

            {/* High Contrast */}
            <button 
              id="toggle-contrast" 
              className="tool-btn" 
              aria-label="Toggle High Contrast Mode" 
              title="High Contrast"
              onClick={() => setHighContrast(!highContrast)}
            >
              <Contrast size={15} />
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
        <nav aria-label="Navigation">
          <button 
            onClick={() => setCurrentView('dashboard')} 
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>

          <button 
            onClick={() => setCurrentView('documents')} 
            className={`nav-item ${currentView === 'documents' ? 'active' : ''}`}
          >
            <FileText size={16} />
            <span>Docs</span>
          </button>

          <button 
            onClick={() => setCurrentView('history')} 
            className={`nav-item ${currentView === 'history' ? 'active' : ''}`}
          >
            <HistoryIcon size={16} />
            <span>History</span>
          </button>

          <button 
            onClick={() => setCurrentView('settings')} 
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          >
            <SettingsIcon size={16} />
            <span>Settings</span>
          </button>
        </nav>

        {/* Main Body Content */}
        <div className="views-body">
          {currentView === 'dashboard' && (
            <Dashboard 
              onNavigate={setCurrentView} 
              onCreateDoc={handleCreateDoc}
            />
          )}
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
        </div>
      </div>
    </div>
  );
}
