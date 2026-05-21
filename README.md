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
- status: **Awaiting input** (agent is asking you something), **Working** (no
  end time yet), or **Idle** (last prompt finished)

When an agent is **Awaiting input**, the card gets an orange border with a
pulsing dot, the question text is shown in a highlighted block, and the
browser tab title is prefixed with `(N)` so it's visible from another tab.
Cards are sorted awaiting → working → idle.

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

Edit `~/.claude/settings.json` to add five hooks that run for every Claude
Code session, regardless of project:

- `UserPromptSubmit` — fires when you send a prompt (agent starts working).
- `Stop` — fires when the agent finishes a turn.
- `Notification` — fires when the agent is waiting for you (permission
  prompt, or idle waiting for input). Drives the **Awaiting input** state.
- `PreToolUse` (matcher `AskUserQuestion`) — fires the moment the agent
  asks you a structured question. Claude Code does **not** emit a
  `Notification` event for `AskUserQuestion`, so without this hook the
  dashboard would miss those prompts.
- `PostToolUse` (matcher `AskUserQuestion`) — fires right after you
  answer the question. Clears the **Awaiting input** state mid-turn so
  the card flips back to **Working** instead of staying orange until the
  next `Stop`.

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
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/pawelmaj/Documents/Projects/My/AgentDashboard/hooks/on-notification.mjs"
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
            "command": "/Users/pawelmaj/Documents/Projects/My/AgentDashboard/hooks/on-ask-user-question.mjs"
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
            "command": "/Users/pawelmaj/Documents/Projects/My/AgentDashboard/hooks/on-ask-user-question-answered.mjs"
          }
        ]
      }
    ]
  }
}
```

If you already have other `UserPromptSubmit`, `Stop`, `Notification`,
`PreToolUse`, or `PostToolUse` hooks configured (e.g. the english-coach
hook), add the command to the existing `hooks` array — don't replace the
whole block.

After saving, restart any open Claude Code sessions so they pick up the new
hook config.

## Architecture

```
Claude Code session ─[UserPromptSubmit hook]───────────────┐
Claude Code session ─[Notification hook]────────────────── │ POST JSON
Claude Code session ─[PreToolUse hook: AskUserQuestion]─── │
Claude Code session ─[PostToolUse hook: AskUserQuestion]── │
Claude Code session ─[Stop hook]────────────────────────── │
                                                           ▼
                                        http://localhost:3333  (Express)
                                             │
                                             │ SSE push
                                             ▼
                                  Browser dashboard
```

- `server.js` — Express server on `127.0.0.1:3333`. Four POST endpoints
  (`/events/start`, `/events/stop`, `/events/notify`, `/events/answered`),
  one DELETE endpoint, one SSE endpoint (`/events`). State is an in-memory
  `Map<session_id, agent>`. The `awaiting` field on each agent is set by
  `/events/notify` and cleared by `/events/answered`, `/events/start`, or
  `/events/stop` for that session.
- `public/index.html` — single-page dashboard. Connects via `EventSource`,
  renders cards, ticks duration every second for live "Working · 12s".
- `hooks/on-prompt-submit.mjs` — reads hook JSON from stdin
  (`session_id`, `cwd`, `prompt`), POSTs `/events/start` with a 1-second
  timeout.
- `hooks/on-stop.mjs` — reads hook JSON from stdin, POSTs `/events/stop`.
- `hooks/on-notification.mjs` — reads hook JSON from stdin
  (`session_id`, `message`), POSTs `/events/notify`. Claude Code fires the
  `Notification` hook when waiting for permission or after ~60s of idle
  input, so an agent can briefly appear "Awaiting input" even when no
  question is on screen.
- `hooks/on-ask-user-question.mjs` — `PreToolUse` hook with matcher
  `AskUserQuestion`. Reads hook JSON from stdin
  (`session_id`, `tool_input.questions`), extracts the first question
  text (with `(+N more)` suffix when there are multiple), POSTs
  `/events/notify`. Needed because Claude Code does not emit a
  `Notification` event for `AskUserQuestion` prompts.
- `hooks/on-ask-user-question-answered.mjs` — `PostToolUse` hook with
  matcher `AskUserQuestion`. POSTs `/events/answered` to clear the
  `awaiting` state mid-turn, so the card returns to **Working** as soon
  as you submit your answer (rather than waiting for the next `Stop`).

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

**Test the Awaiting input state by hand.** Start a session (so the agent
exists in the dashboard), then:

```bash
echo '{"session_id":"<your-session-id>","message":"Allow Bash command?"}' | \
  /Users/pawelmaj/Documents/Projects/My/AgentDashboard/hooks/on-notification.mjs
```

The card should turn orange with the message shown. Send a new prompt or
let the turn finish to clear it.

You can test the `AskUserQuestion` path the same way:

```bash
echo '{"session_id":"<your-session-id>","tool_input":{"questions":[{"question":"Pick a color"},{"question":"Pick a size"}]}}' | \
  /Users/pawelmaj/Documents/Projects/My/AgentDashboard/hooks/on-ask-user-question.mjs
```

And clear it as if you'd answered:

```bash
echo '{"session_id":"<your-session-id>"}' | \
  /Users/pawelmaj/Documents/Projects/My/AgentDashboard/hooks/on-ask-user-question-answered.mjs
```

**Port 3333 already in use.** Start the server on a different port:
`PORT=4444 npm start`. The hooks are hardcoded to 3333 — edit
`hooks/*.mjs` if you change it.
