// Testes das regras do Firestore (firestore.rules) no emulador. Rodar com: npm test (dentro de testes/).
import { test, before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, writeBatch, documentId, serverTimestamp } from 'firebase/firestore';

let env;
const ADM = 'marceloclr@gmail.com', ESC = 'esc@x.com', LEI = 'leitor@x.com', OBRA = 'mestre@x.com', CLI = 'cliente@x.com', NOVO = 'novo@x.com';
const ctx = email => env.authenticatedContext(email.split('@')[0], { email, email_verified: true }).firestore();
// Cliente A tem os projetos A1 e A2; o cliente B tem o B1.
const usuarios = {
  [ADM]: { papel: 'admin', ativo: true, acessos: {} },
  [ESC]: { papel: 'escritorio', ativo: true, acessos: { 'p:A1': { n: 'E', ate: null } }, clv: ['A'], pl: ['A1'], cl: [], esc: true, escAte: null },
  [LEI]: { papel: 'escritorio', ativo: true, acessos: { 'p:A1': { n: 'L', ate: null } }, clv: ['A'], pl: ['A1'], cl: [], esc: false },
  [CLI]: { papel: 'escritorio', ativo: true, acessos: { 'c:A': { n: 'E', ate: null } }, clv: ['A'], pl: [], cl: ['A'], esc: true },
  [OBRA]: { papel: 'obra', ativo: true, acessos: { 'p:A1': { n: 'L', ate: null } }, clv: ['A'], pl: ['A1'], cl: [] },
};
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-tcs', firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8089 } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore(); const s = (p, d) => setDoc(doc(db, p), d);
    for (const [e, u] of Object.entries(usuarios)) await s('usuarios/' + e, { email: e, nome: e, ...u });
    await s('config/admins', { lista: [ADM] });
    await s('clients/A', { id: 'A', name: 'Cliente A' }); await s('clients/B', { id: 'B', name: 'Cliente B' });
    await s('projects/A1', { id: 'A1', clientId: 'A', name: 'A1' }); await s('projects/A2', { id: 'A2', clientId: 'A', name: 'A2' }); await s('projects/B1', { id: 'B1', clientId: 'B', name: 'B1' });
    for (const [id, p, c] of [['a1', 'A1', 'A'], ['a2', 'A2', 'A'], ['b1', 'B1', 'B']]) {
      await s('allocations/' + id, { id, projectId: p, clientId: c, invoiceId: 'N1', quantity: 1, escopo: 'fechada' });
      await s('movements/s' + id, { id: 's' + id, type: 'SAIDA', projectId: p, clientId: c, quantity: 1 });
      await s('notas_projeto/N1__' + p, { id: 'N1__' + p, invoiceId: 'N1', projectId: p, clientId: c });
    }
    await s('movements/e1', { id: 'e1', type: 'ENTRADA', invoiceId: 'N1', escopo: 'fechada' });
    await s('invoices/N1', { id: 'N1', key: 'N1', escopo: 'fechada', projetos: ['A1', 'A2', 'B1'], clientes: ['A', 'B'] });
    await s('invoices/N2', { id: 'N2', key: 'N2', escopo: 'fechada', projetos: ['A1'], clientes: ['A'] });
    await s('invoices/N3', { id: 'N3', key: 'N3', escopo: 'aberta', projetos: [], clientes: [] });
    await s('chaves/N1', { notaId: 'N1' });
    await s('products/P1', { id: 'P1', name: 'Cimento' });
  });
});

test('consultas por projeto e por cliente passam nas regras', async () => {
  const db = ctx(ESC);
  const r = await assertSucceeds(getDocs(query(collection(db, 'allocations'), where('projectId', 'in', ['A1']))));
  if (r.size !== 1) throw Error('esperava 1 rateio, veio ' + r.size);
  await assertSucceeds(getDocs(query(collection(db, 'movements'), where('type', '==', 'SAIDA'), where('projectId', 'in', ['A1']))));
  await assertSucceeds(getDocs(query(collection(db, 'notas_projeto'), where('projectId', 'in', ['A1']))));
  await assertSucceeds(getDocs(query(collection(db, 'projects'), where(documentId(), 'in', ['A1']))));
  await assertSucceeds(getDocs(query(collection(db, 'clients'), where(documentId(), 'in', ['A']))));
  const dc = ctx(CLI);
  const r2 = await assertSucceeds(getDocs(query(collection(dc, 'allocations'), where('clientId', 'in', ['A']))));
  if (r2.size !== 2) throw Error('esperava 2 rateios do cliente A, veio ' + r2.size);
  await assertSucceeds(getDocs(query(collection(dc, 'projects'), where('clientId', 'in', ['A']))));
});
test('sem acesso: leitura direta e consulta ampla são negadas', async () => {
  const db = ctx(ESC);
  await assertFails(getDocs(collection(db, 'allocations')));
  await assertFails(getDocs(query(collection(db, 'allocations'), where('projectId', 'in', ['B1']))));
  await assertFails(getDoc(doc(db, 'allocations/b1')));
  await assertFails(getDoc(doc(db, 'clients/B')));
  await assertFails(getDoc(doc(db, 'projects/B1')));
  await assertFails(getDoc(doc(db, 'notas_projeto/N1__B1')));
  await assertFails(getDocs(collection(db, 'usuarios')));
  await assertFails(getDoc(doc(db, 'usuarios/' + LEI)));
});
test('nota coletiva: inteira só para quem tem todos os projetos', async () => {
  await assertFails(getDoc(doc(ctx(ESC), 'invoices/N1')));
  await assertSucceeds(getDoc(doc(ctx(ESC), 'invoices/N2')));
  await assertFails(getDoc(doc(ctx(CLI), 'invoices/N1')));
  await assertSucceeds(getDoc(doc(ctx(ADM), 'invoices/N1')));
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'config/geral'), { notaColetiva: 'inteira' }));
  await assertSucceeds(getDoc(doc(ctx(ESC), 'invoices/N1')));
});
test('notas abertas: escritor lê pela consulta; leitor não', async () => {
  await assertSucceeds(getDocs(query(collection(ctx(ESC), 'invoices'), where('escopo', '==', 'aberta'))));
  await assertFails(getDocs(query(collection(ctx(LEI), 'invoices'), where('escopo', '==', 'aberta'))));
  await assertFails(getDocs(collection(ctx(ESC), 'invoices')));
  await assertSucceeds(getDocs(collection(ctx(ADM), 'invoices')));
});
test('leitura sem escrita: não grava', async () => {
  const db = ctx(LEI);
  await assertFails(setDoc(doc(db, 'allocations/n'), { projectId: 'A1', clientId: 'A', quantity: 1 }));
  await assertFails(setDoc(doc(db, 'movements/n'), { type: 'SAIDA', projectId: 'A1', clientId: 'A', quantity: 1 }));
  await assertFails(updateDoc(doc(db, 'projects/A1'), { name: 'x' }));
  await assertFails(setDoc(doc(db, 'products/P2'), { name: 'x' }));
  await assertSucceeds(getDoc(doc(db, 'allocations/a1')));
});
test('escrita no projeto: grava no projeto, não em outro, nem com cliente trocado', async () => {
  const db = ctx(ESC);
  await assertSucceeds(setDoc(doc(db, 'allocations/n1'), { projectId: 'A1', clientId: 'A', quantity: 1 }));
  await assertFails(setDoc(doc(db, 'allocations/n2'), { projectId: 'A2', clientId: 'A', quantity: 1 }));
  await assertFails(setDoc(doc(db, 'allocations/n3'), { projectId: 'A1', clientId: 'B', quantity: 1 }));
  await assertSucceeds(updateDoc(doc(db, 'allocations/a2'), { escopo: 'aberta' }));
  await assertFails(updateDoc(doc(db, 'allocations/a2'), { quantity: 9 }));
  await assertFails(setDoc(doc(db, 'projects/A9'), { clientId: 'A', name: 'novo' }));
  await assertSucceeds(setDoc(doc(ctx(CLI), 'projects/A9'), { clientId: 'A', name: 'novo' }));
  await assertFails(setDoc(doc(ctx(CLI), 'clients/C'), { name: 'novo' }));
});
test('duplicidade: a chave só é criada uma vez e não pode ser listada', async () => {
  const db = ctx(ESC);
  await assertSucceeds(getDoc(doc(db, 'chaves/N1')));
  await assertFails(getDocs(collection(db, 'chaves')));
  const b = writeBatch(db);
  b.set(doc(db, 'invoices/N1x'), { key: 'N1', escopo: 'aberta' }); b.set(doc(db, 'chaves/N1'), { notaId: 'N1x', criadoEm: 'x' });
  await assertFails(b.commit());
  const b2 = writeBatch(db);
  b2.set(doc(db, 'invoices/N9'), { key: 'N9', escopo: 'aberta' }); b2.set(doc(db, 'chaves/N9'), { notaId: 'N9', criadoEm: 'x' });
  await assertSucceeds(b2.commit());
  await assertFails(setDoc(doc(db, 'invoices/N8'), { key: 'N8', escopo: 'aberta' }));
});
test('obra: só nomes dos projetos concedidos e criação de capturas', async () => {
  const db = ctx(OBRA);
  await assertSucceeds(getDocs(query(collection(db, 'projects'), where(documentId(), 'in', ['A1']))));
  await assertFails(getDoc(doc(db, 'projects/A2')));
  for (const p of ['allocations/a1', 'movements/sa1', 'notas_projeto/N1__A1', 'invoices/N2', 'products/P1', 'clients/A', 'chaves/N1']) await assertFails(getDoc(doc(db, p)));
  const foto = [{ ordem: 0, largura: 10, altura: 10, bytes: 3, partes: 1 }];
  await assertSucceeds(setDoc(doc(db, 'capturas/c1'), { autor: OBRA, projectId: 'A1', clientId: 'A', status: 'pendente', fotos: foto }));
  await assertFails(setDoc(doc(db, 'capturas/c2'), { autor: OBRA, projectId: 'A2', clientId: 'A', status: 'pendente', fotos: foto }));
  // só o código da nota (chave ou link do QR), sem foto; vazia ou com 'busca' preenchida pela obra, não
  const CH = '23261007012345000123650010000012341000012340';
  await assertSucceeds(setDoc(doc(db, 'capturas/c3'), { autor: OBRA, projectId: 'A1', clientId: 'A', status: 'pendente', fotos: [], chave: CH, consultaUrl: '' }));
  await assertSucceeds(setDoc(doc(db, 'capturas/c4'), { autor: OBRA, projectId: 'A1', clientId: 'A', status: 'pendente', fotos: [], chave: '', consultaUrl: 'http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p=' + CH + '|2|1|1|ABC' }));
  await assertFails(setDoc(doc(db, 'capturas/c5'), { autor: OBRA, projectId: 'A1', clientId: 'A', status: 'pendente', fotos: [], chave: '123', consultaUrl: '' }));
  await assertFails(setDoc(doc(db, 'capturas/c6'), { autor: OBRA, projectId: 'A1', clientId: 'A', status: 'pendente', fotos: [], chave: CH, busca: { status: 'ok', html: '<p>falsa</p>' } }));
  // várias obras para a mesma nota: todas concedidas a quem envia, a primeira é a principal, no máximo 5
  const ob = (p, c) => ({ projectId: p, clientId: c, nome: p });
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'usuarios/' + OBRA), { email: OBRA, nome: OBRA, ...usuarios[OBRA], acessos: { 'p:A1': { n: 'L', ate: null }, 'p:B1': { n: 'L', ate: null } } }));
  const multi = (id, obras, p = 'A1', c = 'A') => setDoc(doc(db, 'capturas/' + id), { autor: OBRA, projectId: p, clientId: c, status: 'pendente', fotos: [], chave: CH, obras });
  await assertSucceeds(multi('m1', [ob('A1', 'A'), ob('B1', 'B')]));
  await assertFails(multi('m2', [ob('A1', 'A'), ob('A2', 'A')]));        // A2 não concedida
  await assertFails(multi('m3', [ob('A1', 'A'), ob('B1', 'A')]));        // cliente trocado
  await assertFails(multi('m4', [ob('B1', 'B'), ob('A1', 'A')]));        // a primeira tem de ser a principal
  await assertFails(multi('m5', [1, 2, 3, 4, 5, 6].map(() => ob('A1', 'A'))));
  // gatilho do "Buscar agora": quem confere e a obra leem; quem só lê, não; só o administrador grava
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'config/busca'), { gatilhoToken: 'x', projeto: '1' }));
  await assertSucceeds(getDoc(doc(db, 'config/busca')));               // a obra dispara a busca ao enviar
  await assertFails(getDoc(doc(ctx(LEI), 'config/busca')));
  await assertSucceeds(getDoc(doc(ctx(ESC), 'config/busca')));
  await assertFails(setDoc(doc(ctx(ESC), 'config/busca'), { gatilhoToken: 'y' }));
  await assertSucceeds(setDoc(doc(ctx(ADM), 'config/busca'), { gatilhoToken: 'y', projeto: '1' }));
  await assertFails(updateDoc(doc(db, 'capturas/c1'), { status: 'lancada' }));
  await assertSucceeds(getDocs(query(collection(db, 'capturas'), where('autor', '==', OBRA))));
  await assertSucceeds(setDoc(doc(db, 'capturas_fotos/f1'), { autor: OBRA, capturaId: 'c1', projectId: 'A1', clientId: 'A', parte: 0, tipo: 'image/jpeg', dados: 'abc' }));
  await assertFails(setDoc(doc(db, 'capturas_fotos/f2'), { autor: OBRA, capturaId: 'c1', projectId: 'A1', clientId: 'A', parte: 0, tipo: 'text/html', dados: 'abc' }));
  // reenvio da mesma parte (queda de conexão) é aceito; trocar o projeto, não
  await assertSucceeds(setDoc(doc(db, 'capturas_fotos/f1'), { autor: OBRA, capturaId: 'c1', projectId: 'A1', clientId: 'A', parte: 0, tipo: 'image/jpeg', dados: 'abcd' }));
  await assertFails(setDoc(doc(db, 'capturas_fotos/f1'), { autor: OBRA, capturaId: 'c1', projectId: 'A2', clientId: 'A', parte: 0, tipo: 'image/jpeg', dados: 'abcd' }));
  await assertFails(setDoc(doc(db, 'capturas_fotos/f3'), { autor: OBRA, capturaId: 'c1', projectId: 'A2', clientId: 'A', parte: 0, tipo: 'image/jpeg', dados: 'abc' }));
  // o escritório com escrita no projeto lê a fila e confere
  await assertSucceeds(getDocs(query(collection(ctx(ESC), 'capturas'), where('projectId', 'in', ['A1']))));
  await assertSucceeds(updateDoc(doc(ctx(ESC), 'capturas/c1'), { status: 'em_conferencia' }));
  // quem só lê o projeto vê a captura (comprovante), mas não a altera
  await assertSucceeds(getDoc(doc(ctx(LEI), 'capturas/c1')));
  await assertFails(updateDoc(doc(ctx(LEI), 'capturas/c1'), { status: 'lancada' }));
  await assertSucceeds(getDocs(query(collection(ctx(LEI), 'capturas_fotos'), where('capturaId', '==', 'c1'), where('projectId', '==', 'A1'))));
  await assertFails(getDocs(query(collection(ctx(ESC), 'capturas'), where('projectId', 'in', ['B1']))));
});
test('entradas da nota: quem altera a nota refaz as entradas; baixas nunca se apagam', async () => {
  await env.withSecurityRulesDisabled(async c => { const db = c.firestore();
    await setDoc(doc(db, 'movements/e2'), { id: 'e2', type: 'ENTRADA', invoiceId: 'N2', escopo: 'fechada', quantity: 1 });
    await setDoc(doc(db, 'movements/e3'), { id: 'e3', type: 'ENTRADA', invoiceId: 'N3', escopo: 'aberta', quantity: 1 }); });
  await assertFails(deleteDoc(doc(ctx(LEI), 'movements/e2')));        // só leitura no projeto
  await assertFails(deleteDoc(doc(ctx(ESC), 'movements/e1')));        // nota N1 tem projeto fora do acesso
  await assertSucceeds(deleteDoc(doc(ctx(ESC), 'movements/e2')));     // nota N2 inteira no projeto com escrita
  await assertSucceeds(deleteDoc(doc(ctx(ESC), 'movements/e3')));     // nota aberta (a vincular)
  await assertFails(deleteDoc(doc(ctx(ESC), 'movements/sa1')));       // baixa: nunca
  await assertFails(deleteDoc(doc(ctx(ADM), 'movements/sa1')));
});
test('cadastro: aguardando autorização, desativado e implantação', async () => {
  const novo = ctx(NOVO);
  await assertSucceeds(getDoc(doc(novo, 'usuarios/' + NOVO)));
  await assertFails(getDocs(query(collection(novo, 'projects'), where(documentId(), 'in', ['A1']))));
  await assertSucceeds(setDoc(doc(novo, 'solicitacoes/' + NOVO), { email: NOVO, nome: 'Novo', pedidoEm: 'x' }));
  // cada pessoa pode gravar o próprio telefone (pedidos de orçamento), mas não o papel
  await assertSucceeds(updateDoc(doc(ctx(ESC), 'usuarios/' + ESC), { telefone: '(85) 98888-7777' }));
  await assertFails(updateDoc(doc(ctx(ESC), 'usuarios/' + ESC), { papel: 'admin' }));
  await assertFails(setDoc(doc(novo, 'solicitacoes/outro@x.com'), { email: 'outro@x.com', nome: 'x', pedidoEm: 'x' }));
  await assertSucceeds(getDocs(collection(ctx(ADM), 'solicitacoes')));
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'usuarios/' + ESC), { ativo: false }));
  await assertFails(getDoc(doc(ctx(ESC), 'allocations/a1')));
  // implantação encerrada (lista vazia nas regras): ninguém se cadastra como administrador sozinho
  const th = ctx('thiagocsampaio@gmail.com'); const b = writeBatch(th);
  b.set(doc(th, 'usuarios/thiagocsampaio@gmail.com'), { email: 'thiagocsampaio@gmail.com', papel: 'admin', ativo: true, acessos: {} });
  b.update(doc(th, 'config/admins'), { lista: [ADM, 'thiagocsampaio@gmail.com'] });
  await assertFails(b.commit());
  await assertFails(setDoc(doc(novo, 'usuarios/' + NOVO), { email: NOVO, papel: 'admin', ativo: true, acessos: {} }));
});
test('administração: auditoria obrigatória e último administrador protegido', async () => {
  const db = ctx(ADM);
  await assertFails(setDoc(doc(db, 'usuarios/' + NOVO), { email: NOVO, papel: 'escritorio', ativo: true, acessos: {} }));
  const b = writeBatch(db);
  b.set(doc(db, 'auditoria/x1'), { por: ADM, alvo: NOVO, em: 'x' });
  b.set(doc(db, 'usuarios/' + NOVO), { email: NOVO, papel: 'escritorio', ativo: true, acessos: {}, _auditoria: 'x1' });
  await assertSucceeds(b.commit());
  // rebaixar o único administrador: a lista ficaria vazia
  const b2 = writeBatch(db);
  b2.set(doc(db, 'auditoria/x2'), { por: ADM, alvo: ADM, em: 'x' });
  b2.update(doc(db, 'usuarios/' + ADM), { papel: 'escritorio', _auditoria: 'x2' });
  b2.update(doc(db, 'config/admins'), { lista: [] });
  await assertFails(b2.commit());
  const b3 = writeBatch(db);
  b3.set(doc(db, 'auditoria/x3'), { por: ADM, alvo: ADM, em: 'x' });
  b3.update(doc(db, 'usuarios/' + ADM), { papel: 'escritorio', _auditoria: 'x3' });
  await assertFails(b3.commit());
  await assertFails(deleteDoc(doc(db, 'usuarios/' + ADM)));
  await assertFails(setDoc(doc(ctx(ESC), 'auditoria/y'), { por: ESC }));
});
test('pedidos de orçamento: consulta por cliente e pedido sem projeto', async () => {
  await env.withSecurityRulesDisabled(async c => { const db = c.firestore();
    await setDoc(doc(db, 'quotes/q1'), { projectId: 'A1', clientId: 'A', criadoPor: ADM });
    await setDoc(doc(db, 'quotes/q2'), { projectId: '', clientId: '', criadoPor: ADM }); });
  await assertSucceeds(getDocs(query(collection(ctx(CLI), 'quotes'), where('clientId', 'in', ['A']))));
  await assertSucceeds(getDocs(query(collection(ctx(ESC), 'quotes'), where('projectId', 'in', ['A1']))));
  await assertFails(getDoc(doc(ctx(ESC), 'quotes/q2')));
  await assertFails(getDocs(query(collection(ctx(LEI), 'quotes'), where('clientId', 'in', ['A']))));
});
test('validade vencida corta o acesso', async () => {
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'usuarios/' + LEI), { 'acessos.p:A1': { n: 'L', ate: new Date(Date.now() - 1000) } }));
  await assertFails(getDoc(doc(ctx(LEI), 'allocations/a1')));
});
test('lote grande de um administrador (migração) passa no limite de leituras das regras', async () => {
  const db = ctx(ADM); const b = writeBatch(db);
  for (let i = 0; i < 400; i++) b.set(doc(db, 'allocations/m' + i), { projectId: ['A1', 'A2', 'B1'][i % 3], clientId: ['A', 'A', 'B'][i % 3], quantity: 1 });
  await assertSucceeds(b.commit());
});
test('lote grande de quem tem escrita no cliente', async () => {
  const db = ctx(CLI); const b = writeBatch(db);
  for (let i = 0; i < 300; i++) b.set(doc(db, 'allocations/k' + i), { projectId: ['A1', 'A2'][i % 2], clientId: 'A', quantity: 1 });
  await assertSucceeds(b.commit());
});

// ---- Baixas de estoque: responsável, motivo, estorno e imutabilidade (21/10/2026) ----
const baixa = (por, extra = {}) => ({ type: 'SAIDA', projectId: 'A1', clientId: 'A', productId: 'P1', quantity: 2, unitCost: 10, date: '2026-10-21', note: 'aplicado no 2º pavimento', criadoPor: por, criadoPorNome: por, ...extra });
test('baixa: em nome de quem grava, com motivo e quantidade positiva', async () => {
  const db = ctx(ESC);
  await assertSucceeds(setDoc(doc(db, 'movements/b1'), baixa(ESC)));
  await assertFails(setDoc(doc(db, 'movements/b2'), baixa(ESC, { criadoPor: '' })));
  await assertFails(setDoc(doc(db, 'movements/b3'), baixa(CLI)));
  await assertFails(setDoc(doc(db, 'movements/b4'), baixa(ESC, { note: '' })));
  await assertFails(setDoc(doc(db, 'movements/b5'), baixa(ESC, { quantity: -2 })));
  await assertFails(setDoc(doc(db, 'movements/b6'), baixa(ESC, { quantity: 0 })));
  await assertFails(setDoc(doc(ctx(LEI), 'movements/b7'), baixa(LEI)));
});
test('baixa não se altera nem se apaga; o reenvio idêntico passa', async () => {
  const db = ctx(ESC);
  await assertSucceeds(setDoc(doc(db, 'movements/b1'), baixa(ESC)));
  await assertFails(updateDoc(doc(db, 'movements/b1'), { quantity: 1 }));
  await assertFails(updateDoc(doc(db, 'movements/b1'), { note: 'outro motivo' }));
  await assertSucceeds(updateDoc(doc(db, 'movements/b1'), { _atualizadoEm: '2026-10-21T12:00:00Z', _atualizadoPor: ESC }));
  await assertFails(deleteDoc(doc(db, 'movements/b1')));
  await assertFails(deleteDoc(doc(ctx(ADM), 'movements/b1')));
  await assertSucceeds(deleteDoc(doc(ctx(ADM), 'movements/nao-existe')));
  await assertSucceeds(deleteDoc(doc(ctx(ADM), 'movements/e1'))); // entrada continua podendo ser apagada pelo administrador
});
test('estorno: um só por baixa, com a quantidade oposta, e nunca de um estorno', async () => {
  const db = ctx(ESC);
  await assertSucceeds(setDoc(doc(db, 'movements/b1'), baixa(ESC)));
  const est = (extra = {}) => baixa(ESC, { estornoDe: 'b1', quantity: -2, note: 'lançada em duplicidade', ...extra });
  await assertFails(setDoc(doc(db, 'movements/x1'), est()));                       // id fora do padrão
  await assertFails(setDoc(doc(db, 'movements/est-b1'), est({ quantity: -1 })));  // estorno parcial
  await assertFails(setDoc(doc(db, 'movements/est-b1'), est({ note: '' })));       // sem motivo
  await assertFails(setDoc(doc(db, 'movements/est-b1'), est({ projectId: 'A2' }))); // outro projeto
  await assertSucceeds(setDoc(doc(db, 'movements/est-b1'), est()));
  await assertFails(setDoc(doc(db, 'movements/est-b1'), est({ note: 'de novo' }))); // segundo estorno da mesma baixa
  await assertFails(setDoc(doc(db, 'movements/est-est-b1'), est({ estornoDe: 'est-b1', quantity: 2 }))); // estorno do estorno
  // estorno feito por outra pessoa com escrita no projeto: em nome dela
  await assertSucceeds(setDoc(doc(db, 'movements/b2'), baixa(ESC)));
  await assertSucceeds(setDoc(doc(ctx(CLI), 'movements/est-b2'), baixa(CLI, { estornoDe: 'b2', quantity: -2, note: 'material devolvido' })));
});

// ---- Log de atividades ----
const atv = (por, extra = {}) => ({ id: 'x', em: '2026-10-21T12:00:00Z', emServidor: serverTimestamp(), por, nome: por, papel: 'escritorio', cat: 'estoque', acao: 'baixa', texto: 'Baixa de estoque: 2 UN de Cimento', projetoId: 'A1', clienteId: 'A', ref: 'movements/b1', valor: 20, aparelho: 'Chrome · Linux', offline: false, ...extra });
test('log de atividades: cada um registra só as próprias, com a hora do servidor', async () => {
  const db = ctx(ESC);
  await assertSucceeds(setDoc(doc(db, 'atividades/a1'), atv(ESC, { id: 'a1' })));
  await assertFails(setDoc(doc(db, 'atividades/a2'), atv(CLI, { id: 'a2' })));                              // em nome de outra pessoa
  await assertFails(setDoc(doc(db, 'atividades/a3'), atv(ESC, { id: 'a3', emServidor: '2020-01-01T00:00:00Z' }))); // hora inventada
  await assertFails(setDoc(doc(db, 'atividades/a4'), atv(ESC, { id: 'a4', extra: 1 })));                    // campo fora da lista
  await assertFails(setDoc(doc(db, 'atividades/a5'), atv(ESC, { id: 'outro' })));                           // id diferente do documento
  await assertFails(setDoc(doc(db, 'atividades/a6'), atv(ESC, { id: 'a6', cat: 'qualquer' })));
  await assertFails(setDoc(doc(ctx(NOVO), 'atividades/a7'), atv(NOVO, { id: 'a7' })));                      // sem cadastro
  await assertSucceeds(setDoc(doc(ctx(OBRA), 'atividades/a8'), atv(OBRA, { id: 'a8', cat: 'obra', acao: 'obra_envio' })));
});
test('log de atividades: só administradores listam; ninguém altera nem apaga', async () => {
  await assertSucceeds(setDoc(doc(ctx(ESC), 'atividades/a1'), atv(ESC, { id: 'a1' })));
  await assertSucceeds(getDoc(doc(ctx(ESC), 'atividades/a1')));            // o autor confere um envio pelo id
  await assertFails(getDocs(collection(ctx(ESC), 'atividades')));
  await assertFails(getDoc(doc(ctx(CLI), 'atividades/a1')));
  await assertSucceeds(getDocs(query(collection(ctx(ADM), 'atividades'), where('em', '>=', '2026-01-01'))));
  await assertFails(setDoc(doc(ctx(ESC), 'atividades/a1'), atv(ESC, { id: 'a1', texto: 'alterado' })));
  await assertFails(updateDoc(doc(ctx(ADM), 'atividades/a1'), { texto: 'alterado' }));
  await assertFails(deleteDoc(doc(ctx(ADM), 'atividades/a1')));
});

// ---- Ajustes de quantidade e de custo (Produtos e ajustes, 21/10/2026) ----
test('ajuste de estoque: só administradores, e não se estorna', async () => {
  const aj = (por, extra = {}) => baixa(por, { ajuste: true, quantity: 1, ajusteValor: 0, saldoAntes: 5, saldoDepois: 4, custoAntes: 10, custoDepois: 10, note: 'inventário de 21/10', ...extra });
  await assertFails(setDoc(doc(ctx(ESC), 'movements/aj1'), aj(ESC)));                               // quem tem escrita não ajusta
  await assertFails(setDoc(doc(ctx(ESC), 'movements/aj2'), baixa(ESC, { ajusteValor: 50 })));       // nem mexe no custo por uma baixa
  await assertSucceeds(setDoc(doc(ctx(ADM), 'movements/aj3'), aj(ADM)));                            // falta
  await assertSucceeds(setDoc(doc(ctx(ADM), 'movements/aj4'), aj(ADM, { quantity: -2, saldoDepois: 7 }))); // sobra
  await assertSucceeds(setDoc(doc(ctx(ADM), 'movements/aj5'), aj(ADM, { quantity: 0, ajusteValor: 25, custoDepois: 15 }))); // só custo
  await assertFails(setDoc(doc(ctx(ESC), 'movements/est-aj3'), baixa(ESC, { estornoDe: 'aj3', quantity: -1, note: 'desfazer ajuste' })));
  await assertFails(updateDoc(doc(ctx(ESC), 'movements/aj3'), { note: 'outro' }));
});

// ---------- Materiais, requisição e devolução da obra (estoque → requisitado → consumido) ----------
const REQ = (id, extra = {}) => ({ id, codigo: 'REQ-' + id, tipo: 'requisicao', projectId: 'A1', clientId: 'A', autor: OBRA, autorNome: 'Mestre', criadoEm: '2026-10-22T10:00:00Z', status: 'pendente', obs: '', itens: [{ materialId: 'M1', nome: 'Cimento', unidade: 'SC', pedida: 5 }], ...extra });
const ATENDIDA = id => REQ(id, { status: 'atendida', atendidoPor: ESC, itens: [{ materialId: 'M1', nome: 'Cimento', unidade: 'SC', pedida: 5, atendida: 5, partes: [{ productId: 'P1', qtd: 5, unitCost: 40 }] }] });
const semRegras = f => env.withSecurityRulesDisabled(c => f(c.firestore()));
test('materiais: o mestre lê e não grava; o escritório com escrita grava', async () => {
  await semRegras(db => setDoc(doc(db, 'materiais/M1'), { id: 'M1', nome: 'Cimento CP II 50 kg', unidade: 'SC', ativo: true }));
  await assertSucceeds(getDocs(query(collection(ctx(OBRA), 'materiais'), where('ativo', '==', true))));
  await assertFails(setDoc(doc(ctx(OBRA), 'materiais/M2'), { id: 'M2', nome: 'Areia', unidade: 'M3', ativo: true }));
  await assertFails(setDoc(doc(ctx(LEI), 'materiais/M2'), { id: 'M2', nome: 'Areia', unidade: 'M3', ativo: true }));
  await assertSucceeds(setDoc(doc(ctx(ESC), 'materiais/M2'), { id: 'M2', nome: 'Areia', unidade: 'M3', ativo: true }));
  await assertFails(deleteDoc(doc(ctx(ESC), 'materiais/M2')));
});
test('requisição: o mestre cria só na obra concedida, pendente e em nome dele, e cancela a própria', async () => {
  const db = ctx(OBRA);
  await assertSucceeds(setDoc(doc(db, 'requisicoes/R1'), REQ('R1')));
  await assertFails(setDoc(doc(db, 'requisicoes/R2'), REQ('R2', { projectId: 'B1', clientId: 'B' })));
  await assertFails(setDoc(doc(db, 'requisicoes/R3'), REQ('R3', { autor: ESC })));
  await assertFails(setDoc(doc(db, 'requisicoes/R4'), REQ('R4', { status: 'atendida' })));
  await assertFails(setDoc(doc(db, 'requisicoes/R5'), REQ('R5', { itens: [] })));
  await assertSucceeds(getDocs(query(collection(db, 'requisicoes'), where('autor', '==', OBRA))));
  // o mestre não atende o próprio pedido nem muda os itens
  await assertFails(updateDoc(doc(db, 'requisicoes/R1'), { status: 'atendida', atendidoPor: OBRA }));
  await assertFails(updateDoc(doc(db, 'requisicoes/R1'), { itens: [{ materialId: 'M1', nome: 'Cimento', unidade: 'SC', pedida: 50 }] }));
  await assertSucceeds(updateDoc(doc(db, 'requisicoes/R1'), { status: 'cancelada', canceladoEm: '2026-10-22T11:00:00Z' }));
  await assertFails(updateDoc(doc(db, 'requisicoes/R1'), { status: 'pendente' }));
});
test('atender: o escritório com escrita entrega (REQUISICAO +) no mesmo lote; leitor e outra obra não', async () => {
  await semRegras(db => setDoc(doc(db, 'requisicoes/R1'), REQ('R1')));
  const mov = (id, extra = {}) => ({ id, type: 'REQUISICAO', requisicaoId: 'R1', productId: 'P1', projectId: 'A1', clientId: 'A', quantity: 5, unitCost: 40, criadoPor: ESC, note: 'Entregue à obra', ...extra });
  const lote = (db, m, r) => { const b = writeBatch(db); b.set(doc(db, 'movements/' + m.id), m); b.update(doc(db, 'requisicoes/R1'), r); return b.commit(); };
  // sem atender a requisição no mesmo lote, o movimento não passa
  await assertFails(setDoc(doc(ctx(ESC), 'movements/q0'), mov('q0')));
  await assertFails(lote(ctx(LEI), mov('q1', { criadoPor: LEI }), { status: 'atendida', atendidoPor: LEI }));
  await assertFails(lote(ctx(ESC), mov('q2', { criadoPor: OBRA }), { status: 'atendida', atendidoPor: ESC }));
  await assertSucceeds(lote(ctx(ESC), mov('q3'), { status: 'atendida', atendidoPor: ESC, itens: ATENDIDA('R1').itens }));
  await assertSucceeds(getDocs(query(collection(ctx(ESC), 'movements'), where('type', '==', 'REQUISICAO'), where('projectId', 'in', ['A1']))));
  await assertFails(getDocs(query(collection(ctx(OBRA), 'movements'), where('type', '==', 'REQUISICAO'), where('projectId', 'in', ['A1']))));
  // atendida não volta a pendente nem é recusada depois
  await assertFails(updateDoc(doc(ctx(ESC), 'requisicoes/R1'), { status: 'recusada', atendidoPor: ESC }));
});
test('consumo: só o mestre autor da requisição atendida baixa (SAIDA com requisicaoId) e marca o consumo', async () => {
  await semRegras(async db => { await setDoc(doc(db, 'requisicoes/R1'), ATENDIDA('R1')); await setDoc(doc(db, 'requisicoes/R2'), REQ('R2')); await setDoc(doc(db, 'requisicoes/R3'), ATENDIDA('R3')); await setDoc(doc(db, 'usuarios/outro@x.com'), { email: 'outro@x.com', papel: 'obra', ativo: true, acessos: { 'p:A1': { n: 'L', ate: null } } }); });
  const con = (id, extra = {}) => ({ id, type: 'SAIDA', requisicaoId: 'R1', productId: 'P1', projectId: 'A1', clientId: 'A', quantity: 3, unitCost: 40, note: 'Uso confirmado pela obra', criadoPor: OBRA, ...extra });
  const lote = (db, m, rid = 'R1') => { const b = writeBatch(db); b.set(doc(db, 'movements/' + m.id), m); b.update(doc(db, 'requisicoes/' + rid), { consumo: { '0_0': 3 }, consumoEm: '2026-10-22T12:00:00Z' }); return b.commit(); };
  await assertSucceeds(lote(ctx(OBRA), con('c1')));
  await assertFails(lote(ctx(OBRA), con('c2', { requisicaoId: 'R2' }), 'R2'));                 // requisição ainda pendente
  await assertFails(setDoc(doc(ctx(OBRA), 'movements/c3'), con('c3', { requisicaoId: '' })));   // baixa direta: o mestre não pode
  await assertFails(setDoc(doc(ctx(OBRA), 'movements/c4'), con('c4', { quantity: -3 })));
  await assertFails(lote(ctx('outro@x.com'), con('c5', { criadoPor: 'outro@x.com', requisicaoId: 'R3' }), 'R3')); // não é o autor
  // o mestre só mexe no consumo; o escritório não grava consumo
  await assertFails(updateDoc(doc(ctx(OBRA), 'requisicoes/R1'), { devolvido: { '0_0': 2 } }));
  await assertFails(updateDoc(doc(ctx(ESC), 'requisicoes/R1'), { consumo: { '0_0': 5 } }));
});
test('devolução: o mestre registra; o escritório recebe (REQUISICAO −) e marca o devolvido na origem', async () => {
  await semRegras(db => setDoc(doc(db, 'requisicoes/R1'), ATENDIDA('R1')));
  const DEV = { ...REQ('D1'), codigo: 'DEV-D1', tipo: 'devolucao', itens: [{ materialId: 'M1', nome: 'Cimento', unidade: 'SC', pedida: 2, partes: [{ requisicaoId: 'R1', i: 0, p: 0, productId: 'P1', qtd: 2 }] }] };
  await assertSucceeds(setDoc(doc(ctx(OBRA), 'requisicoes/D1'), DEV));
  const mov = (id, extra = {}) => ({ id, type: 'REQUISICAO', requisicaoId: 'R1', devolucaoId: 'D1', productId: 'P1', projectId: 'A1', clientId: 'A', quantity: -2, unitCost: 40, criadoPor: ESC, note: 'Devolvido ao estoque', ...extra });
  const lote = (db, m, status) => { const b = writeBatch(db); b.set(doc(db, 'movements/' + m.id), m); b.update(doc(db, 'requisicoes/D1'), { status, atendidoPor: ESC }); b.update(doc(db, 'requisicoes/R1'), { devolvido: { '0_0': 2 } }); return b.commit(); };
  await assertFails(lote(ctx(ESC), mov('d1'), 'recusada'));            // devolução recusada não volta ao estoque
  await assertFails(lote(ctx(LEI), mov('d2', { criadoPor: LEI }), 'recebida'));
  await assertSucceeds(lote(ctx(ESC), mov('d3'), 'recebida'));
  // devolução não pode virar "atendida"; requisição não pode virar "recebida"
  await semRegras(db => setDoc(doc(db, 'requisicoes/R9'), REQ('R9')));
  await assertFails(updateDoc(doc(ctx(ESC), 'requisicoes/R9'), { status: 'recebida', atendidoPor: ESC }));
});
