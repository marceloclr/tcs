// Busca automática dos dados da NFC-e para as capturas da obra (job buscar-nfce do GitLab CI).
// O navegador não consegue: a API da SEFAZ-CE só responde por http (no https ela exige certificado de cliente),
// e uma página https não pode chamar http (conteúdo misto). O runner do GitLab chama, sem essa limitação.
//
// Para cada captura pendente ou em conferência, ainda sem busca (ou com erro, até 3 tentativas), grava em capturas/{id}:
//   busca: {status:'ok', em, fonte, url, html}            página da nota (o navegador extrai o texto e passa pelos leitores de consulta.js)
//   busca: {status:'erro', em, fonte, motivo, tentativas} a SEFAZ recusou ou não respondeu
//   busca: {status:'sem_fonte', em, motivo}                 NF-e, ou NFC-e de outro estado sem link: segue pela foto
//
// Uso:
//   node buscar-nfce.mjs                      processa a fila (credencial em FIREBASE_SA ou GOOGLE_APPLICATION_CREDENTIALS, ou FIRESTORE_EMULATOR_HOST)
//   node buscar-nfce.mjs --url "<link do QR>"  só consulta e imprime o texto da nota (teste, sem Firestore)
//   node buscar-nfce.mjs --chave <44 dígitos>  idem, pela chave
import { parseArgs } from 'node:util';

const TENTATIVAS = 3, PRAZO_MS = 20000, LIMITE_HTML = 400000;
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const soDigitos = s => String(s || '').replace(/\D/g, '');

function chaveDV(c43) { let s = 0, p = 2; for (let i = c43.length - 1; i >= 0; i--) { s += Number(c43[i]) * p; p = p === 9 ? 2 : p + 1 } const r = s % 11; return r < 2 ? 0 : 11 - r }
function chaveDe(ch) { ch = soDigitos(ch); if (ch.length !== 44 || chaveDV(ch.slice(0, 43)) !== +ch[43]) return null; return { chave: ch, uf: +ch.slice(0, 2), modelo: +ch.slice(20, 22), tpEmis: ch[34] } }

// ---------- De onde buscar ----------
// SEFAZ-CE: a página ShowNFCe.html é um app Angular que faz POST na API abaixo (js/app.js do próprio portal, lido em 22/10/2026).
// QR versão 2: p=chave|2|ambiente|csc|hash (emissão normal) ou p=chave|2|ambiente|dia|valor|digVal|csc|hash (contingência, tpEmis 9).
// QR versão 3: p=chave|3|ambiente. Versão 100 (antiga): parâmetros nomeados (chNFe, nVersao=100, tpAmb, ...).
function fonteCe(url, chave) {
  if (url) {
    let u; try { u = new URL(url) } catch (e) { return null }
    if (!/^nfceh?\.sefaz\.ce\.gov\.br$/i.test(u.hostname)) return null;
    const q = u.searchParams;
    if (q.get('nVersao') === '100') {
      const corpo = Object.fromEntries(['chNFe', 'nVersao', 'tpAmb', 'cDest', 'dhEmi', 'vNF', 'vICMS', 'digVal', 'cIdToken', 'cHashQRCode'].map(k => [k, q.get(k) || undefined]));
      return { api: 'qrcode', amb: corpo.tpAmb, corpo, rotulo: 'SEFAZ-CE (QR versão 100)' };
    }
    const p = decodeURIComponent(q.get('p') || u.search.slice(u.search.indexOf('=') + 1)).split('|');
    if (p[1] === '2') {
      const corpo = p[0].charAt(34) === '9'
        ? { chave_acesso: p[0], versao_qrcode: p[1], tipo_ambiente: p[2], dia_data_emissao: p[3], valor_total_nfce: p[4], digVal: p[5], identificador_csc: p[6], codigo_hash: p[7] }
        : { chave_acesso: p[0], versao_qrcode: p[1], tipo_ambiente: p[2], identificador_csc: p[3], codigo_hash: p[4] };
      return { api: 'qrcodev2', amb: p[2], corpo, rotulo: 'SEFAZ-CE (QR versão 2)' };
    }
    if (p[1] === '3') return { api: 'qrcodev3', amb: p[2], corpo: { chave_acesso: p[0], versao_qrcode: '3', tipo_ambiente: p[2] }, rotulo: 'SEFAZ-CE (QR versão 3)' };
    return null;
  }
  // só a chave (digitada ou lida do código de barras): NFC-e (modelo 65) emitida no Ceará (UF 23) vai pela versão 3, que pede só a chave
  const d = chaveDe(chave);
  if (d && d.uf === 23 && d.modelo === 65) return { api: 'qrcodev3', amb: '1', corpo: { chave_acesso: d.chave, versao_qrcode: '3', tipo_ambiente: '1' }, rotulo: 'SEFAZ-CE (pela chave)' };
  return null;
}
async function comPrazo(url, opcoes = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), PRAZO_MS);
  try { return await fetch(url, { ...opcoes, signal: ctl.signal, headers: { 'User-Agent': UA, ...(opcoes.headers || {}) } }) }
  catch (e) { throw new Error(e.name === 'AbortError' ? `a SEFAZ não respondeu em ${PRAZO_MS / 1000} s` : 'sem conexão com a SEFAZ (' + (e.cause?.code || e.message) + ')') }
  finally { clearTimeout(t) }
}
const entidades = s => String(s || '').replace(/&([a-z]+);/gi, (m, n) => ({ aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', atilde: 'ã', otilde: 'õ', ccedil: 'ç', ecirc: 'ê', ocirc: 'ô', acirc: 'â', amp: '&', nbsp: ' ' }[n.toLowerCase()] ?? m)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const limpar = html => String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').slice(0, LIMITE_HTML);

async function buscar({ url, chave }) {
  const ce = fonteCe(url, chave);
  if (ce) {
    if (ce.amb !== '1') throw new Error('nota de homologação (teste), sem validade fiscal');
    // http de propósito: no https a SEFAZ-CE pede certificado de cliente
    const r = await comPrazo(`http://nfce.sefaz.ce.gov.br/nfce/api/notasFiscal/${ce.api}/`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(ce.corpo) });
    const txt = await r.text(); let j; try { j = JSON.parse(txt) } catch (e) { throw new Error(`resposta inesperada da SEFAZ-CE (HTTP ${r.status})`) }
    if (j.xml) return { fonte: ce.rotulo, html: limpar(j.xml) };
    throw new Error(entidades(j.erro || j.descricaoStatus) || `a SEFAZ-CE não devolveu a nota (HTTP ${r.status})`);
  }
  // outros estados: a página do QR, quando o portal já entrega a nota pronta no HTML (padrão SVRS e semelhantes)
  if (url && /^https?:\/\/[^/]+\.gov\.br\//i.test(url) && /nfc-?e|qrcode/i.test(url)) {
    const r = await comPrazo(url); const html = await r.text();
    if (!r.ok) throw new Error(`a página da consulta respondeu HTTP ${r.status}`);
    if (!/Qtde|Vl\.?\s*Unit|Valor\s+a\s+pagar/i.test(html)) throw new Error('a página da consulta não trouxe os itens (pode montar os dados por script ou pedir captcha)');
    return { fonte: 'Página da consulta (' + new URL(url).hostname + ')', html: limpar(html) };
  }
  return null;
}

// ---------- Modo de teste: só consulta e imprime ----------
const { values: arg } = parseArgs({ options: { url: { type: 'string' }, chave: { type: 'string' } } });
if (arg.url || arg.chave) {
  try {
    const r = await buscar({ url: arg.url, chave: arg.chave });
    if (!r) { console.log('Sem fonte de busca para esta nota (NF-e, ou NFC-e de outro estado sem link do QR).'); process.exit(2) }
    console.log(`Fonte: ${r.fonte}\n` + r.html.replace(/<(?:br|\/p|\/div|\/tr|\/li|\/h\d|\/td|\/table)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n'));
  } catch (e) { console.error('Erro: ' + e.message); process.exit(1) }
  process.exit(0);
}

// ---------- Fila ----------
const { initializeApp, applicationDefault, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const emulador = !!process.env.FIRESTORE_EMULATOR_HOST;
// FIREBASE_SA: caminho do arquivo (variável de CI do tipo File) ou o próprio JSON (tipo Variable). Nunca é impressa.
function credencial() {
  const v = (process.env.FIREBASE_SA || '').trim();
  if (!v) return applicationDefault(); // GOOGLE_APPLICATION_CREDENTIALS, no teste local
  try { return cert(v.startsWith('{') ? JSON.parse(v) : v) }
  catch (e) { console.error('FIREBASE_SA inválida: não é o JSON da conta de serviço nem o caminho de um arquivo com ele.'); process.exit(1) }
}
initializeApp(emulador ? { projectId: process.env.GCLOUD_PROJECT || 'demo-tcs' } : { credential: credencial(), projectId: process.env.FIREBASE_PROJETO || 'thiago-17d18' });
const db = getFirestore();
const snap = await db.collection('capturas').where('status', 'in', ['pendente', 'em_conferencia']).get();
const fila = snap.docs.filter(d => { const b = d.data().busca; return !b || (b.status === 'erro' && (b.tentativas || 0) < TENTATIVAS) });
console.log(`${snap.size} captura(s) em aberto; ${fila.length} para buscar.`);
let ok = 0, erros = 0, semFonte = 0;
for (const d of fila) {
  const c = d.data(), em = new Date().toISOString(), id = d.id.slice(0, 8);
  try {
    const r = await buscar({ url: c.consultaUrl, chave: c.chave });
    if (!r) { semFonte++; await d.ref.update({ busca: { status: 'sem_fonte', em, motivo: 'Busca automática só para NFC-e do Ceará ou com link do QR; confira pela foto.' } }); console.log(`${id}: sem fonte`); continue }
    ok++; await d.ref.update({ busca: { status: 'ok', em, fonte: r.fonte, url: c.consultaUrl || '', html: r.html } }); console.log(`${id}: ok (${r.fonte}, ${r.html.length} caracteres)`);
  } catch (e) {
    erros++; const tentativas = (c.busca?.tentativas || 0) + 1;
    await d.ref.update({ busca: { status: 'erro', em, motivo: e.message, tentativas } }); console.log(`${id}: erro (${tentativas}/${TENTATIVAS}): ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 800)); // sem pressa com a SEFAZ
}
console.log(`Fim: ${ok} encontrada(s), ${erros} com erro, ${semFonte} sem fonte.`);
process.exit(0);
