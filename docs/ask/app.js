// 问志 — 主应用。问 AI 前的化简产线。
// 同型于读志，但语义不同：throughput 工具而非 archive 工具。

import { LENSES, LENS_BY_ID, lensName } from "./lenses.js";
import {
  listAsks,
  getAsk,
  createAsk,
  addReduction,
  setQuestion,
  markFired,
  setFeedback,
  clearFeedback,
  deleteAsk,
  exportAll,
  currentText,
  currentDepth,
  askStatus,
} from "./storage.js";
import { structuralPropose } from "./midwife.js";

const $ = (id) => document.getElementById(id);
const root = $("app");
const toastEl = $("toast");

// ── helpers ─────────────────────────

function escape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function nl2br(s) {
  return escape(s).replace(/\n/g, "<br>");
}
function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const mo = Math.floor(day / 30);
  return `${mo} 个月前`;
}
function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}
function toast(msg, ms = 1600) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove("show"), ms);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

// AI 跳转目标。Perplexity 支持 ?q= 预填；Claude / ChatGPT 不可靠，只能打开主页让用户粘贴。
const AI_TARGETS = {
  claude: { name: "Claude", url: () => "https://claude.ai/new" },
  chatgpt: { name: "ChatGPT", url: () => "https://chatgpt.com/" },
  perplexity: {
    name: "Perplexity",
    url: (q) => `https://www.perplexity.ai/?q=${encodeURIComponent(q)}`,
  },
};

async function fireAt(askId, target, question) {
  const ok = await copyToClipboard(question);
  markFired(askId, target);
  const t = AI_TARGETS[target];
  if (target === "perplexity") {
    window.open(t.url(question), "_blank");
    toast("已复制 · 已为你预填到 Perplexity");
  } else {
    window.open(t.url(question), "_blank");
    toast(ok ? `已复制 · 去 ${t.name} 那贴` : `去 ${t.name} 手动粘`);
  }
}

// ── header ─────────────────────────

function headerHTML(nav = "") {
  return `
    <header class="header">
      <div class="brand"><span class="seal ask">问</span> 问志</div>
      <div class="nav">${nav}</div>
    </header>
  `;
}

// ── home ─────────────────────────

function renderHome() {
  const asks = listAsks();

  const statusLabel = {
    drafting: "化简中",
    ready: "待发问",
    fired: "已发问",
    gold: "金子 ✦",
    usable: "可用",
    miss: "没中",
  };

  const cards = asks
    .map((a) => {
      const st = askStatus(a);
      const intent = a.question
        ? a.question.text
        : `（${currentDepth(a)} 层化简中 · ${currentText(a)}）`;
      return `
        <div class="reading-card status-${st === "gold" ? "answered" : st === "usable" ? "partial" : st === "miss" ? "abandoned" : "pending"}" data-id="${a.id}">
          <div class="intent">${escape(intent)}</div>
          <div class="meta">
            <span>${timeAgo(a.created_at)}</span>
            <span class="status">${statusLabel[st] ?? st}</span>
          </div>
        </div>
      `;
    })
    .join("");

  const empty =
    asks.length === 0
      ? `
        <div class="empty">
          <div class="seal-mark ask">问</div>
          <div class="hint">
            还没有问志。<br>
            按 AI 之前 30 秒——<br>
            把"我想知道 X 的一切"化简成<br>
            "我此刻最想搞清楚的那一问"。
          </div>
        </div>
      `
      : "";

  root.innerHTML = `
    ${headerHTML("")}

    <div class="intro-quotes">
      <div class="quote">好问题比好答案稀缺。</div>
      <div class="attr">— 塔勒布</div>
      <div class="quote">敏而好学，不耻下问。</div>
      <div class="attr">— 论语</div>
    </div>

    <div class="btn-group">
      <button class="btn ask-primary" data-action="new">+ 化简一个问题</button>
    </div>

    <h2>我的问志</h2>
    ${empty}
    <div class="reading-list">${cards}</div>

    <hr class="rule">
    <div class="btn-group">
      <a class="btn ghost small" href="../">← 去读志</a>
      <button class="btn ghost small" data-action="export">导出全部数据</button>
    </div>
  `;

  root.querySelector("[data-action=new]")?.addEventListener("click", () => {
    navigate("#new");
  });
  root.querySelector("[data-action=export]")?.addEventListener("click", () => {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asks-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  root.querySelectorAll(".reading-card").forEach((el) => {
    el.addEventListener("click", () => navigate(`#a/${el.dataset.id}`));
  });
}

// ── compose ─────────────────────────

function renderCompose() {
  root.innerHTML = `
    ${headerHTML(`<a href="#home" class="dim">取消</a>`)}

    <h2>化简一个问题</h2>
    <p class="dim" style="margin-top:0.6rem;">
      乱写也行。先把脑子里那团乱倒出来——化简自有透镜来做。
    </p>

    <div class="field">
      <label>你想问 AI 什么？</label>
      <textarea class="text" id="seed_text" rows="5"
        placeholder="比如：我想知道为什么人都在用 X……"
        autofocus></textarea>
    </div>
    <div class="btn-group">
      <button class="btn ask-primary" data-action="begin">进入化简 →</button>
    </div>
  `;

  root.querySelector("[data-action=begin]")?.addEventListener("click", () => {
    const seed_text = $("seed_text").value.trim();
    if (!seed_text) {
      $("seed_text").focus();
      return;
    }
    const a = createAsk({ seed_text });
    navigate(`#a/${a.id}`);
  });
}

// ── detail (router) ─────────────────────────

function renderAskDetail(id) {
  const a = getAsk(id);
  if (!a) {
    navigate("#home");
    return;
  }
  if (a.question) return renderSettled(a);
  return renderReduce(a);
}

function pathHTML(a) {
  const steps = [];
  steps.push(`
    <div class="path-step">
      <div class="lv">Lv0</div>
      <div class="body">${escape(a.seed.text)}</div>
    </div>
  `);
  a.reductions.forEach((red, i) => {
    const isCurrent = i === a.reductions.length - 1 && !a.question;
    steps.push(`
      <div class="path-step ${isCurrent ? "current" : ""}">
        <div class="lv">Lv${i + 1}</div>
        <div class="body">
          <span class="lens-tag">${lensName(red.lens)}</span>${escape(red.to_text)}
        </div>
      </div>
    `);
  });
  return `<div class="path">${steps.join("")}</div>`;
}

// ── reduce (lens menu) ─────────────────────────

function renderReduce(a) {
  const current = currentText(a);
  const depth = currentDepth(a);

  const lensListHTML = LENSES.map(
    (l) => `
    <button class="lens-btn ${l.terminal ? "terminal" : ""}" data-lens="${l.id}">
      <span class="lens-name">${l.name}</span>
      <span class="lens-gloss">${escape(l.gloss)}${l.terminal ? " · 终止" : ""}</span>
    </button>
  `,
  ).join("");

  const pathSection =
    a.reductions.length > 0 ? `<h3>化简之路</h3>${pathHTML(a)}` : "";

  root.innerHTML = `
    ${headerHTML(`<a href="#home" class="dim">← 谱</a>`)}

    ${pathSection}

    <div class="card current">
      <div class="label">第 ${depth} 层 · 当前问题</div>
      <div class="body">${escape(current)}</div>
    </div>

    <h3>选一把透镜化简</h3>
    <div class="lens-list">${lensListHTML}</div>

    <hr class="rule">
    <div class="btn-group">
      <button class="btn ghost small" data-action="delete">删除此问</button>
    </div>
  `;

  root.querySelectorAll("[data-lens]").forEach((b) => {
    b.addEventListener("click", () => {
      navigate(`#a/${a.id}/lens/${b.dataset.lens}`);
    });
  });
  root.querySelector("[data-action=delete]")?.addEventListener("click", () => {
    if (confirm("删除这一问？所有化简轨迹都会消失。")) {
      deleteAsk(a.id);
      navigate("#home");
    }
  });
}

// ── apply lens ─────────────────────────

function renderLens(id, lensId) {
  const a = getAsk(id);
  const lens = LENS_BY_ID[lensId];
  if (!a || !lens) {
    navigate(`#a/${id}`);
    return;
  }

  const proposal = structuralPropose(a, lensId);
  const current = currentText(a);
  const isTerminal = lens.terminal;
  const placeholder = isTerminal
    ? "写下要送给 AI 的那一问"
    : "写下化简后的问题";
  const submitLabel = isTerminal ? "立为问志 ✦" : "应用化简";

  root.innerHTML = `
    ${headerHTML(`<a href="#a/${a.id}" class="dim">← 透镜</a>`)}

    <h2 class="serif">${lens.name}</h2>
    <div class="card ${isTerminal ? "terminal" : "current"}">
      <div class="label">当前问题</div>
      <div class="body">${escape(current)}</div>
    </div>

    <div class="socratic">${escape(proposal.socratic)}</div>
    ${proposal.note ? `<div class="midwife-note">产婆：${escape(proposal.note)}</div>` : ""}

    <div class="field" style="margin-top:1.5rem;">
      <label>${isTerminal ? "问志（一句话）" : "化简（一行短句）"}</label>
      <textarea class="text" id="reduction_text" rows="3"
        placeholder="${placeholder}"></textarea>
    </div>

    <div class="btn-group">
      <button class="btn ${isTerminal ? "ask-primary" : "primary"}" data-action="submit">${submitLabel}</button>
      <button class="btn" data-action="back">换一把透镜</button>
    </div>
  `;

  const textarea = $("reduction_text");
  textarea.focus();
  root.querySelector("[data-action=submit]")?.addEventListener("click", () => {
    const text = textarea.value.trim();
    if (!text) {
      textarea.focus();
      return;
    }
    if (isTerminal) {
      setQuestion(a.id, text);
    } else {
      addReduction(a.id, { lens: lensId, text });
    }
    navigate(`#a/${a.id}`);
  });
  root.querySelector("[data-action=back]")?.addEventListener("click", () => {
    navigate(`#a/${a.id}`);
  });
}

// ── settled (the throughput moment) ─────────────────────────

function renderSettled(a) {
  const q = a.question.text;
  const fired = a.fired;
  const fb = a.feedback;

  const feedbackSection = fired
    ? renderFeedbackWidget(a)
    : "";

  root.innerHTML = `
    ${headerHTML(`<a href="#home" class="dim">← 谱</a>`)}

    <div class="settled-banner ask">
      <div class="stamp">✦ 问 志 ✦</div>
      <div class="reading-intent">${escape(q)}</div>
      ${fired ? `<div class="book">已发问 · ${escape(AI_TARGETS[fired.target]?.name ?? fired.target)} · ${timeAgo(fired.fired_at)}</div>` : ""}
    </div>

    <div class="btn-group">
      <button class="btn ask-primary" data-fire="claude">📋 复制 & 去 Claude</button>
      <div class="btn-group horiz" style="margin:0;">
        <button class="btn" data-fire="chatgpt">去 ChatGPT</button>
        <button class="btn" data-fire="perplexity">去 Perplexity</button>
      </div>
      <button class="btn ghost small" data-action="copy-only">仅复制（不跳转）</button>
    </div>

    ${feedbackSection}

    <h3>化简之路</h3>
    ${pathHTML(a)}

    <div class="btn-group">
      <button class="btn" data-action="home">回到问志谱</button>
    </div>

    <hr class="rule">
    <div class="btn-group">
      <button class="btn ghost small" data-action="delete">删除此问志</button>
    </div>
  `;

  root.querySelectorAll("[data-fire]").forEach((b) => {
    b.addEventListener("click", () =>
      fireAt(a.id, b.dataset.fire, q).then(() => {
        setTimeout(() => render(), 250);
      }),
    );
  });
  root.querySelector("[data-action=copy-only]")?.addEventListener("click", async () => {
    const ok = await copyToClipboard(q);
    toast(ok ? "已复制" : "复制失败");
  });
  root.querySelector("[data-action=home]")?.addEventListener("click", () => {
    navigate("#home");
  });
  root.querySelector("[data-action=delete]")?.addEventListener("click", () => {
    if (confirm("删除这个问志？")) {
      deleteAsk(a.id);
      navigate("#home");
    }
  });

  // 反馈条交互
  wireFeedback(a);
}

function renderFeedbackWidget(a) {
  const fb = a.feedback;
  if (fb) {
    const label = { gold: "金子 ✦", usable: "可用", miss: "没中" }[fb.rating];
    return `
      <div class="card" style="margin-top:0.8rem;">
        <div class="label">你的复盘</div>
        <div class="body" style="font-size:1.05rem;">${escape(label)}</div>
        ${fb.note ? `<div class="midwife-note" style="margin-top:0.5rem;">${nl2br(fb.note)}</div>` : ""}
        <div style="margin-top:0.6rem;">
          <button class="btn ghost small" data-action="reset-feedback">改一下</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="card" style="margin-top:0.8rem;">
      <div class="label">AI 答得如何？</div>
      <div class="feedback-row">
        <button class="btn rate-gold" data-rate="gold">金子 ✦</button>
        <button class="btn rate-usable" data-rate="usable">可用</button>
        <button class="btn rate-miss" data-rate="miss">没中</button>
      </div>
      <textarea class="text" id="fb_note" rows="2"
        placeholder="一句话写下学到了什么 / 哪里没中（可空）"
        style="margin-top:0.6rem;"></textarea>
      <div style="margin-top:0.6rem;">
        <button class="btn small ask-primary" data-action="save-feedback" disabled>封印复盘</button>
      </div>
    </div>
  `;
}

function wireFeedback(a) {
  let chosen = null;
  const save = root.querySelector("[data-action=save-feedback]");
  root.querySelectorAll("[data-rate]").forEach((b) => {
    b.addEventListener("click", () => {
      chosen = b.dataset.rate;
      root.querySelectorAll("[data-rate]").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      if (save) save.disabled = false;
    });
  });
  save?.addEventListener("click", () => {
    if (!chosen) return;
    const note = $("fb_note")?.value.trim() ?? "";
    setFeedback(a.id, { rating: chosen, note });
    render();
  });
  root.querySelector("[data-action=reset-feedback]")?.addEventListener("click", () => {
    clearFeedback(a.id);
    render();
  });
}

// ── router ─────────────────────────

function render() {
  const hash = location.hash.replace(/^#/, "") || "home";
  const parts = hash.split("/");
  if (parts[0] === "home") return renderHome();
  if (parts[0] === "new") return renderCompose();
  if (parts[0] === "a" && parts[1]) {
    const id = parts[1];
    if (parts[2] === "lens" && parts[3]) return renderLens(id, parts[3]);
    return renderAskDetail(id);
  }
  return renderHome();
}

window.addEventListener("hashchange", render);
window.addEventListener("load", () => {
  render();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
