// Teste do buscar-nfce.mjs no emulador: semeia capturas de cada tipo, roda a busca e confere o campo 'busca'.
// Rodar dentro de testes/: npx firebase emulators:exec --config ../firebase.json --only firestore --project demo-tcs "node ../servidor/testar-busca.mjs"
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
initializeApp({ projectId: 'demo-tcs' }); const db = getFirestore();
const CE = '23261007012345000123650010000012341000012346', NFE = '35261007012345000123550010000012341000012345';
const base = { autor: 'mestre@x.com', projectId: 'A1', clientId: 'A', fotos: [], consultaUrl: '' };
const caps = {
  ce_chave: { ...base, status: 'pendente', chave: CE },
  ce_url: { ...base, status: 'pendente', chave: CE, consultaUrl: `http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p=${CE}|2|1|1|ABCDEF` },
  nfe: { ...base, status: 'pendente', chave: NFE },
  feita: { ...base, status: 'pendente', chave: CE, busca: { status: 'ok', html: '<p>já buscada</p>' } },
  esgotada: { ...base, status: 'pendente', chave: CE, busca: { status: 'erro', tentativas: 3 } },
  lancada: { ...base, status: 'lancada', chave: CE },
};
for (const [id, d] of Object.entries(caps)) await db.doc('capturas/' + id).set({ id, ...d });
console.log(execFileSync('node', [new URL('./buscar-nfce.mjs', import.meta.url).pathname], { encoding: 'utf8', env: process.env }));
const b = async id => (await db.doc('capturas/' + id).get()).data().busca;
assert.equal((await b('ce_chave')).status, 'erro'); assert.equal((await b('ce_chave')).tentativas, 1);
assert.match((await b('ce_url')).motivo, /^\d{3} - /);
assert.equal((await b('nfe')).status, 'sem_fonte');
assert.equal((await b('feita')).html, '<p>já buscada</p>');
assert.equal((await b('esgotada')).tentativas, 3);
assert.equal(await b('lancada'), undefined);
console.log('Conferência do buscar-nfce: ok');
process.exit(0);
