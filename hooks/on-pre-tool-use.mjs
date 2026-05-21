#!/usr/bin/env node
import { readFileSync } from 'node:fs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));

  // AskUserQuestion has its own PreToolUse hook that SETS awaiting.
  // Every other tool means the agent is no longer blocked on the user
  // (e.g. a permission prompt was just granted), so we clear awaiting.
  if (input.tool_name === 'AskUserQuestion') process.exit(0);

  await fetch('http://localhost:3333/events/answered', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: input.session_id }),
    signal: AbortSignal.timeout(1000),
  });
} catch {
  // Dashboard server not running, or any other failure — never block the agent.
}

process.exit(0);
