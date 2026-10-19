// Testes das regras do Firestore (firestore.rules) no emulador. Rodar com: npm test (dentro de testes/).
import { test, before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, writeBatch, documentId } from 'firebase/firestore';

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
  await assertSucceeds(setDoc(doc(db, 'capturas/c1'), { autor: OBRA, projectId: 'A1', clientId: 'A', status: 'pendente' }));
  await assertFails(setDoc(doc(db, 'capturas/c2'), { autor: OBRA, projectId: 'A2', clientId: 'A', status: 'pendente' }));
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
test('cadastro: aguardando autorização, desativado e implantação', async () => {
  const novo = ctx(NOVO);
  await assertSucceeds(getDoc(doc(novo, 'usuarios/' + NOVO)));
  await assertFails(getDocs(query(collection(novo, 'projects'), where(documentId(), 'in', ['A1']))));
  await assertSucceeds(setDoc(doc(novo, 'solicitacoes/' + NOVO), { email: NOVO, nome: 'Novo', pedidoEm: 'x' }));
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
