// In-memory ring buffer of recent log entries, exposed via /api/admin/logs
const MAX_ENTRIES = 500;
const entries = [];

export function log(level, msg) {
  const entry = { ts: Date.now(), level, msg: String(msg) };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  const line = `[${new Date(entry.ts).toISOString()}] ${level.toUpperCase().padEnd(5)} ${entry.msg}`;
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logInfo  = msg => log('info', msg);
export const logWarn  = msg => log('warn', msg);
export const logError = msg => log('error', msg);

export function getLogs(limit = 200) {
  return entries.slice(-limit).reverse();
}
