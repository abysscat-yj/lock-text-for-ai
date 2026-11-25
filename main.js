"use strict";
// Lock Text for AI
// Wraps finished passages in %%LOCK%% ... %%/LOCK%% so AI assistants that edit
// your Markdown files know to leave them unchanged. %% is an Obsidian comment,
// so the markers are hidden in reading view but visible to anything reading the source.

const { Plugin, Notice, MarkdownView, moment } = require("obsidian");
const { ViewPlugin, Decoration, WidgetType, EditorView } = require("@codemirror/view");

const OPEN = "%%LOCK%%";
const CLOSE = "%%/LOCK%%";
const LOCK_RE = /%%LOCK%%([\s\S]*?)%%\/LOCK%%/g;
// CriticMarkup (used by comment plugins such as Review Comments): never cut a
// highlight + comment pair in half when adding markers.
const CRITIC_RE =
  /\{(?:==[\s\S]*?==|\+\+[\s\S]*?\+\+|--[\s\S]*?--|~~[\s\S]*?~~)\}(?:\{>>[\s\S]*?<<\})*|\{>>[\s\S]*?<<\}/g;

const STRINGS = {
  en: {
    cmdToggle: "Toggle lock on selection or current paragraph",
    cmdLock: "Lock selection or current paragraph",
    cmdUnlock: "Unlock passage at cursor",
    cmdUnlockAll: "Unlock all passages in this file",
    cmdCopyRule: "Copy AI instructions to clipboard",
    menuLockSel: "Lock selection",
    menuLockPara: "Lock paragraph",
    menuUnlock: "Unlock passage",
    iconLabel: "Locked. Click to unlock.",
    locked: "🔒 Locked",
    unlocked: (n) => `Unlocked ${n} passage${n === 1 ? "" : "s"}`,
    blankLine: "Cursor is on a blank line. Select the text to lock first.",
    nothing: "Nothing to lock",
    notInLock: "Cursor is not inside a locked passage",
    noLocks: "No locked passages in this file",
    status: (n) => `🔒 ${n} locked`,
    copied: "AI instructions copied to clipboard",
    rule:
      "Text between %%LOCK%% and %%/LOCK%% has been finalised and locked by the user.\n" +
      "- Keep locked text and both markers exactly as they are: no changes to wording, punctuation, position, or markers.\n" +
      "- When revising, only edit text outside locked passages. If a requested change or comment targets a locked passage, tell the user it is locked instead of editing it.\n" +
      "- When saving a new version to a new file, carry locked passages over unchanged, markers included.\n" +
      "- Never add or remove locks yourself; only the user locks and unlocks text.\n",
  },
  zh: {
    cmdToggle: "锁定或解锁选中内容 / 当前段落",
    cmdLock: "锁定选中内容（无选区则锁定当前段落）",
    cmdUnlock: "解锁光标所在的锁定段落",
    cmdUnlockAll: "解锁本文件全部段落",
    cmdCopyRule: "复制给 AI 的锁定规则",
    menuLockSel: "锁定选中内容",
    menuLockPara: "锁定当前段落",
    menuUnlock: "解锁此段",
    iconLabel: "已锁定，点击解锁",
    locked: "🔒 已锁定",
    unlocked: (n) => `已解锁 ${n} 处`,
    blankLine: "光标在空行上，请先选中要锁定的文字",
    nothing: "没有可锁定的文字",
    notInLock: "光标不在锁定段落里",
    noLocks: "本文件没有锁定段落",
    status: (n) => `🔒 ${n} 处已锁定`,
    copied: "已复制锁定规则",
    rule:
      "稿子里 %%LOCK%% 和 %%/LOCK%% 之间的内容是用户已经定稿、锁定的段落。\n" +
      "- 锁定内容和两个标记都必须逐字保留，不改字、不改标点、不挪位置、不删标记。\n" +
      "- 修改、润色、按批注改稿时，只动锁定区域以外的文字。修改要求或批注落在锁定段落上时，先告诉用户这段已锁定，不要自己改。\n" +
      "- 新版本另存为新文件时，锁定段落也要原样带过去，标记一起保留。\n" +
      "- 不要自己加锁或解锁，锁定由用户操作。\n",
  },
};

function t() {
  const lang = (moment && moment.locale && moment.locale()) || "en";
  return lang.toLowerCase().startsWith("zh") ? STRINGS.zh : STRINGS.en;
}

function findLocks(text) {
  const out = [];
  LOCK_RE.lastIndex = 0;
  let m;
  while ((m = LOCK_RE.exec(text))) {
    out.push({
      from: m.index,
      to: m.index + m[0].length,
      innerFrom: m.index + OPEN.length,
      innerTo: m.index + m[0].length - CLOSE.length,
    });
  }
  return out;
}

function stripMarkers(s) {
  return s.split(OPEN).join("").split(CLOSE).join("");
}

// Grow [from, to) until it no longer cuts through a lock or a CriticMarkup span.
function expandRange(text, from, to) {
  let changed = true;
  while (changed) {
    changed = false;
    const spans = findLocks(text).map((l) => [l.from, l.to]);
    CRITIC_RE.lastIndex = 0;
    let m;
    while ((m = CRITIC_RE.exec(text))) spans.push([m.index, m.index + m[0].length]);
    for (const [a, b] of spans) {
      if (a < to && b > from && (a < from || b > to)) {
        from = Math.min(from, a);
        to = Math.max(to, b);
        changed = true;
      }
    }
  }
  return [from, to];
}

// ---------- Editor decorations ----------

class OpenWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM(view) {
    const el = createSpan({ cls: "lock-text-for-ai-open", text: "🔒" });
    el.setAttribute("aria-label", t().iconLabel);
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = view.posAtDOM(el);
      const lock = findLocks(view.state.doc.toString()).find((l) => l.from <= pos && pos <= l.innerFrom);
      if (!lock) return;
      view.dispatch({
        changes: [
          { from: lock.innerTo, to: lock.to, insert: "" },
          { from: lock.from, to: lock.innerFrom, insert: "" },
        ],
        userEvent: "delete.unlock",
      });
      new Notice(t().unlocked(1));
    });
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

class CloseWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    return createSpan({ cls: "lock-text-for-ai-close" });
  }
}

const openDeco = Decoration.replace({ widget: new OpenWidget() });
const closeDeco = Decoration.replace({ widget: new CloseWidget() });
const markDeco = Decoration.mark({ class: "lock-text-for-ai-locked" });

function buildDecorations(view) {
  const text = view.state.doc.toString();
  if (text.indexOf(OPEN) === -1) return Decoration.none;
  const decos = [];
  for (const l of findLocks(text)) {
    decos.push(openDeco.range(l.from, l.innerFrom));
    if (l.innerTo > l.innerFrom) decos.push(markDeco.range(l.innerFrom, l.innerTo));
    decos.push(closeDeco.range(l.innerTo, l.to));
  }
  return Decoration.set(decos, true);
}

const lockViewPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildDecorations(view);
    }
    update(u) {
      if (u.docChanged) this.decorations = buildDecorations(u.view);
    }
  },
  {
    decorations: (v) => v.decorations,
    // Make the cursor skip markers as a unit so they can't be half-deleted.
    provide: (p) =>
      EditorView.atomicRanges.of((view) => {
        const inst = view.plugin(p);
        return inst ? inst.decorations : Decoration.none;
      }),
  }
);

// ---------- Plugin ----------

module.exports = class LockTextForAIPlugin extends Plugin {
  onload() {
    const s = t();
    this.registerEditorExtension(lockViewPlugin);

    this.addCommand({ id: "toggle-lock", name: s.cmdToggle, editorCallback: (e) => this.toggle(e) });
    this.addCommand({ id: "lock", name: s.cmdLock, editorCallback: (e) => this.lock(e) });
    this.addCommand({ id: "unlock", name: s.cmdUnlock, editorCallback: (e) => this.unlock(e) });
    this.addCommand({ id: "unlock-all", name: s.cmdUnlockAll, editorCallback: (e) => this.unlockAll(e) });
    this.addCommand({
      id: "copy-ai-instructions",
      name: s.cmdCopyRule,
      callback: async () => {
        await navigator.clipboard.writeText(t().rule);
        new Notice(t().copied);
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        const s2 = t();
        const hit = this.locksAtCursor(editor).length > 0;
        const hasSel = editor.somethingSelected();
        if (hasSel || !hit) {
          menu.addItem((i) =>
            i
              .setTitle(hasSel ? s2.menuLockSel : s2.menuLockPara)
              .setIcon("lock")
              .setSection("action")
              .onClick(() => this.lock(editor))
          );
        }
        if (hit) {
          menu.addItem((i) =>
            i.setTitle(s2.menuUnlock).setIcon("unlock").setSection("action").onClick(() => this.unlock(editor))
          );
        }
      })
    );

    this.statusEl = this.addStatusBarItem();
    const refresh = () => this.refreshStatus();
    this.registerEvent(this.app.workspace.on("active-leaf-change", refresh));
    this.registerEvent(
      this.app.workspace.on("editor-change", () => {
        window.clearTimeout(this.statusTimer);
        this.statusTimer = window.setTimeout(refresh, 300);
      })
    );
    this.app.workspace.onLayoutReady(refresh);
  }

  onunload() {
    window.clearTimeout(this.statusTimer);
  }

  refreshStatus() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const n = view ? findLocks(view.editor.getValue()).length : 0;
    this.statusEl.setText(n ? t().status(n) : "");
  }

  selRange(editor) {
    return [editor.posToOffset(editor.getCursor("from")), editor.posToOffset(editor.getCursor("to"))];
  }

  locksAtCursor(editor) {
    const [from, to] = this.selRange(editor);
    return findLocks(editor.getValue()).filter((l) =>
      from === to ? l.from <= from && from <= l.to : l.from < to && l.to > from
    );
  }

  toggle(editor) {
    if (!editor.somethingSelected() && this.locksAtCursor(editor).length) this.unlock(editor);
    else this.lock(editor);
  }

  lock(editor) {
    const s = t();
    const text = editor.getValue();
    let [from, to] = this.selRange(editor);

    if (from === to) {
      // No selection: lock the paragraph around the cursor (up to blank lines).
      const cur = editor.getCursor().line;
      if (!editor.getLine(cur).trim()) {
        new Notice(s.blankLine);
        return;
      }
      let a = cur;
      let b = cur;
      while (a > 0 && editor.getLine(a - 1).trim()) a--;
      while (b < editor.lineCount() - 1 && editor.getLine(b + 1).trim()) b++;
      from = editor.posToOffset({ line: a, ch: 0 });
      to = editor.posToOffset({ line: b, ch: editor.getLine(b).length });
    }

    while (from < to && /\s/.test(text[from])) from++;
    while (to > from && /\s/.test(text[to - 1])) to--;
    if (from === to) {
      new Notice(s.nothing);
      return;
    }

    [from, to] = expandRange(text, from, to);
    const wrapped = OPEN + stripMarkers(text.slice(from, to)) + CLOSE;
    editor.replaceRange(wrapped, editor.offsetToPos(from), editor.offsetToPos(to));
    editor.setCursor(editor.offsetToPos(from + wrapped.length));
    new Notice(s.locked);
  }

  unlock(editor) {
    const locks = this.locksAtCursor(editor);
    if (!locks.length) {
      new Notice(t().notInLock);
      return;
    }
    this.removeLocks(editor, locks);
    new Notice(t().unlocked(locks.length));
  }

  unlockAll(editor) {
    const locks = findLocks(editor.getValue());
    if (!locks.length) {
      new Notice(t().noLocks);
      return;
    }
    this.removeLocks(editor, locks);
    new Notice(t().unlocked(locks.length));
  }

  removeLocks(editor, locks) {
    const changes = [];
    for (const l of locks) {
      changes.push({ from: editor.offsetToPos(l.innerTo), to: editor.offsetToPos(l.to), text: "" });
      changes.push({ from: editor.offsetToPos(l.from), to: editor.offsetToPos(l.innerFrom), text: "" });
    }
    editor.transaction({ changes });
  }
};
