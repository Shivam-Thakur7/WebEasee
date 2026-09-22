import React, { useState, useEffect } from 'react';
import { User, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Profile() {
  const [preferences, setPreferences] = useState({
    name: '',
    disability: '',
    preferredSpeed: 'Normal',
    customNotes: ''
  });
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    // Load from local storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['userProfile'], (result) => {
        if (result.userProfile) {
          setPreferences(result.userProfile);
        }
      });
    } else {
      const saved = localStorage.getItem('userProfile');
      if (saved) setPreferences(JSON.parse(saved));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPreferences(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ userProfile: preferences }, () => {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(null), 3000);
      });
    } else {
      localStorage.setItem('userProfile', JSON.stringify(preferences));
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <section className="view-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>Onboarding Profile</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Personalize WebEase for your needs</p>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <User size={18} color="var(--brand-600)" />
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Personal Information</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Your Name</label>
          <input 
            type="text" 
            name="name"
            value={preferences.name} 
            onChange={handleChange}
            placeholder="e.g. Urvansh"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Accessibility Needs</label>
          <select 
            name="disability"
            value={preferences.disability} 
            onChange={handleChange}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
          >
            <option value="">Select an option (optional)</option>
            <option value="visual">Visual Impairment / Blindness</option>
            <option value="motor">Motor / Mobility Impairment</option>
            <option value="cognitive">Cognitive / Learning Disability</option>
            <option value="hearing">Hearing Impairment</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Voice Speed Preference</label>
          <select 
            name="preferredSpeed"
            value={preferences.preferredSpeed} 
            onChange={handleChange}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
          >
            <option value="Slow">Slow & Clear</option>
            <option value="Normal">Normal</option>
            <option value="Fast">Fast</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Custom Instructions for AI</label>
          <textarea 
            name="customNotes"
            value={preferences.customNotes} 
            onChange={handleChange}
            placeholder="e.g. Please explain things simply, or read out full URLs..."
            rows={3}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
          <button 
            onClick={handleSave}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Save size={14} />
            <span>Save Profile</span>
          </button>

          {saveStatus === 'success' && (
            <span style={{ fontSize: '11px', color: 'var(--emerald-600)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={14} /> Profile Saved
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
