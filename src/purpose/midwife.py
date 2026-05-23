"""产婆 protocol + structural (offline) implementation.

A Midwife does not produce 志 — it only midwifes. Given a concern
and a chosen lens, it offers Socratic questions and (optionally) candidate
simplifications. The user is always the one who chooses or writes the
next, simpler concern.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from purpose.core import Journey
from purpose.lenses import LENSES, LensType


@dataclass(frozen=True, slots=True)
class Proposal:
    """What a midwife offers for one turn."""

    socratic: str
    candidates: tuple[str, ...] = ()
    note: str = ""
    anchor_suggestion: str | None = None


class Midwife(Protocol):
    name: str

    def propose(self, journey: Journey, lens: LensType) -> Proposal: ...


class StructuralMidwife:
    """Pure offline midwife: returns only the Socratic prompt for the lens.

    The user is the one who formulates the simpler concern. This is the
    baseline against which the LLM midwife is compared.
    """

    name = "structural"

    def propose(self, journey: Journey, lens: LensType) -> Proposal:
        spec = LENSES[lens]
        note = (
            "结构化模式：这里只给出苏格拉底式追问。"
            "化简后的陈述由你写下——请尽量短、更接近本质。"
        )
        if spec.is_terminal:
            note = "结构化模式：如果你能凭直觉判断当前陈述的方向，写下它，立为志。"
        return Proposal(socratic=spec.socratic, candidates=(), note=note)
