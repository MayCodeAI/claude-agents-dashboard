#!/usr/bin/env node
import { readFileSync } from 'node:fs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const questions = input?.tool_input?.questions;
  const first = Array.isArray(questions) ? questions[0]?.question : '';
  const extra = Array.isArray(questions) && questions.length > 1
    ? ` (+${questions.length - 1} more)`
    : '';
  const message = (String(first ?? '') + extra)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  const body = JSON.stringify({
    session_id: input.session_id,
    message,
    notified_at: new Date().toISOString(),
  });

  await fetch('http://localhost:3333/events/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(1000),
  });
} catch {
  // Dashboard server not running, or any other failure — never block the agent.
}

process.exit(0);
