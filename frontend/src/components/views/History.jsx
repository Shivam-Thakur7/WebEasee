import React, { useState, useEffect } from 'react';
import { Search, RotateCcw, Volume2, Trash2, CheckCircle2, Clock } from 'lucide-react';

const BACKEND_URL = 'http://127.0.0.1:8000';

export default function History({ onRerunCommand }) {
  const [search, setSearch] = useState('');
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const url = search.trim() 
        ? `${BACKEND_URL}/history/search?q=${encodeURIComponent(search)}`
        : `${BACKEND_URL}/history/?limit=50`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data.history || data.results || []);
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [search]);

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear all command history?")) {
      try {
        await fetch(`${BACKEND_URL}/history/`, { method: 'DELETE' });
        setHistoryItems([]);
      } catch (e) {
        console.error("Failed to clear history:", e);
      }
    }
  };

  const playTTS = async (text) => {
    if (!text) return;
    try {
      const formData = new FormData();
      formData.append('text', text);
      const res = await fetch(`${BACKEND_URL}/voice/speak`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const blob = await res.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        audio.play();
      }
    } catch (e) {
      console.error("TTS error:", e);
    }
  };

  return (
    <section className="view-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>Command History</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Log of voice & text actions</p>
        </div>
        <button 
          onClick={handleClearHistory}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '10.5px', color: '#dc2626' }}
        >
          <Trash2 size={12} />
          <span>Clear All</span>
        </button>
      </div>
      
      {/* Search Bar */}
      <div style={{ background: 'var(--bg-card)', padding: '6px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Search size={15} color="var(--text-muted)" />
        <input 
          type="text" 
          placeholder="Search past commands..." 
          style={{ border: 'none', background: 'transparent', padding: 0, width: '100%', outline: 'none', fontSize: '12px' }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      
      {/* History Items List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
          <table className="history-table">
            <tbody>
              {historyItems.map((item, index) => (
                <tr key={item.id || index}>
                  <td style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-muted)', width: '60px' }}>
                    {item.time_display || item.timestamp?.slice(11, 16) || "Recent"}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    <div>"{item.command}"</div>
                    {item.response && (
                      <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '2px' }}>
                        💬 {item.response}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      {item.tool && (
                        <span className={`tool-badge ${item.tool}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                          {item.tool}
                        </span>
                      )}
                      {item.response && (
                        <button 
                          className="tool-btn" 
                          style={{ width: '24px', height: '24px' }}
                          title="Replay Spoken Audio"
                          onClick={() => playTTS(item.response)}
                        >
                          <Volume2 size={12} />
                        </button>
                      )}
                      <button 
                        className="tool-btn" 
                        style={{ width: '24px', height: '24px' }}
                        title="Re-run Command"
                        onClick={() => onRerunCommand && onRerunCommand(item.command)}
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {historyItems.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {loading ? "Loading command log..." : "No past commands found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
