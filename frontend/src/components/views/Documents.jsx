import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Play, 
  Pause, 
  Square, 
  Download, 
  Copy, 
  Check, 
  Loader2, 
  Upload, 
  Volume2, 
  Sparkles 
} from 'lucide-react';

const BACKEND_URL = 'http://127.0.0.1:8000';

export default function Documents({ initialPrompt = '' }) {
  const [activeTab, setActiveTab] = useState('create');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Reader state
  const [readText, setReadText] = useState(
    "Artificial intelligence is transforming how people with physical disabilities interact with digital environments. By replacing mouse clicks and keyboard taps with intuitive voice commands, WebEase grants true digital independence."
  );
  const [readerSummary, setReaderSummary] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [audioObj, setAudioObj] = useState(null);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
      setActiveTab('create');
    }
  }, [initialPrompt]);

  // Listen for global tool commands
  useEffect(() => {
    const handleGenerate = (e) => {
      const args = e.detail;
      const text = args?.title || args?.content || prompt;
      if (text) {
        setPrompt(text);
        setActiveTab('create');
        setTimeout(() => {
          const genBtn = document.getElementById('generate-doc-btn');
          if (genBtn) genBtn.click();
        }, 100);
      }
    };
    const handleDownload = () => {
      const btn = document.getElementById('download-doc-btn');
      if (btn) btn.click();
    };
    const handleRead = () => {
      const btn = document.getElementById('read-doc-btn');
      if (btn) btn.click();
    };

    window.addEventListener('webease-tool-generate_document', handleGenerate);
    window.addEventListener('webease-tool-download_document', handleDownload);
    window.addEventListener('webease-tool-read_document', handleRead);

    return () => {
      window.removeEventListener('webease-tool-generate_document', handleGenerate);
      window.removeEventListener('webease-tool-download_document', handleDownload);
      window.removeEventListener('webease-tool-read_document', handleRead);
    };
  }, [prompt]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/documents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, read_aloud: false })
      });

      if (!res.ok) {
        throw new Error(`Failed to generate document (${res.status})`);
      }

      const data = await res.json();
      if (data.status === 'error') {
        throw new Error(data.detail || 'Generation error');
      }

      setGeneratedDoc({
        title: data.title || "AI_Overview.docx",
        filename: data.filename || "webease_doc.docx",
        content: data.content_preview || prompt,
        downloadUrl: `${BACKEND_URL}${data.download_url}`
      });
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Error generating document");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedDoc?.content) {
      navigator.clipboard.writeText(generatedDoc.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePlayTTS = async (textToSpeak) => {
    if (!textToSpeak) return;
    try {
      if (audioObj) {
        audioObj.pause();
      }
      setIsPlaying(true);
      const formData = new FormData();
      formData.append('text', textToSpeak);

      const res = await fetch(`${BACKEND_URL}/voice/speak`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('TTS error');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = speed;
      setAudioObj(audio);

      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      audio.play();
    } catch (e) {
      console.error("TTS playback error:", e);
      setIsPlaying(false);
    }
  };

  const handleStopTTS = () => {
    if (audioObj) {
      audioObj.pause();
      audioObj.currentTime = 0;
    }
    setIsPlaying(false);
  };

  // Automatically stop audio playback when switching tabs or unmounting
  useEffect(() => {
    const stopAudio = () => {
      handleStopTTS();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };

    window.addEventListener('webease-stop-all-audio', stopAudio);
    return () => {
      window.removeEventListener('webease-stop-all-audio', stopAudio);
      stopAudio();
    };
  }, [audioObj]);

  // Voice Command Event Listeners
  useEffect(() => {
    const handleVoiceGenerate = (e) => {
      const args = e.detail || {};
      const docPrompt = args.title || args.content || prompt;
      if (docPrompt && docPrompt !== prompt) {
        setPrompt(docPrompt);
      }
      setTimeout(() => {
        // Trigger handleGenerate by clicking the button to ensure state is fresh
        const genBtn = document.getElementById('generate-doc-btn');
        if (genBtn) genBtn.click();
      }, 50);
    };

    const handleVoiceDownload = () => {
      const dlBtn = document.getElementById('download-doc-btn');
      if (dlBtn) dlBtn.click();
    };

    const handleVoiceRead = () => {
      const readBtn = document.getElementById('read-doc-btn');
      if (readBtn) readBtn.click();
    };

    window.addEventListener('webease-tool-generate_document', handleVoiceGenerate);
    window.addEventListener('webease-tool-download_document', handleVoiceDownload);
    window.addEventListener('webease-tool-read_document', handleVoiceRead);
    
    return () => {
      window.removeEventListener('webease-tool-generate_document', handleVoiceGenerate);
      window.removeEventListener('webease-tool-download_document', handleVoiceDownload);
      window.removeEventListener('webease-tool-read_document', handleVoiceRead);
    };
  }, [prompt]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${BACKEND_URL}/documents/read?summarize=true`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Failed to read file');
      const data = await res.json();
      if (data.status === 'success') {
        setReadText(data.text || '');
        setReaderSummary(data.summary || '');
      } else {
        throw new Error(data.detail || 'Read error');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error processing uploaded docx');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="view-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>AI Document Studio</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Generate, summarize & speak documents</p>
        </div>
        <div className="tab-pills" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className={`tab-pill-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create
          </button>
          <button 
            className={`tab-pill-btn ${activeTab === 'read' ? 'active' : ''}`}
            onClick={() => setActiveTab('read')}
          >
            Read & Listen
          </button>
        </div>
      </div>

      {activeTab === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label htmlFor="doc-prompt-input" style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
              What document should Azure AI write?
            </label>
            <textarea 
              id="doc-prompt-input" 
              rows="4" 
              placeholder="e.g. Write a comprehensive guide on modern accessibility in web apps..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            ></textarea>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button 
                type="button"
                onClick={() => setPrompt('Write a 500-word article about artificial intelligence and voice computing.')} 
                className="prompt-pill"
              >
                "500w AI Article"
              </button>
              <button 
                type="button"
                onClick={() => setPrompt('Draft a summary of modern web accessibility (WCAG 2.1) guidelines.')} 
                className="prompt-pill"
              >
                "WCAG Accessibility Summary"
              </button>
              <button 
                type="button"
                onClick={() => setPrompt('Write a professional email requesting project status updates.')} 
                className="prompt-pill"
              >
                "Project Status Email"
              </button>
            </div>

            <button 
              id="generate-doc-btn"
              className="btn-primary" 
              onClick={handleGenerate} 
              disabled={isGenerating || !prompt.trim()}
              style={{ width: '100%' }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="status-dot animate" />
                  <span>Generating with GPT-4.1 Mini...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generate .DOCX Document</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}>
              {errorMsg}
            </div>
          )}
          
          {generatedDoc && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(32, 45, 68, 0.8)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} color="var(--neon-cyan)" />
                  <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>
                    {generatedDoc.title}
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={handleCopy}
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '11px' }}
                  >
                    {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  
                  <a 
                    id="download-doc-btn"
                    href={generatedDoc.downloadUrl} 
                    download={generatedDoc.filename}
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: '11px', textDecoration: 'none' }}
                  >
                    <Download size={14} />
                    <span>Download .docx</span>
                  </a>
                </div>
              </div>

              <div style={{ 
                fontSize: '13px', 
                color: 'var(--text-secondary)', 
                background: 'rgba(7, 9, 14, 0.8)', 
                padding: '14px', 
                borderRadius: '12px', 
                border: '1px solid rgba(32, 45, 68, 0.9)', 
                maxHeight: '220px', 
                overflowY: 'auto', 
                whiteSpace: 'pre-wrap', 
                lineHeight: 1.5 
              }}>
                {generatedDoc.content}
              </div>

              <button 
                id="read-doc-btn"
                className="btn-secondary"
                onClick={() => handlePlayTTS(generatedDoc.content)}
                style={{ alignSelf: 'flex-start' }}
              >
                <Volume2 size={15} color="var(--neon-cyan)" />
                <span>Read Generated Doc Aloud</span>
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'read' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* TTS Player Bar */}
          <div className="card" style={{ background: 'rgba(7, 9, 14, 0.85)', border: '1px solid rgba(0, 242, 254, 0.25)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neon-cyan)', textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                Azure Neural TTS Reader
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => handlePlayTTS(readText)}
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '11px' }}
                >
                  <Play size={14} fill="white" /> Play
                </button>
                <button 
                  onClick={handleStopTTS}
                  style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.3)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '10px', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '11px' }}
                >
                  <Square size={14} fill="#fca5a5" /> Stop
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', fontSize: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                  <span>Voice Playback Speed</span>
                  <span>{speed}x</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.0" 
                  step="0.25" 
                  value={speed} 
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  style={{ width: '100%', marginTop: '6px' }} 
                />
              </div>
            </div>
          </div>

          {/* Upload / Edit Text */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Document Content to Read</label>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--neon-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Upload size={14} />
                <span>Upload .docx</span>
                <input type="file" accept=".docx" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
            <textarea 
              rows="5" 
              value={readText}
              onChange={(e) => setReadText(e.target.value)}
              placeholder="Paste or type text to read aloud..."
            ></textarea>
          </div>

          {readerSummary && (
            <div className="card" style={{ background: 'rgba(0, 242, 254, 0.08)', borderColor: 'rgba(0, 242, 254, 0.3)' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--neon-cyan)', marginBottom: '6px', fontFamily: 'monospace' }}>AI Summary:</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{readerSummary}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
