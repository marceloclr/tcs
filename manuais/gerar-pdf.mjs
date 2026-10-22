// Gera os PDFs dos manuais a partir das páginas de impressão (A4, tema claro), pelo Chromium sem janela (DevTools Protocol).
// Uso, na raiz do repositório:
//   python3 -m http.server 8767 --bind 127.0.0.1        (em outro terminal)
//   flatpak run org.chromium.Chromium --headless=new --remote-debugging-port=9446 --user-data-dir=$HOME/Downloads/tcs-pdf
//   node manuais/gerar-pdf.mjs                          (CDP_PORTA=9446, BASE=http://localhost:8767)
// Saída: manuais/manual-mestre.pdf (cartaz de uma folha) e manuais/manual-escritorio.pdf (guia rápido).
import fs from 'node:fs';
const porta = process.env.CDP_PORTA || 9446, base = process.env.BASE || 'http://localhost:8767';
const PDFS = [['manuais/cartaz-mestre.html', 'manuais/manual-mestre.pdf'], ['manuais/guia-escritorio.html', 'manuais/manual-escritorio.pdf']];
for (const [pagina, saida] of PDFS) {
  const alvo = await (await fetch(`http://127.0.0.1:${porta}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(alvo.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let n = 0; const pend = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } };
  const cmd = (method, params = {}) => new Promise(r => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })) });
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront');
  await cmd('Page.navigate', { url: `${base}/${pagina}` });
  // espera as fontes e o QR Code (data-pronto no body)
  for (let i = 0; i < 60; i++) { const r = await cmd('Runtime.evaluate', { expression: "document.readyState==='complete'&&document.body?.dataset.pronto==='1'&&document.fonts.status==='loaded'", returnByValue: true }); if (r.result.result.value) break; await new Promise(r => setTimeout(r, 250)) }
  const r = await cmd('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
  if (!r.result?.data) { console.error('Falhou:', pagina, JSON.stringify(r.error || r)); process.exit(1) }
  fs.writeFileSync(saida, Buffer.from(r.result.data, 'base64')); console.log('Gerado:', saida);
  await cmd('Page.close').catch(() => {}); ws.close();
}
process.exit(0);
