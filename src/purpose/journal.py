"""Persist completed journeys as JSONL.

One line per journey. The file is the clean training-data corpus:
seed → (lens, reduction)* → aspiration, tagged with engine + timestamp.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator

from purpose.core import Journey


def default_path() -> Path:
    return Path.home() / ".purpose" / "journal.jsonl"


def write(journey: Journey, path: Path | None = None) -> Path:
    target = path or default_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(journey.to_dict(), ensure_ascii=False)
    with target.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    return target


def read_all(path: Path | None = None) -> Iterator[dict]:
    target = path or default_path()
    if not target.exists():
        return
    with target.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)
