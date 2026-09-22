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
    return true;
  }

  // Popup → background: execute a validated command in the active tab
  if (message.type === 'EXECUTE_IN_TAB') {
    executeInActiveTab(message.tool, message.args)
      .then(result => sendResponse({ success: true, result }))
      .catch(err  => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Popup → background: get page text (for context injection or summarization)
  if (message.type === 'GET_PAGE_CONTEXT') {
    getPageContext()
      .then(text => sendResponse({ success: true, text }))
      .catch(err => sendResponse({ success: false, text: '' }));
    return true;
  }

  // Popup → background: get FULL page text for summarization/read-aloud
  if (message.type === 'GET_PAGE_TEXT') {
    getFullPageText()
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

  // ── Direct navigation via Chrome Tabs API ──────────────────────────────

  if (tool === 'open_url' && args?.url) {
    let targetUrl = args.url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    await chrome.tabs.update(tab.id, { url: targetUrl });
    return { done: true };
  }

  if (tool === 'search') {
    const url = args?.url || buildSearchUrl(args);
    if (url) {
      await chrome.tabs.update(tab.id, { url });
      return { done: true };
    }
  }

  if (tool === 'play_video' && args?.query) {
    const q = (args.query || '').toLowerCase();
    const isPositional = /\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|this|current|\d+)\b/.test(q);

    // If already on YouTube and positional → click the video in DOM
    if (tab.url && tab.url.includes('youtube.com') && isPositional) {
      return await sendToContentScript(tab.id, 'click', { selector: args.query });
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
    await chrome.tabs.update(tab.id, { url });
    return { done: true };
  }

  if (tool === 'go_back') {
    await chrome.tabs.goBack(tab.id).catch(() => window.history?.back());
    return { done: true };
  }

  if (tool === 'go_forward') {
    await chrome.tabs.goForward(tab.id).catch(() => window.history?.forward());
    return { done: true };
  }

  // ── Tools that need page text extracted first ──────────────────────────

  if (tool === 'read_page') {
    // Extract page text via content script, return it for the popup to TTS
    const result = await sendToContentScript(tab.id, 'read_page', {});
    return { done: true, text: result?.result?.text || '' };
  }

  if (tool === 'read_selected_text') {
    const result = await sendToContentScript(tab.id, 'read_selected_text', {});
    return { done: true, text: result?.result?.text || '' };
  }

  if (tool === 'summarize_page') {
    // Step 1: extract page text
    const extractResult = await sendToContentScript(tab.id, 'get_page_text', {});
    const pageText = extractResult?.result?.text || '';

    // Step 2: send to backend for LLM summary
    try {
      const resp = await fetch(`${BACKEND_URL}/commands/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_text: pageText }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return { done: true, summary: data.summary || '' };
      }
    } catch (e) {
      console.error('Summarize error:', e);
    }
    return { done: true, summary: 'Sorry, I could not summarize the page.' };
  }

  // ── DOM content script tools (scroll, click, type_text, find_element) ──
  return await sendToContentScript(tab.id, tool, args);
}

// ─── Helper: send message to content script, injecting it first if needed ─
async function sendToContentScript(tabId, tool, args) {
  const message = { type: 'EXECUTE_COMMAND', tool, args };

  try {
    const result = await chrome.tabs.sendMessage(tabId, message);
    return result;
  } catch (_) {
    // content.js not yet injected → inject then retry
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content.js'],
      });
      // Small delay to let script initialize
      await new Promise(r => setTimeout(r, 200));
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (injectErr) {
      console.warn('Could not inject content script into tab:', injectErr.message);
      return { status: 'ignored', error: injectErr.message };
    }
  }
}

// ─── Helper: Build search URL ─────────────────────────────────────────────
function buildSearchUrl(args) {
  if (!args?.query) return null;
  const q = encodeURIComponent(args.query);
  switch (args.site) {
    case 'youtube':   return `https://www.youtube.com/results?search_query=${q}`;
    case 'wikipedia': return `https://en.wikipedia.org/wiki/Special:Search?search=${q}`;
    case 'bing':      return `https://www.bing.com/search?q=${q}`;
    default:          return `https://www.google.com/search?q=${q}`;
  }
}

// ─── Page Context (short snippet for LLM context) ─────────────────────────
async function getPageContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return '';

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const title = document.title || '';
        const url = window.location.href || '';
        const snippet = document.body?.innerText?.slice(0, 1500) || '';
        return `Title: "${title}"\nURL: "${url}"\n\n${snippet}`;
      },
    });
    return results?.[0]?.result || '';
  } catch (_) {
    return '';
  }
}

// ─── Full Page Text (for read_page / summarize_page) ──────────────────────
async function getFullPageText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return '';

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll(
          'script, style, noscript, nav, header, footer, aside, ' +
          '[aria-hidden="true"], .advertisement, .ad, iframe, svg'
        ).forEach(n => n.remove());
        return clone.innerText?.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() || '';
      },
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
