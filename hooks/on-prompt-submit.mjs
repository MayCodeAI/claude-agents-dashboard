#!/usr/bin/env node
import { readFileSync } from 'node:fs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const prompt_preview = String(input.prompt ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  const body = JSON.stringify({
    session_id: input.session_id,
    cwd: input.cwd,
    prompt_preview,
    start_time: new Date().toISOString(),
  });

  await fetch('http://localhost:3333/events/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(1000),
  });
} catch {
  // Dashboard server not running, or any other failure — never block the agent.
}

process.exit(0);
