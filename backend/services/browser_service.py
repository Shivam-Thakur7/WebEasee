"""
WebEase — Browser Service
Validates and dispatches browser commands received from Foundry.
The actual execution happens inside content.js in the Chrome extension.
This service is responsible for validation and formatting only.
"""

import logging
from urllib.parse import urlparse

import config

logger = logging.getLogger("webease.browser")

SEARCH_URLS = {
    "google":    "https://www.google.com/search?q=",
    "youtube":   "https://www.youtube.com/results?search_query=",
    "wikipedia": "https://en.wikipedia.org/wiki/Special:Search?search=",
    "bing":      "https://www.bing.com/search?q=",
}


class BrowserService:

    def validate_and_prepare(self, tool: str, args: dict) -> dict:
        """
        Validate the tool name and arguments.
        Returns the final command payload to send to the extension.
        """
        if tool not in config.ALLOWED_BROWSER_TOOLS:
            return {"valid": False, "reason": f"Tool '{tool}' is not in the allow-list."}

        # Per-tool argument validation
        validators = {
            "scroll":             self._validate_scroll,
            "click":              self._validate_click,
            "type_text":          self._validate_type_text,
            "open_url":           self._validate_open_url,
            "search":             self._validate_search,
            "go_back":            lambda a: (True, a),
            "go_forward":         lambda a: (True, a),
            "read_page":          lambda a: (True, a),
            "read_selected_text": lambda a: (True, a),
            "find_element":       self._validate_find_element,
            "play_video":         self._validate_play_video,
            "extension_action":   lambda a: (True, a),
        }

        ok, processed_args = validators[tool](args)
        if not ok:
            return {"valid": False, "reason": processed_args}

        return {"valid": True, "tool": tool, "args": processed_args}

    # ── Validators ────────────────────────────────────────────────────────────

    def _validate_scroll(self, args):
        direction = args.get("direction", "down")
        if direction not in ("up", "down"):
            return False, "direction must be 'up' or 'down'"
        amount = min(max(int(args.get("amount", 500)), 50), 5000)
        return True, {"direction": direction, "amount": amount}

    def _validate_click(self, args):
        selector = args.get("selector", "").strip()
        if not selector:
            return False, "selector is required for click"
        return True, {"selector": selector}

    def _validate_type_text(self, args):
        text = args.get("text", "").strip()
        if not text:
            return False, "text is required for type_text"
        return True, {"text": text, "selector": args.get("selector", "")}

    def _validate_open_url(self, args):
        url = args.get("url", "").strip()
        if not url:
            return False, "url is required"
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        parsed = urlparse(url)
        if not parsed.netloc:
            return False, f"Invalid URL: {url}"
        return True, {"url": url}

    def _validate_search(self, args):
        query = args.get("query", "").strip()
        if not query:
            return False, "query is required for search"
        site = args.get("site", "google").lower()
        base = SEARCH_URLS.get(site, SEARCH_URLS["google"])
        full_url = base + query.replace(" ", "+")
        return True, {"query": query, "site": site, "url": full_url}

    def _validate_find_element(self, args):
        desc = args.get("description", "").strip()
        if not desc:
            return False, "description is required for find_element"
        return True, {"description": desc}

    def _validate_play_video(self, args):
        query = args.get("query", "").strip()
        if not query:
            return False, "query is required for play_video"
        return True, {"query": query}


# Singleton instance
browser_service = BrowserService()
