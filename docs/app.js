// 读志 — 主应用。简易状态机 + hash 路由，无框架，纯函数渲染。

import { LENSES, LENS_BY_ID, lensName } from "./lenses.js";
import {
  listReadings,
  getReading,
  createReading,
  addReduction,
  setAspiration,
  setReview,
  deleteReading,
  exportAll,
  currentText,
  currentDepth,
  readingStatus,
} from "./storage.js";
import { structuralPropose } from "./midwife.js";

const $ = (id) => document.getElementById(id);
const root = $("app");

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
  if (mo < 12) return `${mo} 个月前`;
  return `${Math.floor(mo / 12)} 年前`;
}

function navigate(hash) {
  if (location.hash === hash) {
    render();
  } else {
    location.hash = hash;
  }
}

// ── header ─────────────────────────

function headerHTML(nav = "") {
  return `
    <header class="header">
      <div class="brand"><span class="seal">志</span> 读志</div>
      <div class="nav">${nav}</div>
    </header>
  `;
}

// ── views ─────────────────────────

function renderHome() {
  const readings = listReadings();
  const cards = readings
    .map((r) => {
      const status = readingStatus(r);
      const statusLabel = {
        drafting: "化简中",
        pending: "待复盘",
        answered: "已答 ✓",
        partial: "部分回答",
        unanswered: "未答",
        abandoned: "弃读",
      }[status];
      const intent = r.aspiration
        ? r.aspiration.text
        : `（${currentDepth(r)} 层化简中 · ${currentText(r)}）`;
      return `
        <div class="reading-card status-${status}" data-id="${r.id}">
          <div class="title">${escape(r.book_title)}</div>
          <div class="intent">${escape(intent)}</div>
          <div class="meta">
            <span>${timeAgo(r.created_at)}</span>
            <span class="status">${statusLabel}</span>
          </div>
        </div>
      `;
    })
    .join("");

  const empty =
    readings.length === 0
      ? `
        <div class="empty">
          <div class="seal-mark">志</div>
          <div class="hint">
            还没有读志。<br>
            打开下一本书之前，先在这里立一个志——<br>
            把"我想读这本书"化简成"这本书要为我回答的那一个问题"。
          </div>
        </div>
      `
      : "";

  root.innerHTML = `
    ${headerHTML("")}

    <div class="intro-quotes">
      <div class="quote">志不立，天下无可成之事。</div>
      <div class="attr">— 阳明</div>
      <div class="quote">为学日益，为道日损。</div>
      <div class="attr">— 老子</div>
    </div>

    <div class="btn-group">
      <button class="btn primary seal" data-action="new">+ 立一个读志</button>
    </div>

    <h2>我的读志谱</h2>
    ${empty}
    <div class="reading-list">${cards}</div>

    <hr class="rule">
    <div class="btn-group">
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
    a.download = `readings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  root.querySelectorAll(".reading-card").forEach((el) => {
    el.addEventListener("click", () => navigate(`#r/${el.dataset.id}`));
  });
}

function renderCompose() {
  root.innerHTML = `
    ${headerHTML(`<a href="#home" class="dim">取消</a>`)}

    <h2>立一个读志</h2>
    <p class="dim" style="margin-top:0.6rem;">
      打开这本书之前，先把"我想读它"化简成"它必须为你回答的那一个问题"。
    </p>

    <div class="field">
      <label>书名</label>
      <input class="text" id="book_title" placeholder="《逻辑哲学论》" autocomplete="off">
    </div>
    <div class="field">
      <label>此刻你为何想打开这本书？（1-3 句）</label>
      <textarea class="text" id="seed_text" rows="4"
        placeholder="比如：我想了解维特根斯坦的思想"></textarea>
    </div>
    <div class="btn-group">
      <button class="btn primary" data-action="begin">进入化简 →</button>
    </div>
  `;

  root.querySelector("[data-action=begin]")?.addEventListener("click", () => {
    const book_title = $("book_title").value.trim();
    const seed_text = $("seed_text").value.trim();
    if (!book_title) {
      $("book_title").focus();
      return;
    }
    if (!seed_text) {
      $("seed_text").focus();
      return;
    }
    const r = createReading({ book_title, seed_text });
    navigate(`#r/${r.id}`);
  });
}

function renderReadingDetail(id) {
  const r = getReading(id);
  if (!r) {
    navigate("#home");
    return;
  }

  // 已立志且已复盘 → 详情查看
  // 已立志未复盘 → 立志页 + 复盘按钮
  // 化简中 → 透镜菜单
  if (r.aspiration && r.review) {
    return renderReviewedDetail(r);
  }
  if (r.aspiration) {
    return renderSettled(r);
  }
  return renderReduce(r);
}

function pathHTML(r) {
  const steps = [];
  steps.push(`
    <div class="path-step">
      <div class="lv">Lv0</div>
      <div class="body">${escape(r.seed.text)}</div>
    </div>
  `);
  r.reductions.forEach((red, i) => {
    const isCurrent = i === r.reductions.length - 1 && !r.aspiration;
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

function renderReduce(r) {
  const current = currentText(r);
  const depth = currentDepth(r);

  const lensListHTML = LENSES.map(
    (l) => `
    <button class="lens-btn ${l.terminal ? "terminal" : ""}" data-lens="${l.id}">
      <span class="lens-name">${l.name}</span>
      <span class="lens-gloss">${escape(l.gloss)}${l.terminal ? " · 终止" : ""}</span>
    </button>
  `,
  ).join("");

  const pathSection =
    r.reductions.length > 0
      ? `<h3>化简之路</h3>${pathHTML(r)}`
      : "";

  root.innerHTML = `
    ${headerHTML(`<a href="#home" class="dim">← 谱</a>`)}

    <h2 class="serif">${escape(r.book_title)}</h2>
    ${pathSection}

    <div class="card current">
      <div class="label">第 ${depth} 层 · 当前持有的意图</div>
      <div class="body">${escape(current)}</div>
    </div>

    <h3>选一把透镜化简</h3>
    <div class="lens-list">${lensListHTML}</div>

    <hr class="rule">
    <div class="btn-group">
      <button class="btn ghost small" data-action="delete">删除此读志</button>
    </div>
  `;

  root.querySelectorAll("[data-lens]").forEach((b) => {
    b.addEventListener("click", () => {
      navigate(`#r/${r.id}/lens/${b.dataset.lens}`);
    });
  });
  root.querySelector("[data-action=delete]")?.addEventListener("click", () => {
    if (confirm("删除这个读志？所有化简轨迹都会消失。")) {
      deleteReading(r.id);
      navigate("#home");
    }
  });
}

function renderLens(id, lensId) {
  const r = getReading(id);
  const lens = LENS_BY_ID[lensId];
  if (!r || !lens) {
    navigate(`#r/${id}`);
    return;
  }

  const proposal = structuralPropose(r, lensId);
  const current = currentText(r);

  const isTerminal = lens.terminal;
  const placeholder = isTerminal
    ? "写下这本书必须回答的那一个具体问题"
    : "写下化简后的一句陈述";

  const submitLabel = isTerminal ? "立为读志 ✦" : "应用化简";

  root.innerHTML = `
    ${headerHTML(`<a href="#r/${r.id}" class="dim">← 透镜</a>`)}

    <h2 class="serif">${lens.name}</h2>
    <div class="card ${isTerminal ? "terminal" : "current"}">
      <div class="label">当前持有的意图</div>
      <div class="body">${escape(current)}</div>
    </div>

    <div class="socratic">${escape(proposal.socratic)}</div>
    ${proposal.note ? `<div class="midwife-note">产婆：${escape(proposal.note)}</div>` : ""}

    <div class="field" style="margin-top:1.5rem;">
      <label>${isTerminal ? "读志（一句话）" : "化简（一行短句）"}</label>
      <textarea class="text" id="reduction_text" rows="3"
        placeholder="${placeholder}"></textarea>
    </div>

    <div class="btn-group">
      <button class="btn primary ${isTerminal ? "seal" : ""}" data-action="submit">${submitLabel}</button>
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
      setAspiration(r.id, text);
    } else {
      addReduction(r.id, { lens: lensId, text });
    }
    navigate(`#r/${r.id}`);
  });
  root.querySelector("[data-action=back]")?.addEventListener("click", () => {
    navigate(`#r/${r.id}`);
  });
}

function renderSettled(r) {
  root.innerHTML = `
    ${headerHTML(`<a href="#home" class="dim">← 谱</a>`)}

    <div class="settled-banner">
      <div class="stamp">✦ 读 志 立 ✦</div>
      <div class="reading-intent">${escape(r.aspiration.text)}</div>
      <div class="book">《${escape(r.book_title)}》</div>
    </div>

    <h3>化简之路</h3>
    ${pathHTML(r)}

    <div class="btn-group">
      <button class="btn primary" data-action="review">读完了 · 复盘</button>
      <button class="btn" data-action="home">回到读志谱</button>
    </div>

    <hr class="rule">
    <div class="btn-group">
      <button class="btn ghost small" data-action="delete">删除此读志</button>
    </div>
  `;

  root.querySelector("[data-action=review]")?.addEventListener("click", () => {
    navigate(`#r/${r.id}/review`);
  });
  root.querySelector("[data-action=home]")?.addEventListener("click", () => {
    navigate("#home");
  });
  root.querySelector("[data-action=delete]")?.addEventListener("click", () => {
    if (confirm("删除这个读志？所有化简轨迹和读志都会消失。")) {
      deleteReading(r.id);
      navigate("#home");
    }
  });
}

function renderReview(id) {
  const r = getReading(id);
  if (!r || !r.aspiration) {
    navigate(`#r/${id}`);
    return;
  }

  root.innerHTML = `
    ${headerHTML(`<a href="#r/${r.id}" class="dim">取消</a>`)}

    <h2 class="serif">复盘 ·《${escape(r.book_title)}》</h2>

    <div class="card">
      <div class="label">你当初的读志</div>
      <div class="body" style="color:var(--gold);">${escape(r.aspiration.text)}</div>
    </div>

    <h3>这个问题被回答了吗？</h3>
    <div class="btn-group horiz">
      <button class="btn" data-status="answered">是</button>
      <button class="btn" data-status="partial">部分</button>
      <button class="btn" data-status="unanswered">没有</button>
    </div>
    <div class="btn-group" style="margin-top:0.4rem;">
      <button class="btn ghost small" data-status="abandoned">弃读 / 没读完</button>
    </div>

    <div class="field" style="margin-top:1.2rem;">
      <label>写下你实际学到的（或：为什么没读完）</label>
      <textarea class="text" id="answer_text" rows="4"
        placeholder="一句话也好，几行也好"></textarea>
    </div>

    <div class="field">
      <label>这本书催生了下一个读志吗？（可留空）</label>
      <textarea class="text" id="spawned_text" rows="2"
        placeholder="下一本书需要回答的那个问题"></textarea>
    </div>

    <div class="btn-group">
      <button class="btn primary seal" data-action="save">封印复盘</button>
    </div>
  `;

  let chosen_status = null;
  root.querySelectorAll("[data-status]").forEach((b) => {
    b.addEventListener("click", () => {
      chosen_status = b.dataset.status;
      root.querySelectorAll("[data-status]").forEach((x) =>
        x.classList.remove("primary"),
      );
      b.classList.add("primary");
    });
  });
  root.querySelector("[data-action=save]")?.addEventListener("click", () => {
    if (!chosen_status) {
      alert("请先选一个状态：是 / 部分 / 没有 / 弃读");
      return;
    }
    const answer = $("answer_text").value.trim();
    const spawned = $("spawned_text").value.trim();
    setReview(r.id, {
      status: chosen_status,
      answer,
      spawned_question: spawned || null,
    });

    if (spawned) {
      const child = createReading({
        book_title: "（待选书）",
        seed_text: spawned,
      });
      child.spawned_from = r.id;
    }
    navigate(`#r/${r.id}`);
  });
}

function renderReviewedDetail(r) {
  const rv = r.review;
  const statusLabel = {
    answered: "已答 ✓",
    partial: "部分回答",
    unanswered: "未答",
    abandoned: "弃读",
  }[rv.status];

  root.innerHTML = `
    ${headerHTML(`<a href="#home" class="dim">← 谱</a>`)}

    <h2 class="serif">《${escape(r.book_title)}》</h2>

    <div class="card terminal">
      <div class="label">读志（${escape(statusLabel)}）</div>
      <div class="body">${escape(r.aspiration.text)}</div>
    </div>

    <h3>实际学到</h3>
    <div class="card">
      <div class="body">${rv.answer ? nl2br(rv.answer) : '<span class="dim">（未填写）</span>'}</div>
    </div>

    ${
      rv.spawned_question
        ? `
      <h3>催生的下一个读志</h3>
      <div class="card current">
        <div class="body">${escape(rv.spawned_question)}</div>
      </div>
    `
        : ""
    }

    <h3>化简之路</h3>
    ${pathHTML(r)}

    <div class="btn-group">
      <button class="btn" data-action="home">回到读志谱</button>
    </div>

    <hr class="rule">
    <div class="btn-group">
      <button class="btn ghost small" data-action="delete">删除此读志</button>
    </div>
  `;

  root.querySelector("[data-action=home]")?.addEventListener("click", () => {
    navigate("#home");
  });
  root.querySelector("[data-action=delete]")?.addEventListener("click", () => {
    if (confirm("删除这个读志？所有数据都会消失。")) {
      deleteReading(r.id);
      navigate("#home");
    }
  });
}

// ── router ─────────────────────────

function render() {
  const hash = location.hash.replace(/^#/, "") || "home";
  // 路由：home | new | r/:id | r/:id/lens/:lensId | r/:id/review
  const parts = hash.split("/");
  if (parts[0] === "home") return renderHome();
  if (parts[0] === "new") return renderCompose();
  if (parts[0] === "r" && parts[1]) {
    const id = parts[1];
    if (parts[2] === "lens" && parts[3]) {
      return renderLens(id, parts[3]);
    }
    if (parts[2] === "review") {
      return renderReview(id);
    }
    return renderReadingDetail(id);
  }
  return renderHome();
}

window.addEventListener("hashchange", render);
window.addEventListener("load", () => {
  render();
  // 注册 service worker — 让 PWA 可离线
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
