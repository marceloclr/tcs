// Verificação estática: sintaxe de todo o JavaScript (node --check, inclusive scripts embutidos) e balanceamento das tags nos HTML.
// Uso (na raiz do repositório): node testes/verificar.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

let falhas = 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tcs-verif-'));
const checar = (arquivo, rotulo) => {
  try { execFileSync(process.execPath, ['--check', arquivo], { stdio: 'pipe' }); }
  catch (e) { falhas++; console.log('ERRO de sintaxe em ' + rotulo + ':\n' + String(e.stderr)); }
};
// Arquivo essencial vazio (por exemplo, truncado por um script) é falha, antes de qualquer outra conferência.
for (const f of ['index.html', 'captura.html', 'sw.js', 'manifest.webmanifest', 'firestore.rules', ...fs.readdirSync('js').map(x => 'js/' + x), ...fs.readdirSync('css').map(x => 'css/' + x)]) {
  if (fs.existsSync(f) && fs.statSync(f).size === 0) { falhas++; console.log('ARQUIVO VAZIO: ' + f); }
}
const js = fs.readdirSync('js').filter(f => f.endsWith('.js')).map(f => 'js/' + f).concat(fs.existsSync('sw.js') ? ['sw.js'] : []);
for (const f of js) {
  const modulo = /^\s*(import|export)\s|await import\(|^const cfg=window/m.test(fs.readFileSync(f, 'utf8'));
  if (modulo) { const t = path.join(tmp, path.basename(f) + '.mjs'); fs.copyFileSync(f, t); checar(t, f); } else checar(f, f);
}
const VAZIAS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'path', 'circle', 'rect', 'line', 'stop', 'polyline', 'use']);
for (const h of fs.readdirSync('.').filter(f => f.endsWith('.html'))) {
  const s = fs.readFileSync(h, 'utf8');
  let n = 0;
  for (const m of s.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (/\ssrc=/.test(m[1] || '') || !m[2].trim()) continue;
    const t = path.join(tmp, h + '.' + (n++) + (/type="module"/.test(m[1] || '') ? '.mjs' : '.js'));
    fs.writeFileSync(t, m[2]); checar(t, h + ' (script ' + n + ')');
  }
  // tags HTML fora de <script>/<style>/comentários; SVG com autofechamento é ignorado
  const corpo = s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const pilha = [];
  for (const m of corpo.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
    const [, fecha, nome0, auto] = m; const nome = nome0.toLowerCase();
    if (VAZIAS.has(nome) || auto) continue;
    if (!fecha) { pilha.push(nome); continue; }
    const i = pilha.lastIndexOf(nome);
    if (i < 0) { falhas++; console.log(`${h}: </${nome}> sem abertura`); continue; }
    if (i !== pilha.length - 1) { falhas++; console.log(`${h}: <${pilha.slice(i + 1).join('>, <')}> não fechada(s) antes de </${nome}>`); }
    pilha.length = i;
  }
  if (pilha.length) { falhas++; console.log(`${h}: não fechadas: <${pilha.join('>, <')}>`); }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(falhas ? `${falhas} problema(s) encontrado(s).` : `OK: ${js.length} arquivo(s) JS e os HTML conferidos.`);
process.exit(falhas ? 1 : 0);
