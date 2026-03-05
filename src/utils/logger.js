export function log(source, message) {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] [${source}] ${message}`);
}

export function logProgress(source, current, total, label = '') {
  const pct = ((current / total) * 100).toFixed(1);
  log(source, `${pct}% (${current}/${total}) ${label}`);
}
