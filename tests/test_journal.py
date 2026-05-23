"""Journal write/read round-trip."""

from __future__ import annotations

from pathlib import Path

from purpose import core, journal
from purpose.lenses import LensType


def test_journal_round_trip(tmp_path: Path):
    target = tmp_path / "j.jsonl"
    j = core.begin("信息焦虑", engine="structural")
    j = core.reduce(j, LensType.GUIBEN, "本质是什么")
    j = core.reduce(j, LensType.ANJU, "本质是什么")
    j = core.anchor(j, "守一")
    journal.write(j, target)
    journal.write(j, target)
    rows = list(journal.read_all(target))
    assert len(rows) == 2
    assert rows[0]["aspiration"]["text"] == "守一"
    assert rows[0]["reductions"][0]["lens"] == "guiben"
