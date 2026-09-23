/**
 * WebEase — Background Service Worker (background.js)
 *
 * Bridges the popup ↔ content.js ↔ backend.
 *
 * ─── API KEY CONFIGURATION ────────────────────────────────────────────────
 * Keys live in the BACKEND .env file only — never here.
 * The extension calls the local FastAPI server which holds the keys securely.
 *
 * Change BACKEND_URL below if you host the backend somewhere other than localhost.
 * ──────────────────────────────────────────────────────────────────────────
 */

// ★ CONFIGURE YOUR BACKEND URL HERE
const BACKEND_URL = 'http://127.0.0.1:8000';

// ─── Message Router ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Popup → background: send text command to backend
  if (message.type === 'PROCESS_COMMAND') {
    handleProcessCommand(message.text, message.pageContext || '')
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err  => sendResponse({ success: false, error: err.message }));
    return true; // keep message channel open for async
  }

  // Popup → background: execute a validated command in the active tab
  if (message.type === 'EXECUTE_IN_TAB') {
    executeInActiveTab(message.tool, message.args)
      .then(result => sendResponse({ success: true, result }))
      .catch(err  => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Popup → background: get page text (for context injection)
  if (message.type === 'GET_PAGE_CONTEXT') {
    getPageContext()
      .then(text => sendResponse({ success: true, text }))
      .catch(err => sendResponse({ success: false, text: '' }));
    return true;
  }
});

// ─── Backend API Call ─────────────────────────────────────────────────────
async function handleProcessCommand(text, pageContext) {
  const resp = await fetch(`${BACKEND_URL}/commands/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, page_context: pageContext }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Backend error ${resp.status}: ${err}`);
  }

  return resp.json();
  // Returns: { tool, args, response_text, status }
}

// ─── Tab Execution ────────────────────────────────────────────────────────
async function executeInActiveTab(tool, args) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');

  // Inject content.js if not already injected
  try {
    return await chrome.tabs.sendMessage(tab.id, {
      type: 'EXECUTE_COMMAND', tool, args,
    });
  } catch (_) {
    // content.js not yet injected on this page — inject then retry
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content.js'],
    });
    return chrome.tabs.sendMessage(tab.id, {
      type: 'EXECUTE_COMMAND', tool, args,
    });
  }
}

// ─── Page Context ─────────────────────────────────────────────────────────
async function getPageContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return '';

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body?.innerText?.slice(0, 2000) || '',
    });
    return results?.[0]?.result || '';
  } catch (_) {
    return '';
  }
}

// ─── Extension Installed ──────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  console.log('WebEase installed. Backend expected at:', BACKEND_URL);
  
  // Configure the side panel to open on click
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('Error setting panel behavior:', error));
  }
});
