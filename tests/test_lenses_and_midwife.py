"""Lenses + structural midwife."""

from __future__ import annotations

from purpose import core
from purpose.lenses import LENSES, LensType, listed
from purpose.midwife import StructuralMidwife


def test_all_five_lenses_present():
    types = {l.type for l in listed()}
    assert types == {
        LensType.GUIBEN,
        LensType.FANGUAN,
        LensType.DINGXING,
        LensType.YOUSHI,
        LensType.ANJU,
    }


def test_anju_is_only_terminal_lens():
    terminals = [l for l in listed() if l.is_terminal]
    assert len(terminals) == 1
    assert terminals[0].type == LensType.ANJU


def test_structural_midwife_returns_socratic_for_lens():
    mw = StructuralMidwife()
    j = core.begin("信息焦虑")
    p = mw.propose(j, LensType.GUIBEN)
    assert p.socratic == LENSES[LensType.GUIBEN].socratic
    assert p.candidates == ()
    assert p.note  # has guidance


def test_structural_terminal_lens_has_distinct_note():
    mw = StructuralMidwife()
    j = core.begin("噪声")
    j = core.reduce(j, LensType.GUIBEN, "信号")
    p = mw.propose(j, LensType.ANJU)
    assert p.anchor_suggestion is None
    assert "立为志" in p.note or "直觉" in p.note
