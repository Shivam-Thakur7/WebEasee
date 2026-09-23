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

  // Voice Command Listener
  useEffect(() => {
    const handleVoiceDelete = async (e) => {
      const args = e.detail || {};
      const index = args.index || 0;
      
      // We need the current historyItems, so we use a functional update or rely on the fact that 
      // handleVoiceDelete is re-created with the latest historyItems.
      // But we can just use the state variable since it's in the dependency array.
      if (historyItems && historyItems.length > index) {
        const itemToDelete = historyItems[index];
        try {
          await fetch(`${BACKEND_URL}/history/${itemToDelete.id}`, { method: 'DELETE' });
          fetchHistory(); // refresh list
        } catch (err) {
          console.error("Failed to delete history via voice:", err);
        }
      } else if (historyItems.length === 0) {
        console.log("History is already empty");
      }
    };

    window.addEventListener('webease-tool-delete_history_item', handleVoiceDelete);
    return () => {
      window.removeEventListener('webease-tool-delete_history_item', handleVoiceDelete);
    };
  }, [historyItems]);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>Command History Log</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Audit log of voice & text actions</p>
        </div>
        <button 
          onClick={handleClearHistory}
          className="btn-secondary"
          style={{ padding: '5px 10px', fontSize: '11px', color: '#fca5a5' }}
        >
          <Trash2 size={13} />
          <span>Clear All</span>
        </button>
      </div>
      
      {/* Search Console Input */}
      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '8px 12px', borderRadius: '14px', border: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        <Search size={15} color="var(--aurora-emerald)" style={{ flexShrink: 0 }} />
        <input 
          type="text" 
          placeholder="Search past commands..." 
          style={{ border: 'none', background: 'transparent', padding: 0, width: '100%', outline: 'none', fontSize: '13px', color: '#ffffff' }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      
      {/* History Items List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', width: '100%' }}>
        <div style={{ maxHeight: '420px', overflowY: 'auto', overflowX: 'auto', width: '100%' }}>
          <table className="history-table" style={{ width: '100%' }}>
            <tbody>
              {historyItems.map((item, index) => (
                <tr key={item.id || index}>
                  <td style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-muted)', width: '60px', flexShrink: 0 }}>
                    {item.time_display || item.timestamp?.slice(11, 16) || "Recent"}
                  </td>
                  <td style={{ fontWeight: 700, color: '#ffffff', wordBreak: 'break-word' }}>
                    <div>"{item.command}"</div>
                    {item.response && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '3px', fontStyle: 'italic' }}>
                        💬 {item.response}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '90px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      {item.tool && (
                        <span className="tool-badge" style={{ fontSize: '9px', padding: '1px 5px' }}>
                          {item.tool}
                        </span>
                      )}
                      {item.response && (
                        <button 
                          className="tool-btn" 
                          style={{ width: '26px', height: '26px' }}
                          title="Replay Spoken Audio"
                          onClick={() => playTTS(item.response)}
                        >
                          <Volume2 size={12} />
                        </button>
                      )}
                      <button 
                        className="tool-btn" 
                        style={{ width: '26px', height: '26px' }}
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
                  <td colSpan="3" style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '12px' }}>
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
