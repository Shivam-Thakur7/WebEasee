import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Globe, 
  Volume2, 
  FileText, 
  Send, 
  Play, 
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Search as SearchIcon,
  ArrowUpRight,
  Waves,
  Cpu,
  Activity
} from 'lucide-react';
import { convertWebmToWavBlob } from '../../utils/audio';
import Strands from '../Strands';

const BACKEND_URL = 'http://127.0.0.1:8000';

export default function Dashboard({ onNavigate, onCreateDoc, backendHealthy = false }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveSpeech, setLiveSpeech] = useState("");
  const [statusMessage, setStatusMessage] = useState("Click mic or type a command to begin");
  const [textInput, setTextInput] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [micError, setMicError] = useState(false);

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
    setStatusMessage("Analyzing command with Azure AI Foundry...");

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
      {/* Concept 4: Frosted Glass Aurora Hero Stage */}
      <div className="aurora-hero-stage">


        {/* 3D Flowing Strands Background & Mic Button */}
        <div 
          style={{ width: '100%', height: '300px', position: 'relative', cursor: 'pointer', zIndex: 2, overflow: 'hidden', borderRadius: '20px' }}
          onClick={handleMicClick}
          id="main-mic-button"
          title={isListening ? "Stop listening" : "Click to speak"}
        >
          <Strands
            colors={["#a1ff12","#7C3AED","#06B6D4"]}
            count={3}
            speed={0.5}
            amplitude={1}
            waviness={1}
            thickness={0.7}
            glow={2.6}
            taper={3}
            spread={1}
            intensity={0.6}
            saturation={1.5}
            opacity={1}
            scale={1.5}
            glass={false}
            refraction={1}
            dispersion={1}
            glassSize={1}
          />
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 10,
            textAlign: 'center'
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: isListening ? '#ef4444' : 'rgba(255,255,255,0.85)',
              textShadow: isListening
                ? '0 0 18px rgba(239,68,68,0.9), 0 2px 6px rgba(0,0,0,0.7)'
                : '0 0 18px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.7)',
              transition: 'color 0.3s ease, text-shadow 0.3s ease'
            }}>
              {isListening ? "● LISTENING" : "TAP TO SPEAK"}
            </span>
          </div>
        </div>

        <h1 className="aurora-hero-title">
          WebEase
        </h1>

        <p className="aurora-hero-sub">
          Your AI Voice Assistant for the Web. Speak to navigate DOM elements, generate documents, read pages aloud, and run automated browser tasks.
        </p>

        {/* Translucent Capsule Bar */}
        <form onSubmit={handleFormSubmit} className="aurora-command-bar">
          <Sparkles size={18} color="var(--aurora-emerald)" />
          <input
            type="text"
            placeholder={isListening ? "Listening to your voice..." : "Speak or type a voice command..."}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
          <button type="submit" className="aurora-submit-btn" disabled={isProcessing}>
            <span>Submit</span>
            <ArrowUpRight size={15} />
          </button>
        </form>

        {micError && typeof chrome !== 'undefined' && chrome.runtime && (
          <button className="btn-secondary" style={{ marginTop: '16px', position: 'relative', zIndex: 3 }} onClick={() => window.open(chrome.runtime.getURL('index.html'), '_blank')}>
            Grant Mic Access in New Tab
          </button>
        )}
      </div>

      {/* Floating Glass Cards Grid */}
      <div className="aurora-cards-grid">
        <div className="aurora-glass-card">
          <span>LIVE TRANSCRIPT</span>
          <strong>{liveSpeech || (isListening ? 'Listening...' : 'Say "Hey WebEase"')}</strong>
        </div>

        <div className="aurora-glass-card">
          <span>PARSED INTENT</span>
          <strong>{lastResult?.tool ? `Intent: ${lastResult.tool}` : 'Ready for intent recognition'}</strong>
        </div>

        <div className="aurora-glass-card">
          <span>AI STATUS</span>
          <strong style={{ color: backendHealthy ? 'var(--aurora-emerald)' : '#fca5a5' }}>
            {backendHealthy ? 'Azure AI Online (Ultra-Low Latency)' : 'Backend Offline'}
          </strong>
        </div>
      </div>

      {/* Floating Bottom Action Dock */}
      <div className="aurora-dock">
        <button type="button" className="dock-pill" onClick={() => executeTextCommand("Open YouTube")}>
          <Play size={15} fill="currentColor" /> Open YouTube <ArrowUpRight size={13} />
        </button>
        <button type="button" className="dock-pill" onClick={() => executeTextCommand("Read this page")}>
          <Volume2 size={15} /> Read Page <ArrowUpRight size={13} />
        </button>
        <button type="button" className="dock-pill" onClick={() => onCreateDoc && onCreateDoc("Draft a summary of web accessibility standards.")}>
          <FileText size={15} /> Create Doc <ArrowUpRight size={13} />
        </button>
        <button type="button" className="dock-pill" onClick={() => executeTextCommand("Summarize this tab")}>
          <Sparkles size={15} /> Summarize Tab <ArrowUpRight size={13} />
        </button>
        <button type="button" className="dock-pill" onClick={() => executeTextCommand("Search for Web Accessibility Standards")}>
          <SearchIcon size={15} /> Search Web <ArrowUpRight size={13} />
        </button>
      </div>

      {/* Last Result & AI Response Card */}
      {lastResult && (
        <div className="ai-output-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="var(--aurora-emerald)" />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>Last Action Executed</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="tool-badge">
                {lastResult.tool || 'Clarification'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {lastResult.timestamp}
              </span>
            </div>
          </div>

          <div style={{ fontSize: '14px', color: '#ffffff', lineHeight: 1.4 }}>
            <strong>Recognized:</strong> "{lastResult.command}"
          </div>

          {lastResult.responseText && (
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '12px 16px', 
              borderRadius: '16px', 
              border: '1px solid var(--border-glass)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: '8px'
            }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
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
        </div>
      )}
    </section>
  );
}
