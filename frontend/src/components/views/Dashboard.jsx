import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Globe, 
  Volume2, 
  FileText, 
  Send, 
  Play, 
  Pause, 
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Search as SearchIcon,
  ExternalLink
} from 'lucide-react';
import { convertWebmToWavBlob } from '../../utils/audio';

const BACKEND_URL = 'http://127.0.0.1:8000';

export default function Dashboard({ onNavigate, onCreateDoc }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveSpeech, setLiveSpeech] = useState("");
  const [statusMessage, setStatusMessage] = useState("Click mic or type a command to begin");
  const [textInput, setTextInput] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);

  // Listen for rerun commands triggered from History tab
  useEffect(() => {
    const handleRerun = (e) => {
      if (e.detail) {
        executeTextCommand(e.detail);
      }
    };
    window.addEventListener('webease-rerun-command', handleRerun);
    return () => window.removeEventListener('webease-rerun-command', handleRerun);
  }, []);

  // Play spoken response via Azure TTS
  const playTTS = async (text) => {
    if (!text) return;
    try {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setIsPlayingAudio(true);

      const formData = new FormData();
      formData.append('text', text);
      const res = await fetch(`${BACKEND_URL}/voice/speak`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioPlayerRef.current = audio;

      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      audio.play();
    } catch (e) {
      console.error('Error playing TTS:', e);
      setIsPlayingAudio(false);
    }
  };

  // Perform browser action on website (or pass to extension if available)
  const performAction = (tool, args, responseText) => {
    // 1. If in Chrome Extension environment, message content script
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          type: 'EXECUTE_IN_TAB',
          tool: tool,
          args: args || {}
        });
      } catch (err) {
        console.log("Extension message error:", err);
      }
    }

    // 2. Browser fallback for web dashboard (localhost:5174)
    if (tool === 'open_url' && args?.url) {
      let targetUrl = args.url;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }
      window.open(targetUrl, '_blank');
    } else if (tool === 'search' && args?.query) {
      if (args.site === 'youtube') {
        window.open(`https://duckduckgo.com/?q=!yt+${encodeURIComponent(args.query)}`, '_blank');
      } else {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(args.query)}`, '_blank');
      }
    } else if (tool === 'play_video' && args?.query) {
      window.open(`https://duckduckgo.com/?q=!yt+${encodeURIComponent(args.query)}`, '_blank');
    } else if (tool === 'scroll') {
      const amount = args?.amount || 500;
      const direction = args?.direction === 'up' ? -amount : amount;
      window.scrollBy({ top: direction, behavior: 'smooth' });
    } else if (tool === 'generate_document') {
      const docPrompt = args?.title || args?.content || textInput || liveSpeech;
      if (onCreateDoc) onCreateDoc(docPrompt);
    }
  };

  // Process text command (via backend /commands/text)
  const executeTextCommand = async (commandText) => {
    if (!commandText.trim()) return;
    setIsProcessing(true);
    setLiveSpeech(commandText);
    setStatusMessage("Analyzing command with Azure AI Foundry (GPT-4.1 Mini)...");

    try {
      const res = await fetch(`${BACKEND_URL}/commands/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commandText, page_context: document.title || "WebEase Dashboard" })
      });

      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const data = await res.json();

      setLastResult({
        command: commandText,
        tool: data.tool,
        args: data.args || {},
        responseText: data.response_text || "Command executed.",
        status: data.status || "success",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      setStatusMessage("Command executed successfully.");
      performAction(data.tool, data.args, data.response_text);

      if (data.response_text) {
        await playTTS(data.response_text);
      }
    } catch (err) {
      console.error("Text command failed:", err);
      setStatusMessage("Error executing command. Is backend running?");
    } finally {
      setIsProcessing(false);
      setTextInput("");
    }
  };

  // Process recorded audio
  const processAudio = async (audioBlob) => {
    setIsProcessing(true);
    setStatusMessage("Transcribing speech with Azure Speech Services...");
    setLiveSpeech("Transcribing audio...");

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('page_context', document.title || "WebEase Voice");

      const res = await fetch(`${BACKEND_URL}/voice/process`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        let errDetail = `Speech processing error (${res.status})`;
        try {
          const errData = await res.json();
          if (errData.detail) errDetail = errData.detail;
        } catch (e) {}
        throw new Error(errDetail);
      }

      const data = await res.json();
      const transcribed = data.transcribed_text || "No speech recognized.";
      setLiveSpeech(transcribed);
      setStatusMessage("Processed by Azure AI Foundry");

      setLastResult({
        command: transcribed,
        tool: data.tool,
        args: data.args || {},
        responseText: data.response_text || "Command executed.",
        status: data.status || "success",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      performAction(data.tool, data.args, data.response_text);

      if (data.response_text) {
        await playTTS(data.response_text);
      }
    } catch (e) {
      console.error(e);
      setStatusMessage(e.message || "Error processing audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicError(false);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          const wavBlob = await convertWebmToWavBlob(webmBlob);
          processAudio(wavBlob);
        } catch (convertErr) {
          processAudio(webmBlob);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
      setIsProcessing(false);
      setLiveSpeech("");
      setStatusMessage("Listening... Speak your command clearly.");
    } catch (err) {
      console.error("Microphone error:", err);
      setMicError(true);
      setStatusMessage("Microphone access denied. Please grant permissions in a full tab.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  };

  const handleMicClick = () => {
    if (isListening) stopRecording();
    else startRecording();
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim()) {
      executeTextCommand(textInput);
    }
  };

  return (
    <section className="view-section">
      {/* Welcome Card */}
      <div className="welcome-card">
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>Voice Accessibility Control ⚡</h2>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px' }}>
            Control browser, navigate pages, and create documents via voice.
          </p>
        </div>
      </div>

      {/* Hero Voice Mic & Input Area */}
      <div className="mic-card">
        <div className="mic-btn-container">
          {isListening && (
            <>
              <div className="pulse-ring"></div>
              <div className="pulse-ring pulse-ring-2"></div>
            </>
          )}
          <button 
            id="main-mic-button" 
            className={`main-mic-btn ${isListening ? 'listening' : ''}`}
            aria-label={isListening ? "Stop listening" : "Start listening"}
            title={isListening ? "Click to stop listening" : "Click to speak"}
            onClick={handleMicClick}
          >
            <Mic size={28} strokeWidth={2.5} />
          </button>
        </div>

        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {isListening ? "Listening to your voice..." : isProcessing ? "Processing with Azure AI..." : "Click to Speak"}
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px' }}>
            {statusMessage}
          </p>
          {micError && typeof chrome !== 'undefined' && chrome.runtime && (
            <button 
              onClick={() => window.open(chrome.runtime.getURL('index.html'), '_blank')}
              style={{ marginTop: '10px', fontSize: '12px', padding: '6px 12px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Grant Mic Access in New Tab
            </button>
          )}
        </div>

        {/* Audio Wave Visualizer while listening or playing */}
        {(isListening || isPlayingAudio) && (
          <div className="audio-equalizer" aria-hidden="true">
            <div className="audio-bar"></div>
            <div className="audio-bar"></div>
            <div className="audio-bar"></div>
            <div className="audio-bar"></div>
            <div className="audio-bar"></div>
            <div className="audio-bar"></div>
          </div>
        )}

        {/* Live speech transcription display */}
        {liveSpeech && (
          <div className="live-speech-box">
            <Sparkles size={16} color="var(--brand-500)" />
            <span>"{liveSpeech}"</span>
          </div>
        )}

        {/* Text Command Input */}
        <form onSubmit={handleFormSubmit} className="command-input-form">
          <input 
            type="text" 
            placeholder="Type a voice command (e.g. 'open youtube', 'scroll down 500px')..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
          <button type="submit" className="send-btn" disabled={isProcessing}>
            <Send size={13} />
            <span>Send</span>
          </button>
        </form>

        {/* Clickable Quick Prompt Pills */}
        <div className="prompt-group">
          <span style={{ fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', width: '100%', textAlign: 'center' }}>
            Try Instant Commands
          </span>
          <button type="button" className="prompt-pill" onClick={() => executeTextCommand("Open YouTube")}>
            "Open YouTube"
          </button>
          <button type="button" className="prompt-pill" onClick={() => executeTextCommand("Play Despacito on YouTube")}>
            "Play Despacito"
          </button>
          <button type="button" className="prompt-pill" onClick={() => executeTextCommand("Scroll down by 500 pixels")}>
            "Scroll down"
          </button>
          <button type="button" className="prompt-pill" onClick={() => executeTextCommand("Search for Web Accessibility Standards")}>
            "Search Web"
          </button>
          <button type="button" className="prompt-pill" onClick={() => executeTextCommand("Read this page")}>
            "Read page"
          </button>
          <button type="button" className="prompt-pill" onClick={() => {
            if (onCreateDoc) onCreateDoc("Draft a complete summary of modern accessibility standards.");
          }}>
            "Create Doc"
          </button>
        </div>
      </div>

      {/* Last Result & AI Response Card */}
      {lastResult && (
        <div className="ai-output-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="var(--emerald-600)" />
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)' }}>Last Action Executed</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`tool-badge ${lastResult.tool || 'clarify'}`}>
                {lastResult.tool || 'Clarification'}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {lastResult.timestamp}
              </span>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
            <strong>Recognized:</strong> "{lastResult.command}"
          </div>

          {lastResult.responseText && (
            <div style={{ 
              background: 'var(--bg-card-secondary)', 
              padding: '8px 12px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: '8px'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                💬 "{lastResult.responseText}"
              </div>
              <button 
                className="tool-btn" 
                title="Replay Voice"
                onClick={() => playTTS(lastResult.responseText)}
              >
                <Volume2 size={14} />
              </button>
            </div>
          )}

          {lastResult.args && Object.keys(lastResult.args).length > 0 && (
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontFamily: 'monospace', background: 'rgba(0,0,0,0.03)', padding: '4px 8px', borderRadius: '4px' }}>
              Parameters: {JSON.stringify(lastResult.args)}
            </div>
          )}
        </div>
      )}

      {/* Quick Action Navigation Grid */}
      <div className="quick-actions-grid">
        <button 
          onClick={() => executeTextCommand("Search latest news")} 
          className="quick-action-card"
        >
          <div className="action-icon-box icon-blue"><Globe size={20} /></div>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Browse</span>
        </button>

        <button 
          onClick={() => executeTextCommand("Read this page")} 
          className="quick-action-card"
        >
          <div className="action-icon-box icon-green"><Volume2 size={20} /></div>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Read Aloud</span>
        </button>

        <button 
          onClick={() => onNavigate('documents')} 
          className="quick-action-card"
        >
          <div className="action-icon-box icon-amber"><FileText size={20} /></div>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Create Doc</span>
        </button>
      </div>
    </section>
  );
}
