"""LLM midwife — Claude as Socratic 接生者.

The system prompt is frozen so the prefix caches across turns in a session
and across sessions. Volatile content (the journey path + chosen lens)
goes after the cached block.

Output is structured (Pydantic) so the rest of the program can treat
LLM and structural midwives identically.
"""

from __future__ import annotations

import os
from typing import Any

from pydantic import BaseModel, Field

from purpose.core import Journey
from purpose.lenses import LENSES, LensType
from purpose.midwife import Proposal


SYSTEM_PROMPT = """\
你是「立志的产婆」。你的源流：道德经的归本智慧（为学日益，为道日损；反者道之动），
阳明的立志之教（志不立，天下无可成之事），维特根斯坦的直觉主义与语言边界，
塔勒布的反脆弱与不确定性中的存活，托尔斯泰之"理性是形式，自由意志是内容"。

你的角色：你不替用户拟定志向。志一直在用户身上，你只接生。
你识别用户当下持有的「困惑」，按用户选定的「化简透镜」，给出 1–3 个候选的、
更简的陈述。候选必须：
- 比原困惑短、更接近本质；
- 用用户自己的词汇与处境，不要堆砌哲学术语；
- 朝直觉锚点收敛——用户最终应能凭一眼直觉判断它的方向。

工作原则：
- 用第二人称「你」与用户对话；中文。
- 不给建议、不发表意见、不安慰；只接生。
- 候选可以互相差异很大，但都必须是合法的化简，不是新增前提。
- 当用户选择的透镜是「锚据」(anju)，你的任务是判断当前陈述是否已达直觉锚点：
  - 如已达，给出 `anchor_suggestion`（用户立志的一句话），candidates 为空；
  - 如未达，留空 anchor_suggestion，在 note 里温和指出哪里还能再化简一层。

输出格式：严格的 JSON，字段含义如下：
- candidates: 1–3 个候选的更化简陈述（锚据透镜下且已到底时可为空数组）；
- note: 1–2 句你作为产婆的观察，第二人称中文；
- anchor_suggestion: 仅锚据透镜下且你判断已到底时，给出立志的一句话；否则 null。
"""


class LLMProposal(BaseModel):
    candidates: list[str] = Field(default_factory=list)
    note: str = ""
    anchor_suggestion: str | None = None


def _format_path(journey: Journey) -> str:
    lines = [f"Lv0  {journey.seed.text}"]
    for r in journey.reductions:
        lens = LENSES[r.lens].name
        lines.append(f"  │ {lens}")
        lines.append(f"Lv{r.to_concern.depth}  {r.to_concern.text}")
    return "\n".join(lines)


def _build_user_message(journey: Journey, lens: LensType) -> str:
    spec = LENSES[lens]
    path = _format_path(journey)
    current = journey.current
    return (
        f"# 化简之路（迄今）\n{path}\n\n"
        f"# 当前持有的困惑\n{current.text}\n\n"
        f"# 用户此刻选定的透镜\n{spec.name}：{spec.gloss}\n"
        f"它的苏格拉底式追问：{spec.socratic}\n\n"
        f"# 你的任务\n"
        f"按这把透镜，给出对「当前困惑」的 1–3 个化简候选；"
        f"若透镜是『锚据』且你判断已到底，则给 anchor_suggestion 并把 candidates 留空。"
    )


class LLMMidwife:
    """Claude-backed midwife. Caches the frozen system prompt for cost/latency."""

    name = "llm"

    def __init__(
        self,
        *,
        model: str | None = None,
        effort: str = "medium",
        max_tokens: int = 4096,
    ):
        try:
            import anthropic  # local import so structural mode never imports it
        except ImportError as e:
            raise RuntimeError(
                "anthropic 包未安装。请运行: pip install anthropic"
            ) from e
        self._anthropic = anthropic
        self._client = anthropic.Anthropic()
        self._model = model or os.environ.get("PURPOSE_MODEL", "claude-opus-4-7")
        self._effort = effort
        self._max_tokens = max_tokens

    def propose(self, journey: Journey, lens: LensType) -> Proposal:
        user_msg = _build_user_message(journey, lens)

        kwargs: dict[str, Any] = dict(
            model=self._model,
            max_tokens=self._max_tokens,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_msg}],
            output_format=LLMProposal,
        )
        # Opus 4.7: adaptive thinking + effort; sonnet/haiku: just effort if supported.
        if "opus-4-7" in self._model or "opus-4-6" in self._model or "sonnet-4-6" in self._model:
            kwargs["thinking"] = {"type": "adaptive"}
            kwargs["output_config"] = {"effort": self._effort}

        response = self._client.messages.parse(**kwargs)
        parsed: LLMProposal | None = response.parsed_output
        if parsed is None:
            return Proposal(
                socratic=LENSES[lens].socratic,
                candidates=(),
                note="（产婆此刻无言；请你自行写下化简。）",
            )
        return Proposal(
            socratic=LENSES[lens].socratic,
            candidates=tuple(parsed.candidates),
            note=parsed.note,
            anchor_suggestion=parsed.anchor_suggestion,
        )
