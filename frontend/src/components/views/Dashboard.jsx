import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  ExternalLink,
  Radio
} from 'lucide-react';
import { convertWebmToWavBlob } from '../../utils/audio';

const BACKEND_URL = 'http://127.0.0.1:8000';

// Robust wake word and inline command parser
function parseWakeWordAndCommand(rawText) {
  if (!rawText) return { isWake: false, command: '' };
  // Strip punctuation, symbols, extra spaces
  const clean = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  // Match wake phrases (handles misrecognitions like 'agency', 'asian', 'urgent')
  const wakeRegex = /\b(?:hello|hey|hi|helo)\s+(?:agent|agents|agency|asian|urgent)\b\s*(.*)/i;
  const match = clean.match(wakeRegex);
  if (match) {
    return { isWake: true, command: match[1]?.trim() || '' };
  }
  return { isWake: false, command: '' };
}

export default function Dashboard({ 
  onNavigate, 
  onCreateDoc, 
  onToggleTheme, 
  onToggleLargeText, 
  onToggleHighContrast 
}) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveSpeech, setLiveSpeech] = useState("");
  const [statusMessage, setStatusMessage] = useState("Say \"Hello Agent\" or click mic to begin");
  const [textInput, setTextInput] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [micError, setMicError] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [handsFreeMode, setHandsFreeMode] = useState(true);

  // Retrieve active browser tab title & URL so backend knows current website (e.g. YouTube search)
  const getActiveTabContext = async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, windowType: 'normal' });
        if (tab && tab.url && !tab.url.startsWith('chrome://')) {
          return `Active Tab Title: "${tab.title || ''}", URL: "${tab.url || ''}"`;
        }
      } catch (e) {
        console.warn("Could not query active tab:", e);
      }
    }
    return document.title || "WebEase Dashboard";
  };

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);

  // VAD & Silence detection refs
  const audioContextRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const hasSpokenRef = useRef(false);
  const lastSpeechTimeRef = useRef(Date.now());
  const recordingStartTimeRef = useRef(Date.now());

  // Wake word recognition ref
  const wakeWordRecognizerRef = useRef(null);
  const isListeningRef = useRef(false);
  const isProcessingRef = useRef(false);
  const wakeWordEnabledRef = useRef(true);
  const handsFreeModeRef = useRef(true);
  const lastCommandEndTimeRef = useRef(0);
  const lastWakeTriggerTimeRef = useRef(0);
  const isAbortingWakeRecognizerRef = useRef(false);

  isListeningRef.current = isListening;
  isProcessingRef.current = isProcessing;
  wakeWordEnabledRef.current = wakeWordEnabled;
  handsFreeModeRef.current = handsFreeMode;

  // Stop audio playback immediately when navigating away or on global stop event
  const stopAudioPlayback = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    setIsPlayingAudio(false);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('webease-stop-all-audio', stopAudioPlayback);
    return () => {
      window.removeEventListener('webease-stop-all-audio', stopAudioPlayback);
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

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

  // Listen for global Alt+V command broadcast from background.js
  useEffect(() => {
    const handleRuntimeMessage = (msg) => {
      if (msg?.type === 'TOGGLE_MIC') {
        const btn = document.getElementById('main-mic-button');
        if (btn) btn.click();
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
      return () => chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    }
  }, []);

  // Play audio chime when wake word is triggered
  const playWakeChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
      setTimeout(() => audioCtx.close().catch(() => {}), 300);
    } catch (e) {}
  };

  // Play spoken response via Azure TTS (properly awaited until audio completes)
  const playTTS = (text) => {
    if (!text) return Promise.resolve();
    return new Promise(async (resolve) => {
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

        audio.onended = () => {
          setIsPlayingAudio(false);
          resolve();
        };
        audio.onerror = () => {
          setIsPlayingAudio(false);
          resolve();
        };
        audio.play().catch((err) => {
          console.warn('Audio play prevented or failed:', err);
          setIsPlayingAudio(false);
          resolve();
        });
      } catch (e) {
        console.error('Error playing TTS:', e);
        setIsPlayingAudio(false);
        resolve();
      }
    });
  };

  // ─── Send a command to the active tab via background.js ─────────────────
  const sendToTab = (tool, args) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'EXECUTE_IN_TAB', tool, args: args || {} },
        (resp) => {
          if (chrome.runtime.lastError) {
            console.warn('Extension message error:', chrome.runtime.lastError.message);
          }
        }
      );
    }
  };

  // ─── Handle every tool action ────────────────────────────────────────────
  const performAction = async (tool, args, responseText) => {
    const inExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;

    // ── Extension Control Tools ──────────────────────────────────────────────
    if (tool === 'extension_action') {
      const action = args?.action;
      if (action === 'toggle_theme') {
        if (onToggleTheme) onToggleTheme();
      } else if (action === 'toggle_large_text') {
        if (onToggleLargeText) onToggleLargeText();
      } else if (action === 'navigate') {
        if (onNavigate && args?.tab) {
          onNavigate(args.tab);
        }
      }
      return;
    }

    // ── Navigation tools (always use extension tab API) ──────────────────
    if (tool === 'open_url' && args?.url) {
      if (inExtension) {
        sendToTab('open_url', args);
      } else {
        // Web fallback
        let url = args.url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
        window.open(url, '_blank');
      }
      return;
    }

    if (tool === 'search' && args?.query) {
      if (inExtension) {
        sendToTab('search', args);
      } else {
        const searchUrls = {
          youtube:   `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`,
          wikipedia: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(args.query)}`,
          bing:      `https://www.bing.com/search?q=${encodeURIComponent(args.query)}`,
          google:    `https://www.google.com/search?q=${encodeURIComponent(args.query)}`,
        };
        window.open(searchUrls[args.site] || searchUrls.google, '_blank');
      }
      return;
    }

    if (tool === 'play_video' && args?.query) {
      if (inExtension) {
        sendToTab('play_video', args);
      } else {
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`, '_blank');
      }
      return;
    }

    if (tool === 'go_back') {
      if (inExtension) sendToTab('go_back', {});
      else window.history.back();
      return;
    }

    if (tool === 'go_forward') {
      if (inExtension) sendToTab('go_forward', {});
      else window.history.forward();
      return;
    }

    if (tool === 'scroll') {
      if (inExtension) {
        sendToTab('scroll', args);
      } else {
        const amount = args?.amount || 500;
        window.scrollBy({ top: args?.direction === 'up' ? -amount : amount, behavior: 'smooth' });
      }
      return;
    }

    // ── DOM tools — require extension ────────────────────────────────────
    if (!inExtension) {
      console.warn(`Tool "${tool}" requires the Chrome extension to be active.`);
      setStatusMessage(`⚠️ "${tool}" requires the extension — open as a Chrome side panel.`);
      return;
    }

    // click, type_text, find_element → pass directly to content script
    if (['click', 'type_text', 'find_element'].includes(tool)) {
      sendToTab(tool, args);
      return;
    }

    // ── read_page — extract text from tab, then Azure TTS ────────────────
    if (tool === 'read_page') {
      setStatusMessage('Extracting page text...');
      chrome.runtime.sendMessage({ type: 'EXECUTE_IN_TAB', tool: 'read_page', args: {} },
        async (resp) => {
          if (chrome.runtime.lastError) {
            setStatusMessage(`Error: ${chrome.runtime.lastError.message}`);
            return;
          }
          if (!resp?.success) {
            setStatusMessage(`Error: ${JSON.stringify(resp)}`);
            return;
          }
          const text = resp?.result?.text || resp?.result?.result?.text || '';
          if (!text) {
            setStatusMessage('No readable text found on this page.');
            return;
          }
          // Speak first ~800 words via Azure TTS
          const snippet = text.split(/\s+/).slice(0, 800).join(' ');
          setStatusMessage('Reading the page aloud...');
          await playTTS(snippet);
        }
      );
      return;
    }

    // ── read_selected_text — get selection, then Azure TTS ───────────────
    if (tool === 'read_selected_text') {
      chrome.runtime.sendMessage({ type: 'EXECUTE_IN_TAB', tool: 'read_selected_text', args: {} },
        async (resp) => {
          if (chrome.runtime.lastError) {
            setStatusMessage(`Error: ${chrome.runtime.lastError.message}`);
            return;
          }
          if (!resp?.success) {
            setStatusMessage(`Error: ${resp?.error || 'Unknown tab error'}`);
            return;
          }
          const text = resp?.result?.text || resp?.result?.result?.text || '';
          if (!text) {
            setStatusMessage('No text is selected on the page.');
            return;
          }
          setStatusMessage('Reading selected text...');
          await playTTS(text);
        }
      );
      return;
    }

    // ── summarize_page — extract text → backend LLM → Azure TTS ─────────
    if (tool === 'summarize_page') {
      setIsProcessing(true);
      setStatusMessage('Extracting page content...');

      // Step 1: Get full page text via background.js
      chrome.runtime.sendMessage({ type: 'GET_PAGE_TEXT' }, async (resp) => {
        const pageText = resp?.text || '';

        if (!pageText) {
          setStatusMessage('No readable content found on this page.');
          setIsProcessing(false);
          return;
        }

        setStatusMessage('Summarizing with AI...');

        try {
          // Step 2: Send to backend for LLM summary
          const res = await fetch(`${BACKEND_URL}/commands/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page_text: pageText }),
          });

          if (!res.ok) throw new Error(`Backend error ${res.status}`);
          const data = await res.json();
          const summary = data.summary || 'I could not generate a summary.';

          setLastResult(prev => prev ? {
            ...prev,
            responseText: summary,
          } : {
            command: 'summarize this page',
            tool: 'summarize_page',
            args: {},
            responseText: summary,
            status: 'success',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });

          setStatusMessage('Summary ready. Adding to Documents...');
          
          // Automatically create a document from the summary so it's not lost
          if (onCreateDoc) {
            onCreateDoc(`Page Summary:\n\n${summary}`);
          }

          // Step 3: Speak the summary via Azure TTS
          await playTTS(summary);
        } catch (err) {
          console.error('Summarize error:', err);
          setStatusMessage('Error summarizing the page.');
        } finally {
          setIsProcessing(false);
        }
      });
      return;
    }

    // ── generate_document ─────────────────────────────────────────────────
    if (tool === 'generate_document') {
      const docPrompt = args?.title || args?.content || textInput || liveSpeech;
      if (onCreateDoc) onCreateDoc(docPrompt);
      return;
    }
  };


  // Process text command (via backend /commands/text)
  const executeTextCommand = async (commandText) => {
    if (!commandText.trim()) return;
    setIsProcessing(true);
    setLiveSpeech(commandText);
    setStatusMessage("Analyzing command with Azure AI Foundry (GPT-4.1 Mini)...");

    try {
      const tabContext = await getActiveTabContext();
      const res = await fetch(`${BACKEND_URL}/commands/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: commandText, 
          page_context: tabContext 
        })
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
      lastCommandEndTimeRef.current = Date.now();
      setIsProcessing(false);
      setIsListening(false);
      setTextInput("");
    }
  };

  // Process recorded audio
  const processAudio = async (audioBlob) => {
    setIsProcessing(true);
    setStatusMessage("Transcribing speech with Azure Speech Services...");
    setLiveSpeech("Transcribing audio...");

    try {
      const tabContext = await getActiveTabContext();
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('page_context', tabContext);

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
      setStatusMessage(e.message || "Error processing audio.");
    } finally {
      lastCommandEndTimeRef.current = Date.now();
      setIsProcessing(false);
      setIsListening(false);
      setWakeWordDetected(false);
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'SET_WAKE_WORD_STATE', enabled: wakeWordEnabledRef.current }).catch(() => {});
      }
    }
  };

  const startRecording = async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'SET_WAKE_WORD_STATE', enabled: false }).catch(() => {});
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicError(false);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        // Cleanup VAD analyser and audio context
        if (vadIntervalRef.current) {
          clearInterval(vadIntervalRef.current);
          vadIntervalRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
        }

        const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          const wavBlob = await convertWebmToWavBlob(webmBlob);
          processAudio(wavBlob);
        } catch (convertErr) {
          processAudio(webmBlob);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      // ── Silence Detection (VAD) ───────────────────────────────────────────
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        hasSpokenRef.current = false;
        lastSpeechTimeRef.current = Date.now();
        recordingStartTimeRef.current = Date.now();

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArray.length);

          const now = Date.now();
          const SILENCE_THRESHOLD = 0.025;
          const SILENCE_TIMEOUT = 2200; // 2.2 seconds of silence after user stops speaking
          const MAX_INITIAL_SILENCE = 8000; // 8 seconds timeout if no speech at all

          if (rms > SILENCE_THRESHOLD) {
            hasSpokenRef.current = true;
            lastSpeechTimeRef.current = now;
          } else {
            // If user finished speaking and is silent for > 2.2s, auto-stop
            if (hasSpokenRef.current && (now - lastSpeechTimeRef.current > SILENCE_TIMEOUT)) {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                console.log("Silence detected after speech -> auto-stopping mic...");
                stopRecording();
              }
            } else if (!hasSpokenRef.current && (now - recordingStartTimeRef.current > MAX_INITIAL_SILENCE)) {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                console.log("No speech detected after 8s -> stopping mic...");
                stopRecording();
              }
            }
          }
        }, 100);
      } catch (vadErr) {
        console.warn("VAD setup error:", vadErr);
      }

      mediaRecorder.start();
      setIsListening(true);
      setIsProcessing(false);
      setLiveSpeech("");
      setStatusMessage("Listening... Speak your command (auto-stops on silence)");
    } catch (err) {
      console.error("Microphone error:", err);
      setMicError(true);
      
      // Chrome silently blocks getUserMedia in Side Panels for first-time permissions.
      // If we get an error, automatically open the extension in a full tab to trigger the prompt!
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
        chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
        setStatusMessage("Please click Allow in the new tab that just opened!");
      } else {
        setStatusMessage("Microphone access denied. Please grant permission.");
      }

      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'SET_WAKE_WORD_STATE', enabled: wakeWordEnabledRef.current }).catch(() => {});
      }
    }
  };

  const stopRecording = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  };

  const handleMicClick = () => {
    if (isListening) stopRecording();
    else startRecording();
  };

  const [heardSnippet, setHeardSnippet] = useState("");
  const wakeWordRestartTimeoutRef = useRef(null);

  // ── Wake Word Message Listener (Offscreen Document) ─────────────────────────
  useEffect(() => {
    // Send a message to background to enable/disable offscreen wake word
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'TOGGLE_WAKE_WORD', enabled: wakeWordEnabled });
    }
  }, [wakeWordEnabled]);

  useEffect(() => {
    const handleMessage = (msg) => {
      if (msg?.type === 'WAKE_WORD_DETECTED') {
        if (!wakeWordEnabledRef.current || isListeningRef.current || isProcessingRef.current) return;
        
        // Cooldowns
        if (Date.now() - lastCommandEndTimeRef.current < 2500) return;
        if (Date.now() - lastWakeTriggerTimeRef.current < 4000) return;

        lastWakeTriggerTimeRef.current = Date.now();
        setWakeWordDetected(true);
        playWakeChime();

        if (msg.command) {
          setStatusMessage(`⚡ "Hello Agent" heard! Running "${msg.command}"...`);
          setLiveSpeech(msg.command);
          executeTextCommand(msg.command);
        } else {
          setStatusMessage("⚡ \"Hello Agent\" heard! Listening for your command...");
          setTimeout(() => {
            startRecording();
          }, 250);
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }
  }, []);

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
            if (onCreateDoc) onCreateDoc("Draft an accessibility notes document.");
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
