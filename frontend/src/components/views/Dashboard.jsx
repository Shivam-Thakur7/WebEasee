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
  const wakeWordRecognizerRef = useRef(null);
  const audioContextRef = useRef(null);
  const silenceAnimRef = useRef(null);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);

  // Wake Word Engine
  useEffect(() => {
    if (!wakeWordEnabled || isListening || isProcessing) {
      if (wakeWordRecognizerRef.current) {
        wakeWordRecognizerRef.current.stop();
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported in this browser.");
      return;
    }

    const recognizer = new SpeechRecognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = 'en-US';

    recognizer.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase();
        if (event.results[i].isFinal) {
          if (transcript.includes('hello agent')) {
            recognizer.stop();
            startRecording();
            return;
          }
        } else {
          interimTranscript += transcript;
          if (interimTranscript.includes('hello agent')) {
            recognizer.stop();
            startRecording();
            return;
          }
        }
      }
    };

    recognizer.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.error("Wake word recognizer error:", event.error);
      }
    };

    recognizer.onend = () => {
      // Chrome stops the recognizer after silence. We must restart it immediately.
      if (wakeWordEnabled && !isListening && !isProcessing) {
        try {
          recognizer.start();
        } catch (e) {}
      }
    };

    try {
      recognizer.start();
      wakeWordRecognizerRef.current = recognizer;
    } catch (e) {
      // already started
    }

    // Backup watchdog just in case onend fails to fire
    const watchdog = setInterval(() => {
      if (wakeWordEnabled && !isListening && !isProcessing) {
        try {
          recognizer.start();
        } catch (e) {}
      }
    }, 5000);

    return () => {
      clearInterval(watchdog);
      recognizer.onend = null; // Prevent restart on unmount
      if (wakeWordRecognizerRef.current) wakeWordRecognizerRef.current.stop();
    };
  }, [wakeWordEnabled, isListening, isProcessing]);

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
  const performAction = (tool, args, responseText, commandText = "") => {
    
    const dashboardOnlyTools = ['generate_document', 'download_document', 'read_document', 'delete_history_item'];

    // 1. If in Chrome Extension environment and tool belongs to extension, message content script
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage && !dashboardOnlyTools.includes(tool)) {
      try {
        chrome.runtime.sendMessage({
          type: 'EXECUTE_IN_TAB',
          tool: tool,
          args: args || {}
        }, async (response) => {
          if (tool === 'summarize_page' && response && response.success && response.result) {
            try {
              // Extract the actual text from the deeply nested result object
              let pageText = response.result;
              while (typeof pageText === 'object' && pageText !== null) {
                pageText = pageText.text || pageText.result || "";
              }
              
              if (!pageText || typeof pageText !== 'string') {
                throw new Error("No text returned from page");
              }

              setStatusMessage("Generating page summary...");
              const res = await fetch(`${BACKEND_URL}/commands/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page_text: pageText })
              });
              const data = await res.json();
              if (data.status === 'success') {
                setLastResult(prev => ({ ...prev, responseText: data.summary }));
                playTTS(data.summary);
                setStatusMessage("Summary generated. Creating document...");
                
                // Directly generate document using the backend without polluting the top prompt area
                fetch(`${BACKEND_URL}/documents/generate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ prompt: `Webpage Summary:\n\n${data.summary}`, read_aloud: false })
                }).then(res => res.json()).then(docData => {
                  if (docData.status !== 'error') {
                    if (onCreateDoc) onCreateDoc(""); // Switch view
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('webease-tool-document_ready', { detail: docData }));
                    }, 200);
                  }
                  setStatusMessage("Document ready.");
                }).catch(err => {
                  console.error("Doc generation error:", err);
                  setStatusMessage("Summary generated, but doc failed.");
                });
              }
            } catch (err) {
              console.error("Summarize error:", err);
            }
          }
        });
        return; // Prevents executing the local browser fallback below!
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
    } else if (['generate_document', 'download_document', 'read_document', 'delete_history_item'].includes(tool)) {
      if (tool === 'generate_document') {
        const docPrompt = commandText || textInput || liveSpeech || args?.title || args?.content;
        if (onCreateDoc) onCreateDoc(docPrompt);
      }
      
      // Dispatch event for the active view to handle
      window.dispatchEvent(new CustomEvent(`webease-tool-${tool}`, { detail: args || {} }));
      return;
    } else if (tool === 'summarize_page') {
      try {
        setStatusMessage("Generating page summary locally...");
        const pageText = document.body?.innerText?.slice(0, 3000) || "";
        
        // Smart fallback: Prevent summarizing the dashboard itself if tested locally
        if (document.title.includes("WebEase") || pageText.includes("LIVE TRANSCRIPT")) {
           const fallbackMsg = "You are currently viewing the WebEase dashboard! To summarize an external website like Wikipedia, please run WebEase as a Chrome extension and open its side panel on the page you want to summarize.";
           setLastResult(prev => ({ ...prev, responseText: fallbackMsg }));
           playTTS(fallbackMsg);
           setStatusMessage("Extension mode required for external sites.");
           return;
        }

        fetch(`${BACKEND_URL}/commands/summarize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page_text: pageText })
        }).then(res => res.json()).then(data => {
          if (data.status === 'success') {
            setLastResult(prev => ({ ...prev, responseText: data.summary }));
            playTTS(data.summary);
            setStatusMessage("Summary generated. Creating document...");
            
            fetch(`${BACKEND_URL}/documents/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: `Webpage Summary:\n\n${data.summary}`, read_aloud: false })
            }).then(res => res.json()).then(docData => {
              if (docData.status !== 'error') {
                if (onCreateDoc) onCreateDoc(""); 
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('webease-tool-document_ready', { detail: docData }));
                }, 200);
              }
              setStatusMessage("Document ready.");
            }).catch(err => {
              console.error("Doc generation error:", err);
              setStatusMessage("Summary generated, but doc failed.");
            });
          }
        });
      } catch (err) {
        console.error("Local summarize error:", err);
      }
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
      performAction(data.tool, data.args, data.response_text, commandText);

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

      performAction(data.tool, data.args, data.response_text, transcribed);

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

      // Voice Activity Detection (Auto-stop on silence)
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 512;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let silenceStart = Date.now();
      let hasSpoken = false;

      const checkSilence = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
        
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / bufferLength;
        
        if (average > 10) { // Threshold for speech
          hasSpoken = true;
          silenceStart = Date.now();
        } else {
          // If they spoke, and now it's been silent for 1.5 seconds, stop recording
          if (hasSpoken && Date.now() - silenceStart > 1500) {
            stopRecording();
            return;
          }
          // Or if they didn't speak for 5 seconds, timeout
          if (!hasSpoken && Date.now() - silenceStart > 5000) {
            stopRecording();
            return;
          }
        }
        silenceAnimRef.current = requestAnimationFrame(checkSilence);
      };
      
      checkSilence();

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
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (silenceAnimRef.current) {
      cancelAnimationFrame(silenceAnimRef.current);
      silenceAnimRef.current = null;
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

  // Sync mic state to the global floating mic in App.jsx
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('webease-mic-state', {
      detail: { isListening, isProcessing, statusMessage, micError, liveSpeech }
    }));
  }, [isListening, isProcessing, statusMessage, micError, liveSpeech]);

  // Listen for global mic toggle events
  useEffect(() => {
    const handleToggle = () => handleMicClick();
    window.addEventListener('webease-toggle-mic', handleToggle);
    return () => window.removeEventListener('webease-toggle-mic', handleToggle);
  }, [isListening]); // React to isListening so handleMicClick has the right closure

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
            colors={isListening ? ["#ef4444", "#fb923c", "#f43f5e"] : ["#a1ff12","#7C3AED","#06B6D4"]}
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

      {/* Transcript and Response Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '700px', margin: '0 auto', zIndex: 10, position: 'relative' }}>
        {/* Live Transcript */}
        <div className="aurora-glass-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Live Transcript
            </span>
            <strong>{liveSpeech || (isListening ? 'Listening...' : 'Say "Hello Agent"')}</strong>
          </div>
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

            <div style={{ fontSize: '14px', color: '#ffffff', lineHeight: 1.4, marginTop: '12px' }}>
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
                gap: '8px',
                marginTop: '12px'
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

    </section>
  );
}
