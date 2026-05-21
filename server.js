import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(express.static(join(__dirname, 'public')));

const agents = new Map();
const clients = new Set();

function snapshot() {
  return [...agents.values()].sort((a, b) => {
    const aTime = a.end_time ?? a.start_time;
    const bTime = b.end_time ?? b.start_time;
    return bTime.localeCompare(aTime);
  });
}

function broadcast() {
  const payload = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const res of clients) res.write(payload);
}

app.post('/events/start', (req, res) => {
  const { session_id, cwd, prompt_preview, start_time } = req.body ?? {};
  if (!session_id) return res.sendStatus(400);
  agents.set(session_id, {
    session_id,
    cwd: cwd ?? '',
    prompt_preview: prompt_preview ?? '',
    start_time: start_time ?? new Date().toISOString(),
    end_time: null,
  });
  broadcast();
  res.sendStatus(204);
});

app.post('/events/stop', (req, res) => {
  const { session_id, end_time } = req.body ?? {};
  if (!session_id) return res.sendStatus(400);
  const agent = agents.get(session_id);
  if (agent) {
    agent.end_time = end_time ?? new Date().toISOString();
    broadcast();
  }
  res.sendStatus(204);
});

app.delete('/agents/:session_id', (req, res) => {
  agents.delete(req.params.session_id);
  broadcast();
  res.sendStatus(204);
});

app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
  clients.add(res);
  const keepalive = setInterval(() => res.write(': ping\n\n'), 30000);
  req.on('close', () => {
    clearInterval(keepalive);
    clients.delete(res);
  });
});

const PORT = Number(process.env.PORT ?? 3333);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Agent dashboard listening on http://localhost:${PORT}`);
});
