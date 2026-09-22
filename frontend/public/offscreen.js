// offscreen.js
// Runs continuously in the background to listen for "Hello Agent"

let recognition = null;
let isEnabled = false;

// Robust wake word and inline command parser
function parseWakeWordAndCommand(rawText) {
  if (!rawText) return { isWake: false, command: '' };
  const clean = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Extremely loose fuzzy match for "hello agent"
  const wakeRegex = /\b(?:hello|hey|hi|helo|halo|hallo|yellow|how|allow)\s+(?:agent|agents|agency|asian|urgent|engine|legend|ajent|edgent)\b\s*(.*)/i;
  
  const match = clean.match(wakeRegex);
  if (match) {
    return { isWake: true, command: match[1]?.trim() || '' };
  }
  return { isWake: false, command: '' };
}

function startRecognition() {
  if (!isEnabled) return;
  if (recognition) {
    try { recognition.abort(); } catch (e) {}
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("SpeechRecognition not available in offscreen document.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    if (!isEnabled) return;
    
    const startIdx = Math.max(0, event.results.length - 4);
    let rawTranscript = '';
    for (let i = startIdx; i < event.results.length; i++) {
      rawTranscript += event.results[i][0].transcript + ' ';
    }

    const parsed = parseWakeWordAndCommand(rawTranscript);
    if (parsed.isWake) {
      console.log("[Offscreen] Wake word detected:", rawTranscript);
      // Send message to background/Dashboard
      chrome.runtime.sendMessage({ 
        type: 'WAKE_WORD_DETECTED', 
        command: parsed.command 
      });
      // Stop and restart to clear the transcript buffer
      try { recognition.abort(); } catch (e) {}
    }
  };

  recognition.onerror = (e) => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
      console.warn("[Offscreen] Speech recognition error:", e.error);
    }
    if (e.error === 'not-allowed') {
      isEnabled = false; // Stop trying if we don't have permission
    }
  };

  recognition.onend = () => {
    if (isEnabled) {
      setTimeout(startRecognition, 1000); // 1s delay to prevent tight loop
    }
  };

  try {
    recognition.start();
  } catch (e) {
    console.warn("[Offscreen] Could not start recognition:", e);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_WAKE_WORD_STATE') {
    isEnabled = message.enabled;
    if (isEnabled) {
      startRecognition();
    } else {
      if (recognition) {
        try { recognition.abort(); } catch(e) {}
        recognition = null;
      }
    }
  }
});
