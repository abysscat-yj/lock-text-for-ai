# Lock Text for AI

[中文说明](#中文说明)

When you revise a draft back and forth with an AI assistant, passages you've already polished keep getting "improved" again. This plugin lets you select those passages in the editor and **lock** them. Locked text gets a soft green highlight and a 🔒 icon, and the lock is written into the Markdown source so any AI that edits the file can see it.

```markdown
Intro sentence that still needs work. %%LOCK%%This line is final, don't touch it.%%/LOCK%% More draft text.
```

`%% … %%` is Obsidian's comment syntax, so the markers are hidden in reading view and exported output, and they don't show up in your published text.

## Usage

- **Lock**: select text, right-click, and choose **Lock selection**. With no selection, **Lock paragraph** locks the paragraph around the cursor.
- **Unlock**: click the 🔒 icon, or right-click inside a locked passage and choose **Unlock passage**.
- **Commands** (assign hotkeys in Settings → Hotkeys):
  - Toggle lock on selection or current paragraph
  - Lock selection or current paragraph
  - Unlock passage at cursor
  - Unlock all passages in this file
  - Copy AI instructions to clipboard
- The status bar shows how many passages in the current file are locked.
- If a selection cuts through a CriticMarkup comment, such as the ones the Review Comments plugin creates (`{==text==}{>>comment<<}`), the lock expands to cover the whole comment so it isn't broken.

## Telling your AI about locks

The markers only help if the AI respects them. There are two ways to set that up:

1. **Instructions**: run **Copy AI instructions to clipboard** and paste the rule into your assistant's instruction file (`CLAUDE.md`, `AGENTS.md`, a system prompt, and so on).
2. **Hard block for Claude Code / Claudian (optional)**: [`extras/claude-code`](extras/claude-code) contains a `PreToolUse` hook. Before Claude edits a `.md` file, it rejects any Edit, Write, or MultiEdit that would change or remove a locked passage, and it tells Claude why. To install it, copy `protect-locks.py` to `<vault>/.claude/hooks/` and merge `settings.json` into `<vault>/.claude/settings.json`. It requires `python3`.

The hook only covers Claude's file-editing tools. Edits made through shell commands, or by other assistants, rely on the instructions alone.

## Installation

Search for **Lock Text for AI** in Settings → Community plugins. To install manually, copy `main.js`, `manifest.json`, and `styles.css` from the latest release into `<vault>/.obsidian/plugins/lock-text-for-ai/`.

---

## 中文说明

和 AI 反复改稿时，已经改好的段落常常被 AI 又改一遍。这个插件让你在编辑界面里选中这些段落，把它们**锁定**：锁定的文字有浅绿底色和 🔒 图标，锁定标记直接写在 Markdown 源码里，AI 读文件就能看到。

```markdown
这句还要改。%%LOCK%%这句定稿了，别动。%%/LOCK%%后面继续改。
```

`%% … %%` 是 Obsidian 的注释写法，阅读视图和导出结果里都看不到，不影响成稿。

### 使用

- **锁定**：选中文字后右键选「锁定选中内容」。不选文字时，「锁定当前段落」会锁住光标所在的整段。
- **解锁**：点 🔒 图标，或在锁定段里右键选「解锁此段」。
- **命令**：锁定、解锁、切换、解锁全文、复制给 AI 的锁定规则。快捷键在「设置 → 快捷键」里自己绑定。
- 状态栏会显示当前文件锁定了几处。
- 如果选区切到了 CriticMarkup 批注（比如 Review Comments 插件生成的 `{==原文==}{>>批注<<}`），锁定范围会自动扩大到整条批注。

### 让 AI 遵守锁定

1. **写规则**：运行「复制给 AI 的锁定规则」，把规则粘贴到 AI 的指令文件里（`CLAUDE.md`、`AGENTS.md`、系统提示词等）。
2. **强制拦截（可选，适用于 Claude Code / Claudian）**：[`extras/claude-code`](extras/claude-code) 里有一个 `PreToolUse` 钩子。Claude 改 `.md` 文件前，如果这次修改会改动或删掉锁定内容，会被直接驳回，并告诉它原因。安装方法：把 `protect-locks.py` 复制到 `<库>/.claude/hooks/`，把 `settings.json` 的内容合并进 `<库>/.claude/settings.json`。需要系统里有 `python3`。

钩子只管 Claude 自带的改文件工具。如果 AI 用命令行脚本改文件，或者用的是其他 AI，就只能靠规则约束。

## License

[MIT](LICENSE)
