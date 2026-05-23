"""Core data model: immutable, JSON-roundtrippable, reducible."""

from __future__ import annotations

import json

import pytest

from purpose import core
from purpose.lenses import LensType


def test_begin_creates_seed_at_depth_0():
    j = core.begin("信息洪流让我焦虑")
    assert j.seed.depth == 0
    assert j.current is j.seed
    assert j.depth == 0
    assert not j.is_settled
    assert j.reductions == ()


def test_reduce_appends_and_deepens():
    j = core.begin("信息洪流让我焦虑")
    j2 = core.reduce(j, LensType.GUIBEN, "我不知道何为本质")
    assert j2.depth == 1
    assert j2.current.text == "我不知道何为本质"
    assert len(j2.reductions) == 1
    # original unchanged
    assert j.depth == 0
    assert j.reductions == ()


def test_chain_of_reductions():
    j = core.begin("信息洪流")
    j = core.reduce(j, LensType.GUIBEN, "本质是什么")
    j = core.reduce(j, LensType.DINGXING, "认同问题")
    j = core.reduce(j, LensType.YOUSHI, "我要做什么")
    assert j.depth == 3
    assert [c.depth for c in j.path()] == [0, 1, 2, 3]


def test_anchor_settles_journey():
    j = core.begin("噪声")
    j = core.reduce(j, LensType.GUIBEN, "信号")
    j = core.anchor(j, "成为信号的源头")
    assert j.is_settled
    assert j.aspiration is not None
    assert j.aspiration.text == "成为信号的源头"
    assert j.aspiration.depth == 1


def test_to_dict_roundtrips_json():
    j = core.begin("seed")
    j = core.reduce(j, LensType.FANGUAN, "inverted")
    j = core.anchor(j, "live well")
    blob = json.dumps(j.to_dict(), ensure_ascii=False)
    data = json.loads(blob)
    assert data["seed"]["text"] == "seed"
    assert data["reductions"][0]["lens"] == "fanguan"
    assert data["aspiration"]["text"] == "live well"


def test_concern_is_frozen():
    j = core.begin("x")
    with pytest.raises(Exception):
        j.seed.text = "y"  # type: ignore[misc]
