// Uso: node cdp.mjs <url> <arquivo-js-a-avaliar> [png] [largura] [altura]
// Variáveis: CDP_PORTA (9446), INIT (arquivo JS injetado antes da página), ESPERA (ms, 2500), FIM (ms antes de fechar), TEMA (claro|escuro)
import fs from 'node:fs';
const [url, jsFile, png, w = '1366', h = '900'] = process.argv.slice(2);
const porta = process.env.CDP_PORTA || 9446;
const alvo = await (await fetch(`http://127.0.0.1:${porta}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let n = 0; const pend = new Map(); const logs = [];
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  if (m.method === 'Runtime.consoleAPICalled' && /^__cdp_(offline|online)__$/.test(m.params.args[0]?.value || '')) { const off = m.params.args[0].value === '__cdp_offline__'; ws.send(JSON.stringify({ id: ++n, method: 'Network.emulateNetworkConditions', params: { offline: off, latency: 0, downloadThroughput: -1, uploadThroughput: -1 } })); }
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEÇÃO: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); };
const cmd = (method, params = {}) => new Promise(r => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })) });
await cmd('Runtime.enable'); await cmd('Page.enable'); await cmd('Network.enable'); await cmd('Network.setCacheDisabled', { cacheDisabled: true });
await cmd('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 600 });
if (process.env.TEMA) await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: process.env.TEMA === 'escuro' ? 'dark' : 'light' }] });
if (process.env.INIT) await cmd('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(process.env.INIT, 'utf8') });
await cmd('Page.navigate', { url });
await cmd('Page.bringToFront'); // aba em segundo plano não toca vídeo (câmera do 15-codigo.js)
await new Promise(r => setTimeout(r, +(process.env.ESPERA || 2500)));
if (jsFile && jsFile !== '-') { const r = await cmd('Runtime.evaluate', { expression: fs.readFileSync(jsFile, 'utf8'), awaitPromise: true, returnByValue: true });
  console.log('RESULTADO:', JSON.stringify(r.result.result?.value ?? r.result.exceptionDetails?.exception?.description ?? r.result, null, 1)); }
if (process.env.FIM) await new Promise(r => setTimeout(r, +process.env.FIM));
if (png) { const s = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(png, Buffer.from(s.result.data, 'base64')); }
console.log(logs.join('\n'));
await cmd('Page.close').catch(() => {}); ws.close(); process.exit(0);
