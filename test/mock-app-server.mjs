import { createInterface } from 'node:readline';
let initialized = false;
const lines = createInterface({ input: process.stdin });
lines.on('line', line => {
  const m = JSON.parse(line);
  if (m.method === 'initialize') process.stdout.write(JSON.stringify({ id: m.id, result: {} }) + '\n');
  else if (m.method === 'initialized') initialized = true;
  else if (m.method === 'account/rateLimits/read' && initialized) process.stdout.write(JSON.stringify({ id: m.id, result: {
    rateLimitsByLimitId: { codex: { limitId: 'codex', primary: { usedPercent: 11, windowDurationMins: 10080 } } }
  } }) + '\n');
  else process.stdout.write(JSON.stringify({ id: m.id, error: { message: 'Unexpected protocol operation' } }) + '\n');
});
