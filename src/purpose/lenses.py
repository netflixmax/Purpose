"""化简透镜 — the five reduction lenses.

Each lens encodes one heuristic for "化繁为简". The recursion terminates
at 锚据 — when the user judges that the current concern is directly
intuitable, that concern becomes the 志.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class LensType(str, Enum):
    GUIBEN = "guiben"      # 归本 — strip incidentals, return to root
    FANGUAN = "fanguan"    # 反观 — inversion, 反者道之动
    DINGXING = "dingxing"  # 定型 — find the prototype family
    YOUSHI = "youshi"      # 优势 — split deduction (→ AI) from intuition (← human)
    ANJU = "anju"          # 锚据 — terminate: is this directly intuitable?


@dataclass(frozen=True, slots=True)
class Lens:
    type: LensType
    name: str
    gloss: str
    socratic: str
    is_terminal: bool = False


LENSES: dict[LensType, Lens] = {
    LensType.GUIBEN: Lens(
        type=LensType.GUIBEN,
        name="归本",
        gloss="为学日益，为道日损 — 把不本质的剥掉。",
        socratic=(
            "如果你必须删掉这个困惑里的一半字，只留最不可省的那一半，"
            "剩下的是什么？再删一半呢？"
        ),
    ),
    LensType.FANGUAN: Lens(
        type=LensType.FANGUAN,
        name="反观",
        gloss="反者道之动 — 从反面看一眼。",
        socratic=(
            "如果你不去做这件事，会怎样？"
            "如果反过来做——不是追求这个，而是允许它的反面——"
            "那个反面的样子，是否其实是你真正在追问的？"
        ),
    ),
    LensType.DINGXING: Lens(
        type=LensType.DINGXING,
        name="定型",
        gloss="把它归到一个原型族。",
        socratic=(
            "这桩担忧属于哪一族？是关于「变换」「结构」「变化」「分布」，"
            "还是关于「关系」「时间」「认同」「自由」？"
            "把它认作那一族的一个例子，那一族的核心问题是什么？"
        ),
    ),
    LensType.YOUSHI: Lens(
        type=LensType.YOUSHI,
        name="优势",
        gloss="演绎归 AI，直觉留己。",
        socratic=(
            "这个困惑里，哪一部分是「演绎可解」的——只要算力够、信息够，"
            "可以交给 AI 或工具？把这部分剥离掉。"
            "剩下的、必须由你的直觉与处境去判断的那一小块，是什么？"
        ),
    ),
    LensType.ANJU: Lens(
        type=LensType.ANJU,
        name="锚据",
        gloss="到底了吗？这一层你能凭直觉一眼判断吗？",
        socratic=(
            "停。看着当前这个陈述，不思考、不论证——"
            "你能直觉地、像采集狩猎时那样一眼判断它的方向吗？"
            "如果能，这就是你的志。"
        ),
        is_terminal=True,
    ),
}


def get(lens: LensType) -> Lens:
    return LENSES[lens]


def listed() -> list[Lens]:
    return list(LENSES.values())
