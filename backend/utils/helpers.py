"""
WebEase — Utility Helpers
"""

import sqlite3
import os
import logging
from datetime import datetime

logger = logging.getLogger("webease.utils")

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "webease_history.db")


def get_db() -> sqlite3.Connection:
    """Return a SQLite connection with row_factory set."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create the command_history table if it does not exist."""
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS command_history (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT    NOT NULL,
            command   TEXT    NOT NULL,
            tool      TEXT,
            args      TEXT,
            status    TEXT    NOT NULL DEFAULT 'completed',
            response  TEXT
        )
    """)
    conn.commit()
    conn.close()
    logger.info("Database initialized.")


def save_command(command: str, tool: str, args: dict, status: str, response: str = ""):
    """Persist a command to the history database."""
    import json
    try:
        conn = get_db()
        conn.execute(
            """INSERT INTO command_history (timestamp, command, tool, args, status, response)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                datetime.now().isoformat(timespec="seconds"),
                command,
                tool or "",
                json.dumps(args),
                status,
                response,
            ),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"DB write error: {e}")


def sanitize_text(text: str, max_length: int = 4096) -> str:
    """Strip and truncate a string."""
    return text.strip()[:max_length]


def format_timestamp(iso_str: str) -> str:
    """Convert ISO timestamp to human-readable HH:MM."""
    try:
        dt = datetime.fromisoformat(iso_str)
        return dt.strftime("%H:%M")
    except Exception:
        return iso_str
