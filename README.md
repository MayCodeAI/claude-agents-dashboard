# Agent Dashboard

Local dashboard that shows what your Claude Code agents are doing across
every project on your machine, in real time. Open
<http://localhost:3333> once the server is running.

## Install

```bash
npm install
```

## Run

```bash
npm start
```

Leave the terminal running. While the server is up, every Claude Code
session that has the hooks wired up will appear as a card with live
status: **Working**, **Awaiting input**, or **Idle**.

## Copy the hooks into your global Claude config

From the repo root:

```bash
HOOKS_DEST="$HOME/.claude/hooks/agent-dashboard"
mkdir -p "$HOOKS_DEST"
cp hooks/*.mjs "$HOOKS_DEST/"
chmod +x "$HOOKS_DEST"/*.mjs
```

Re-run the same block after editing any hook in the repo — it
overwrites the installed copies.

## Wire up the hooks in `~/.claude/settings.json`

Replace `/absolute/path/to/HOME` with your actual `$HOME`
(e.g. `/Users/yourname`). Claude Code's `command` field does **not**
expand `~` or shell variables.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/HOME/.claude/hooks/agent-dashboard/on-prompt-submit.mjs"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/HOME/.claude/hooks/agent-dashboard/on-stop.mjs"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/HOME/.claude/hooks/agent-dashboard/on-notification.mjs"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/HOME/.claude/hooks/agent-dashboard/on-ask-user-question.mjs"
          }
        ]
      },
      {
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/HOME/.claude/hooks/agent-dashboard/on-pre-tool-use.mjs"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/HOME/.claude/hooks/agent-dashboard/on-ask-user-question-answered.mjs"
          }
        ]
      }
    ]
  }
}
```

If `settings.json` already has any of those hook blocks (e.g. for the
english-coach hook), add this project's `command` to the existing
`hooks` array — don't replace the whole block.

Restart any open Claude Code sessions after saving.
