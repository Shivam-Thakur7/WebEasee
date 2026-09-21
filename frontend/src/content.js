/**
 * WebEase — Content Script (content.js)
 *
 * Injected into every webpage. Receives tool commands from background.js
 * and executes them directly in the page DOM.
 *
 * No API keys needed here — all AI processing happens in the backend.
 */

// ─── Command Router ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'EXECUTE_COMMAND') return;

  const { tool, args } = message;

  executeCommand(tool, args)
    .then(result => sendResponse({ success: true,  result }))
    .catch(err   => sendResponse({ success: false, error: err.message }));

  return true; // async response
});

// ─── Command Dispatcher ───────────────────────────────────────────────────
async function executeCommand(tool, args) {
  switch (tool) {
    case 'scroll':            return doScroll(args);
    case 'click':             return doClick(args);
    case 'type_text':         return doTypeText(args);
    case 'open_url':          return doOpenUrl(args);
    case 'search':            return doSearch(args);
    case 'play_video':        return doPlayVideo(args);
    case 'go_back':           window.history.back();   return { done: true };
    case 'go_forward':        window.history.forward(); return { done: true };
    case 'read_page':         return doReadPage();
    case 'read_selected_text':return doReadSelected();
    case 'find_element':      return doFindElement(args);
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

// ─── Scroll ───────────────────────────────────────────────────────────────
function doScroll({ direction = 'down', amount = 500 }) {
  window.scrollBy({
    top: direction === 'down' ? amount : -amount,
    behavior: 'smooth',
  });
  return { done: true, direction, amount };
}

// ─── Click ────────────────────────────────────────────────────────────────
function doClick({ selector }) {
  // Try CSS selector first, then text content match
  let el = null;
  try { el = document.querySelector(selector); } catch (_) {}

  if (!el) {
    // Search by visible text
    const all = document.querySelectorAll('a, button, [role="button"], input[type="submit"]');
    const lower = selector.toLowerCase();
    for (const node of all) {
      if (node.textContent.trim().toLowerCase().includes(lower)) {
        el = node; break;
      }
    }
  }

  if (!el) throw new Error(`Element not found: ${selector}`);
  el.focus();
  el.click();
  return { done: true, selector };
}

// ─── Type Text ────────────────────────────────────────────────────────────
function doTypeText({ text, selector = '' }) {
  let input = null;
  if (selector) {
    try { input = document.querySelector(selector); } catch (_) {}
  }
  if (!input) {
    input = document.activeElement;
    if (!input || !['INPUT','TEXTAREA'].includes(input.tagName)) {
      input = document.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]');
    }
  }
  if (!input) throw new Error('No input field found to type into');

  input.focus();
  if (input.isContentEditable) {
    input.innerText += text;
  } else {
    input.value += text;
  }
  
  // Try to find a submit button nearby or simulate Enter
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Simulate Enter key press
  const enterEvent = new KeyboardEvent('keydown', {
    bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13
  });
  input.dispatchEvent(enterEvent);
  
  return { done: true, text };
}

// ─── Open URL ─────────────────────────────────────────────────────────────
function doOpenUrl({ url }) {
  let targetUrl = url;
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  window.location.href = targetUrl;
  return { done: true, url: targetUrl };
}

// ─── Search ──────────────────────────────────────────────────────────────
function doSearch({ query, site }) {
  if (site === 'youtube') {
    window.location.href = `https://duckduckgo.com/?q=!yt+${encodeURIComponent(query)}`;
  } else if (site === 'wikipedia') {
    window.location.href = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`;
  } else if (site === 'bing') {
    window.location.href = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  } else {
    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
  return { done: true, query, site };
}

// ─── Play Video ──────────────────────────────────────────────────────────
function doPlayVideo({ query }) {
  window.location.href = `https://duckduckgo.com/?q=!yt+${encodeURIComponent(query)}`;
  return { done: true, query };
}

// ─── Read Page ────────────────────────────────────────────────────────────
function doReadPage() {
  const text = extractPageText();
  if (!text) throw new Error('No readable content found on this page');
  speakText(text.slice(0, 1500)); // TTS first 1500 chars
  return { done: true, text: text.slice(0, 200) + '...' };
}

// ─── Read Selected Text ───────────────────────────────────────────────────
function doReadSelected() {
  const selected = window.getSelection()?.toString()?.trim();
  if (!selected) throw new Error('No text is currently selected');
  speakText(selected);
  return { done: true, text: selected };
}

// ─── Find Element ─────────────────────────────────────────────────────────
function doFindElement({ description }) {
  const lower = description.toLowerCase();
  const candidates = document.querySelectorAll(
    'input, button, a, textarea, select, [role="button"], [role="link"], [role="searchbox"]'
  );

  let best = null;
  for (const el of candidates) {
    const text = (el.textContent + ' ' + el.getAttribute('placeholder') + ' ' + el.getAttribute('aria-label'))
      .toLowerCase();
    if (text.includes(lower)) { best = el; break; }
  }

  if (!best) throw new Error(`Could not find element matching: ${description}`);

  best.scrollIntoView({ behavior: 'smooth', block: 'center' });
  best.focus();

  // Highlight briefly
  const prev = best.style.outline;
  best.style.outline = '3px solid #3b82f6';
  setTimeout(() => { best.style.outline = prev; }, 2000);

  return { done: true, description, tag: best.tagName };
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function extractPageText() {
  // Remove scripts/styles then get readable text
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script, style, nav, header, footer, aside').forEach(n => n.remove());
  return clone.innerText?.replace(/\s+/g, ' ').trim() || '';
}

function speakText(text) {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.0;
  utt.lang = 'en-US';
  window.speechSynthesis.speak(utt);
}
