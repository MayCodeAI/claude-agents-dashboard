# Agent Dashboard

Local dashboard that shows what your Claude Code agents are doing across every
project on your machine, in real time. Each Claude Code session reports when it
starts processing a prompt and when it stops, via two hooks that POST to a
local Express server. The dashboard subscribes to a Server-Sent Events stream,
so updates are pushed instantly — no 5-second polling.

## What you see

For each agent (one card per `session_id`):

- working directory (`cwd`)
- first 80 characters of the current prompt
- start time, end time, live duration
- status: **Working** (no end time yet) or **Idle** (last prompt finished)

A "remove" button on each card drops that session from the in-memory state.

## Install

```bash
cd /Users/pawelmaj/Documents/Projects/My/AgentDashboard
npm install
```

## Run

```bash
npm start
```

Opens on <http://localhost:3333>. Open that URL in any browser. Leave the
terminal running — the dashboard only works while the server is up. When the
server is down, the hooks fail silently (1-second timeout) and your agents are
not blocked.

## Wire up the hooks (global)

Edit `~/.claude/settings.json` to add a `UserPromptSubmit` and `Stop` hook
that runs for every Claude Code session, regardless of project:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/pawelmaj/Documents/Projects/My/AgentDashboard/hooks/on-prompt-submit.mjs"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/pawelmaj/Documents/Projects/My/AgentDashboard/hooks/on-stop.mjs"
          }
        ]
      }
    ]
  }
}
```

If you already have other `UserPromptSubmit` or `Stop` hooks configured (e.g.
the english-coach hook), add this command to the existing `hooks` array —
don't replace the whole block.

After saving, restart any open Claude Code sessions so they pick up the new
hook config.

## Architecture

```
Claude Code session ─[UserPromptSubmit hook]─┐
Claude Code session ─[Stop hook]──────────── │ POST JSON
                                             ▼
                              http://localhost:3333  (Express)
                                             │
                                             │ SSE push
                                             ▼
                                  Browser dashboard
```

- `server.js` — Express server on `127.0.0.1:3333`. Two POST endpoints
  (`/events/start`, `/events/stop`), one DELETE endpoint, one SSE endpoint
  (`/events`). State is an in-memory `Map<session_id, agent>`.
- `public/index.html` — single-page dashboard. Connects via `EventSource`,
  renders cards, ticks duration every second for live "Working · 12s".
- `hooks/on-prompt-submit.mjs` — reads hook JSON from stdin
  (`session_id`, `cwd`, `prompt`), POSTs `/events/start` with a 1-second
  timeout.
- `hooks/on-stop.mjs` — reads hook JSON from stdin, POSTs `/events/stop`.

State is not persisted. Restart the server → empty dashboard.

## Troubleshooting

**Dashboard is empty.** Check that the server prints "Agent dashboard
listening on http://localhost:3333" and that `~/.claude/settings.json` points
to the hook paths above. Restart your Claude Code session after editing
settings.

**Hook seems slow.** It shouldn't — the hooks have a 1-second timeout and
fail silently. If the server is down, the hook returns immediately. If you
suspect otherwise, run the hook by hand:

```bash
echo '{"session_id":"x","cwd":"/tmp","prompt":"test"}' | \
  /Users/pawelmaj/Documents/Projects/My/AgentDashboard/hooks/on-prompt-submit.mjs
```

**Port 3333 already in use.** Start the server on a different port:
`PORT=4444 npm start`. The hooks are hardcoded to 3333 — edit
`hooks/*.mjs` if you change it.
