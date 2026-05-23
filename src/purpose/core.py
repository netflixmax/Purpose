"""Core data model. Frozen, JSON-serializable, no I/O."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from purpose.lenses import LensType


def _new_id() -> str:
    return uuid4().hex[:8]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True, slots=True)
class Concern:
    """A 困惑 — a worry, question, or problem being held."""

    text: str
    depth: int = 0
    id: str = field(default_factory=_new_id)

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "depth": self.depth, "text": self.text}


@dataclass(frozen=True, slots=True)
class Reduction:
    """One step of 化简: from a richer concern to a simpler one through a lens."""

    from_id: str
    to_concern: Concern
    lens: LensType
    midwife_note: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "from_id": self.from_id,
            "to": self.to_concern.to_dict(),
            "lens": self.lens.value,
            "midwife_note": self.midwife_note,
        }


@dataclass(frozen=True, slots=True)
class Aspiration:
    """A 志 — the intuitive anchor reached at the end of recursion."""

    text: str
    rooted_in_id: str
    depth: int

    def to_dict(self) -> dict[str, Any]:
        return {"text": self.text, "rooted_in_id": self.rooted_in_id, "depth": self.depth}


@dataclass(frozen=True, slots=True)
class Journey:
    """The full simplification path. Immutable; extend via `extend`."""

    seed: Concern
    reductions: tuple[Reduction, ...] = ()
    aspiration: Aspiration | None = None
    engine: str = "structural"
    started_at: str = field(default_factory=_now)
    id: str = field(default_factory=_new_id)

    @property
    def current(self) -> Concern:
        if self.reductions:
            return self.reductions[-1].to_concern
        return self.seed

    @property
    def depth(self) -> int:
        return self.current.depth

    @property
    def is_settled(self) -> bool:
        return self.aspiration is not None

    def extend(self, reduction: Reduction) -> Journey:
        return replace(self, reductions=self.reductions + (reduction,))

    def settle(self, aspiration: Aspiration) -> Journey:
        return replace(self, aspiration=aspiration)

    def path(self) -> list[Concern]:
        return [self.seed, *(r.to_concern for r in self.reductions)]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "engine": self.engine,
            "started_at": self.started_at,
            "seed": self.seed.to_dict(),
            "reductions": [r.to_dict() for r in self.reductions],
            "aspiration": self.aspiration.to_dict() if self.aspiration else None,
        }


def begin(seed_text: str, engine: str = "structural") -> Journey:
    return Journey(seed=Concern(text=seed_text, depth=0), engine=engine)


def reduce(
    journey: Journey,
    lens: LensType,
    simplified_text: str,
    midwife_note: str = "",
) -> Journey:
    """Apply one reduction. Returns a new Journey; original is unchanged."""
    from_c = journey.current
    to_c = Concern(text=simplified_text, depth=from_c.depth + 1)
    return journey.extend(
        Reduction(from_id=from_c.id, to_concern=to_c, lens=lens, midwife_note=midwife_note)
    )


def anchor(journey: Journey, aspiration_text: str) -> Journey:
    """Mark the current concern as the intuitive anchor — the 志."""
    c = journey.current
    return journey.settle(Aspiration(text=aspiration_text, rooted_in_id=c.id, depth=c.depth))
