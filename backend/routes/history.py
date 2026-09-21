"""
WebEase — History Routes
GET  /history/        → list recent commands
GET  /history/search  → search commands by text
DELETE /history/      → clear all history
DELETE /history/{id}  → delete one entry
"""

import json
from fastapi import APIRouter, Query
from utils.helpers import get_db, init_db, format_timestamp

router = APIRouter()

# Ensure the table exists when this module loads
init_db()


@router.get("/")
async def get_history(limit: int = Query(default=50, le=200)):
    """Return the most recent N commands."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM command_history ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()

    return {"history": [_row_to_dict(r) for r in rows]}


@router.get("/search")
async def search_history(q: str = Query(..., min_length=1)):
    """Search command history by text."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM command_history WHERE command LIKE ? ORDER BY id DESC LIMIT 100",
        (f"%{q}%",),
    ).fetchall()
    conn.close()

    return {"results": [_row_to_dict(r) for r in rows]}


@router.delete("/")
async def clear_history():
    """Delete all command history entries."""
    conn = get_db()
    conn.execute("DELETE FROM command_history")
    conn.commit()
    conn.close()
    return {"status": "cleared"}


@router.delete("/{entry_id}")
async def delete_entry(entry_id: int):
    """Delete a single history entry by ID."""
    conn = get_db()
    conn.execute("DELETE FROM command_history WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": entry_id}


def _row_to_dict(row) -> dict:
    d = dict(row)
    d["time_display"] = format_timestamp(d.get("timestamp", ""))
    try:
        d["args"] = json.loads(d.get("args") or "{}")
    except Exception:
        d["args"] = {}
    return d
