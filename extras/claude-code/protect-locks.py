#!/usr/bin/env python3
"""PreToolUse hook: block Edit/Write/MultiEdit that changes or removes text
locked with %%LOCK%%...%%/LOCK%% (Script Lock Obsidian plugin)."""
import json
import os
import re
import sys
from collections import Counter

LOCK_RE = re.compile(r"%%LOCK%%[\s\S]*?%%/LOCK%%")


def apply_edit(text, old, new, replace_all):
    if not old or old not in text:
        return None  # the tool itself will fail; nothing to guard
    return text.replace(old, new) if replace_all else text.replace(old, new, 1)


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    tool = data.get("tool_name", "")
    inp = data.get("tool_input") or {}
    path = inp.get("file_path") or ""
    if not path.endswith(".md") or not os.path.isfile(path):
        return 0
    try:
        with open(path, encoding="utf-8") as f:
            before = f.read()
    except Exception:
        return 0
    if "%%LOCK%%" not in before:
        return 0

    after = before
    if tool == "Write":
        after = inp.get("content", "")
    elif tool == "Edit":
        after = apply_edit(before, inp.get("old_string", ""), inp.get("new_string", ""), inp.get("replace_all", False))
    elif tool == "MultiEdit":
        for e in inp.get("edits") or []:
            after = apply_edit(after, e.get("old_string", ""), e.get("new_string", ""), e.get("replace_all", False))
            if after is None:
                break
    else:
        return 0
    if after is None:
        return 0

    old_locks = Counter(LOCK_RE.findall(before))
    new_locks = Counter(LOCK_RE.findall(after))
    broken = [seg for seg, n in old_locks.items() if new_locks[seg] < n]
    if not broken:
        return 0

    samples = "\n".join("  - " + (s if len(s) <= 120 else s[:117] + "...") for s in broken[:5])
    reason = (
        f"拦截：这次修改会改动或删除 {len(broken)} 处用户已锁定的文案（%%LOCK%%…%%/LOCK%% 之间的内容）。\n"
        f"{samples}\n"
        "锁定内容（包括标记本身）必须逐字保留。请只改锁定区域以外的文字；"
        "old_string 不要跨进锁定区，或者在 new_string 里原样保留整段锁定内容。"
        "如果确实需要改锁定段落，请先告诉用户，由用户在 Obsidian 里解锁。"
    )
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
