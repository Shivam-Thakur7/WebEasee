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
    case 'scroll':             return doScroll(args);
    case 'click':              return doClick(args);
    case 'type_text':          return doTypeText(args);
    case 'open_url':           return doOpenUrl(args);
    case 'search':             return doSearch(args);
    case 'play_video':         return doPlayVideo(args);
    case 'go_back':            window.history.back();    return { done: true };
    case 'go_forward':         window.history.forward(); return { done: true };
    case 'read_page':          return doReadPage();
    case 'read_selected_text': return doReadSelected();
    case 'find_element':       return doFindElement(args);
    case 'summarize_page':     return doExtractPageText(); // returns text for background to relay
    case 'get_page_text':      return doExtractPageText(); // generic text extraction
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

// ─── Scroll ───────────────────────────────────────────────────────────────
function doScroll({ direction = 'down', amount = 500 }) {
  // Try scrolling the focused scrollable element first, fallback to window
  const scrollable = findScrollableElement() || document.documentElement;
  const delta = direction === 'down' ? amount : -amount;

  if (scrollable === document.documentElement) {
    window.scrollBy({ top: delta, behavior: 'smooth' });
  } else {
    scrollable.scrollBy({ top: delta, behavior: 'smooth' });
  }
  return { done: true, direction, amount };
}

function findScrollableElement() {
  // Find the most prominent scrollable element that is not the root
  const els = document.querySelectorAll('main, article, [role="main"], .content, #content, #main');
  for (const el of els) {
    if (el.scrollHeight > el.clientHeight + 50) return el;
  }
  return null;
}

// ─── Positional & Smart Element Resolver ──────────────────────────────────
function findPositionalElement(selector) {
  const lower = (selector || '').toLowerCase();

  // Parse ordinal/number from the phrase
  let index = -1;
  if      (/\b(first|1st|one)\b|\b1\b/.test(lower))  index = 0;
  else if (/\b(second|2nd|two)\b|\b2\b/.test(lower)) index = 1;
  else if (/\b(third|3rd|three)\b|\b3\b/.test(lower))index = 2;
  else if (/\b(fourth|4th|four)\b|\b4\b/.test(lower))index = 3;
  else if (/\b(fifth|5th|five)\b|\b5\b/.test(lower)) index = 4;
  else if (/\b(sixth|6th|six)\b|\b6\b/.test(lower))  index = 5;

  if (index === -1) return null;

  const isYT = window.location.hostname.includes('youtube.com');

  if (isYT || lower.includes('video')) {
    // YouTube video titles & links (handles search results, homepage grid, sidebar)
    const ytLinks = Array.from(document.querySelectorAll(
      'ytd-video-renderer a#video-title, ytd-rich-item-renderer a#video-title, ytd-compact-video-renderer a#video-title, a#video-title, ytd-thumbnail a#thumbnail'
    )).filter(el => {
      const href = el.getAttribute('href') || el.href;
      return href && href.includes('/watch') && el.offsetParent !== null;
    });
    if (ytLinks[index]) return ytLinks[index];
  }

  // Google / Bing / DuckDuckGo search result links
  const searchLinks = Array.from(document.querySelectorAll(
    '#search .g a h3, #search .g > div > div > a, [data-testid="result-title-a"], li.b_algo h2 a, a[role="heading"]'
  )).filter(el => el.offsetParent !== null);
  if (searchLinks[index]) {
    return searchLinks[index].closest('a') || searchLinks[index];
  }

  // Generic list of prominent page links (filtered for likely content links)
  const visibleLinks = Array.from(document.querySelectorAll('main a, article a, section a, a[href]'))
    .filter(el =>
      el.offsetParent !== null &&
      el.href &&
      !el.href.startsWith('javascript') &&
      !el.href.startsWith('#') &&
      (el.innerText || '').trim().length > 3
    );
  if (visibleLinks[index]) return visibleLinks[index];

  return null;
}

// ─── Click ────────────────────────────────────────────────────────────────
function doClick({ selector }) {
  // First try positional resolution (e.g. "first video", "second result")
  const positionalEl = findPositionalElement(selector);
  if (positionalEl) {
    positionalEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    positionalEl.focus();
    positionalEl.click();
    if (positionalEl.href && positionalEl.tagName === 'A') {
      setTimeout(() => { window.location.href = positionalEl.href; }, 150);
    }
    return { done: true, selector, element: positionalEl.innerText?.trim() || positionalEl.href };
  }

  // Try CSS selector
  let el = null;
  try { el = document.querySelector(selector); } catch (_) {}

  // Fallback: text content search
  if (!el) {
    const candidates = document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"], label');
    const lower = selector.toLowerCase();
    for (const node of candidates) {
      const label = (
        node.textContent?.trim() + ' ' +
        (node.getAttribute('aria-label') || '') + ' ' +
        (node.getAttribute('title') || '')
      ).toLowerCase();
      if (label.includes(lower)) { el = node; break; }
    }
  }

  if (!el) throw new Error(`Element not found: ${selector}`);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.focus();
  el.click();
  if (el.tagName === 'A' && el.href && !el.href.startsWith('#') && !el.href.startsWith('javascript')) {
    setTimeout(() => { window.location.href = el.href; }, 150);
  }
  return { done: true, selector };
}

// ─── Type Text ────────────────────────────────────────────────────────────
function doTypeText({ text, selector = '', submit = false }) {
  let input = null;

  // Target a specific field if selector given
  if (selector) {
    try { input = document.querySelector(selector); } catch (_) {}
  }

  // Fall back to active element or first suitable input
  if (!input) {
    input = document.activeElement;
    if (!input || !['INPUT', 'TEXTAREA'].includes(input.tagName)) {
      // Try common search inputs first
      input = document.querySelector(
        'input[type="search"], input[type="text"]:not([type="hidden"]), textarea, [contenteditable="true"]'
      );
    }
  }

  if (!input) throw new Error('No input field found to type into');

  input.focus();

  // Set value (handle contentEditable separately)
  if (input.isContentEditable) {
    input.innerText = (input.innerText || '') + text;
  } else {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, (input.value || '') + text);
    } else {
      input.value = (input.value || '') + text;
    }
  }

  // Dispatch React-compatible events so frameworks update their state
  input.dispatchEvent(new Event('input',  { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  // Only submit if explicitly requested
  if (submit) {
    const enterEvent = new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13
    });
    input.dispatchEvent(enterEvent);

    // Also try the nearest form submit
    const form = input.closest('form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) submitBtn.click();
      else form.requestSubmit?.();
    }
  }

  return { done: true, text, submit };
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
function doSearch({ query, site, url }) {
  // Prefer pre-built URL from backend validation if available
  if (url) {
    window.location.href = url;
    return { done: true, query, site };
  }

  if (site === 'youtube') {
    window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
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
  // If already on YouTube and query is positional, click the video directly
  if (window.location.hostname.includes('youtube.com')) {
    const el = findPositionalElement(query);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
      el.click();
      if (el.href) setTimeout(() => { window.location.href = el.href; }, 150);
      return { done: true, query, action: 'clicked_video' };
    }
  }
  // Navigate to YouTube search results
  window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  return { done: true, query };
}

// ─── Extract Page Text (for read_page, summarize_page) ───────────────────
function doExtractPageText() {
  const text = extractPageText();
  return { done: true, text: text || '' };
}

// ─── Read Page (text extraction + return; TTS handled by popup via Azure) ─
function doReadPage() {
  const text = extractPageText();
  if (!text) throw new Error('No readable content found on this page');
  // Return first 1000 words for TTS (≈ 5-6 minutes of speech max, frontend truncates further)
  const words = text.split(/\s+/).slice(0, 1000).join(' ');
  return { done: true, text: words };
}

// ─── Read Selected Text ───────────────────────────────────────────────────
function doReadSelected() {
  const selected = window.getSelection()?.toString()?.trim();
  if (!selected) throw new Error('No text is currently selected on this page');
  return { done: true, text: selected };
}

// ─── Find Element ─────────────────────────────────────────────────────────
function doFindElement({ description }) {
  const lower = description.toLowerCase();
  const candidates = document.querySelectorAll(
    'input, button, a, textarea, select, [role="button"], [role="link"], [role="searchbox"], [role="combobox"]'
  );

  let best = null;
  for (const el of candidates) {
    if (el.offsetParent === null) continue; // skip hidden elements
    const text = [
      el.textContent?.trim(),
      el.getAttribute('placeholder'),
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('name'),
      el.getAttribute('id'),
    ].filter(Boolean).join(' ').toLowerCase();

    if (text.includes(lower)) { best = el; break; }
  }

  if (!best) throw new Error(`Could not find element matching: ${description}`);

  best.scrollIntoView({ behavior: 'smooth', block: 'center' });
  best.focus();

  // Highlight briefly with a blue outline
  const prevOutline = best.style.outline;
  const prevBg = best.style.backgroundColor;
  best.style.outline = '3px solid #3b82f6';
  best.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
  setTimeout(() => {
    best.style.outline = prevOutline;
    best.style.backgroundColor = prevBg;
  }, 2500);

  return { done: true, description, tag: best.tagName, text: best.textContent?.trim()?.slice(0, 50) };
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function extractPageText() {
  // Clone body, strip non-content elements, return clean text
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll(
    'script, style, noscript, nav, header, footer, aside, ' +
    '[aria-hidden="true"], .advertisement, .ad, #cookie-banner, .cookie, ' +
    'iframe, svg, img, video, audio, [role="banner"], [role="navigation"]'
  ).forEach(n => n.remove());

  const text = clone.textContent?.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() || '';
  return text;
}
