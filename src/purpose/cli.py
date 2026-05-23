"""CLI — the user-facing midwife dialogue.

A single command: `purpose`. Walks one person through one journey,
from a seed concern down through chosen lenses to their 志, then
persists the trace as clean training data.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import typer
from rich.align import Align
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.rule import Rule
from rich.table import Table
from rich.text import Text

from purpose import core, journal
from purpose.core import Journey
from purpose.lenses import LENSES, LensType, listed
from purpose.midwife import Midwife, Proposal, StructuralMidwife


app = typer.Typer(
    add_completion=False,
    help="立志的递归算法 — A recursive midwife for finding one's 志.",
)

console = Console()

INK = "color(94)"        # ink-paper ochre
SEAL = "color(160)"      # vermilion seal
DIM = "color(244)"
CYAN = "color(38)"


def _opening() -> Panel:
    body = Text.assemble(
        ("立志的递归算法\n\n", f"bold {INK}"),
        ("志不立，天下无可成之事。", f"italic {INK}"),
        ("                — 阳明\n", f"dim {INK}"),
        ("为学日益，为道日损。", f"italic {INK}"),
        ("                        — 老子\n", f"dim {INK}"),
    )
    return Panel(
        Align.center(body),
        border_style=INK,
        padding=(1, 4),
    )


def _make_midwife(engine: str) -> Midwife:
    if engine == "structural":
        return StructuralMidwife()
    if engine == "llm":
        from purpose.llm_midwife import LLMMidwife
        return LLMMidwife()
    raise typer.BadParameter(f"未知 engine: {engine}（可选 structural / llm）")


def _render_path(j: Journey) -> Panel | None:
    if not j.reductions:
        return None
    table = Table.grid(padding=(0, 1))
    table.add_column(justify="right", style=DIM)
    table.add_column(justify="left", style=DIM)
    for i, c in enumerate(j.path()):
        marker = "·" if i < len(j.path()) - 1 else "▎"
        table.add_row(f"Lv{c.depth}", f"{marker} {c.text}")
    return Panel(table, title="化简之路", border_style=DIM, title_align="left")


def _render_current(j: Journey) -> Panel:
    c = j.current
    body = Text(c.text, style=f"bold {CYAN}")
    return Panel(
        body,
        title=f"第 {c.depth} 层 · 当前持有的困惑",
        title_align="left",
        border_style=CYAN,
        padding=(1, 2),
    )


def _render_lenses() -> Panel:
    table = Table.grid(padding=(0, 2))
    table.add_column(style=f"bold {INK}", justify="right")
    table.add_column(style=f"bold {INK}")
    table.add_column(style=DIM)
    for i, lens in enumerate(listed(), 1):
        tag = "（终止）" if lens.is_terminal else ""
        table.add_row(f"[{i}]", lens.name, f"{lens.gloss} {tag}")
    table.add_row("[c]", "自述", "自己写下化简后的样子")
    table.add_row("[q]", "退出", "保留当前进度，不立志")
    return Panel(table, title="化简透镜", border_style=INK, title_align="left")


def _render_proposal(p: Proposal, lens: LensType) -> Panel:
    spec = LENSES[lens]
    inner = Text.assemble(
        (spec.name + " · ", f"bold {SEAL}"),
        (spec.socratic, f"italic {INK}"),
        "\n",
    )
    if p.note:
        inner.append("\n")
        inner.append("产婆: ", style=f"dim {SEAL}")
        inner.append(p.note, style=INK)
        inner.append("\n")
    if p.candidates:
        inner.append("\n候选化简：\n", style=f"bold {INK}")
        for i, cand in enumerate(p.candidates):
            letter = chr(ord("a") + i)
            inner.append(f"  [{letter}]  ", style=f"bold {SEAL}")
            inner.append(cand + "\n", style=CYAN)
    if p.anchor_suggestion:
        inner.append("\n如已到底，立志为：\n", style=f"bold {SEAL}")
        inner.append("  " + p.anchor_suggestion + "\n", style=f"bold {CYAN}")
    return Panel(inner, border_style=SEAL, padding=(1, 2))


def _prompt_lens() -> LensType | str:
    valid_idx = {str(i): lens.type for i, lens in enumerate(listed(), 1)}
    while True:
        ans = Prompt.ask(
            Text("选一把透镜（1-5 / c / q）", style=f"bold {INK}"),
            default="1",
            show_default=False,
        ).strip().lower()
        if ans in {"q", "c"}:
            return ans
        if ans in valid_idx:
            return valid_idx[ans]
        console.print(f"[{DIM}]请输入 1-5、c 或 q。[/{DIM}]")


def _prompt_pick(proposal: Proposal, terminal: bool) -> tuple[str, str]:
    """Return (kind, payload). kind ∈ {'pick','edit','anchor','back'}."""
    options = []
    for i, cand in enumerate(proposal.candidates):
        options.append((chr(ord("a") + i), "pick", cand))
    options.append(("e", "edit", ""))
    if terminal and proposal.anchor_suggestion:
        options.append(("y", "anchor", proposal.anchor_suggestion))
    if terminal:
        options.append(("z", "anchor", ""))  # write own aspiration
    options.append(("b", "back", ""))

    legend_bits = []
    for k, kind, val in options:
        if kind == "pick":
            legend_bits.append(f"[{k}] 选这条")
        elif kind == "edit":
            legend_bits.append("[e] 自己写化简")
        elif kind == "anchor" and val:
            legend_bits.append("[y] 接受为志")
        elif kind == "anchor":
            legend_bits.append("[z] 自己写下志")
        elif kind == "back":
            legend_bits.append("[b] 换一把透镜")
    console.print(f"[{DIM}]  " + "  ".join(legend_bits) + f"[/{DIM}]")

    valid = {k: (kind, val) for k, kind, val in options}
    while True:
        ans = Prompt.ask("选择", default="b", show_default=False).strip().lower()
        if ans in valid:
            kind, val = valid[ans]
            if kind == "edit":
                text = Prompt.ask("  写下你的化简（一行短句）").strip()
                if not text:
                    continue
                return ("pick", text)
            if kind == "anchor" and not val:
                text = Prompt.ask("  写下你的志（一句话）").strip()
                if not text:
                    continue
                return ("anchor", text)
            return (kind, val)
        console.print(f"[{DIM}]无效选择。[/{DIM}]")


def _show_settled(j: Journey) -> None:
    assert j.aspiration is not None
    console.print()
    console.print(Rule(style=SEAL))
    asp = Text.assemble(
        ("✦ 立志 ✦\n\n", f"bold {SEAL}"),
        (j.aspiration.text, f"bold {CYAN}"),
        ("\n\nLv", DIM),
        (str(j.aspiration.depth), f"bold {INK}"),
        ("  ·  化简 ", DIM),
        (str(len(j.reductions)), f"bold {INK}"),
        (" 次", DIM),
    )
    console.print(Panel(Align.center(asp), border_style=SEAL, padding=(2, 4)))
    panel = _render_path(j)
    if panel is not None:
        console.print(panel)


def _run_loop(j: Journey, midwife: Midwife) -> Journey:
    while not j.is_settled:
        console.print()
        path = _render_path(j)
        if path is not None:
            console.print(path)
        console.print(_render_current(j))
        console.print(_render_lenses())

        choice = _prompt_lens()
        if choice == "q":
            return j
        if choice == "c":
            text = Prompt.ask("  写下你自己心目中的化简（一行短句）").strip()
            if not text:
                continue
            j = core.reduce(j, LensType.GUIBEN, text, midwife_note="（用户自述）")
            continue

        lens: LensType = choice  # type: ignore[assignment]
        with console.status(
            f"[{DIM}]向产婆请教中…[/{DIM}]", spinner="dots"
        ):
            proposal = midwife.propose(j, lens)

        console.print(_render_proposal(proposal, lens))
        kind, payload = _prompt_pick(proposal, terminal=LENSES[lens].is_terminal)
        if kind == "back":
            continue
        if kind == "anchor":
            j = core.anchor(j, payload)
            continue
        # kind == "pick"
        note = proposal.note if midwife.name == "llm" else ""
        j = core.reduce(j, lens, payload, midwife_note=note)
    return j


@app.command()
def main(
    engine: str = typer.Option(
        "structural",
        "--engine",
        "-e",
        help="化简引擎：structural（离线）或 llm（调 Claude）。",
    ),
    journal_path: Optional[Path] = typer.Option(
        None,
        "--journal",
        "-j",
        help="自定义 journal.jsonl 路径。",
    ),
):
    """走一趟立志：从一个困惑递归化简到你的志。"""

    if engine == "llm" and not os.environ.get("ANTHROPIC_API_KEY"):
        console.print(
            f"[{SEAL}]提示：未检测到 ANTHROPIC_API_KEY，"
            f"将自动回落到 structural 模式。[/{SEAL}]"
        )
        engine = "structural"

    midwife = _make_midwife(engine)

    console.print()
    console.print(_opening())
    console.print(
        f"[{DIM}]引擎：{midwife.name}  ·  "
        f"按 ctrl-c 任意时刻退出  ·  完成后将写入 ~/.purpose/journal.jsonl[/{DIM}]"
    )
    console.print()

    seed_text = Prompt.ask(
        Text("你心中此刻持有的困惑或议题是什么？", style=f"bold {INK}")
    ).strip()
    if not seed_text:
        console.print(f"[{DIM}]未输入困惑，退出。[/{DIM}]")
        raise typer.Exit(0)

    journey = core.begin(seed_text, engine=midwife.name)

    try:
        journey = _run_loop(journey, midwife)
    except KeyboardInterrupt:
        console.print(f"\n[{DIM}]中止。本次未写入。[/{DIM}]")
        raise typer.Exit(130)

    if not journey.is_settled:
        console.print(f"\n[{DIM}]未立志；本次未写入。[/{DIM}]")
        raise typer.Exit(0)

    _show_settled(journey)
    target = journal.write(journey, journal_path)
    console.print(f"\n[{DIM}]已记入 {target}。[/{DIM}]")


if __name__ == "__main__":
    app()
