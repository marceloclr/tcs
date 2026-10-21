// ---------- Log de atividades ----------
// ==== #JS-ATIVIDADES: START ====
// Registra o que cada pessoa faz no sistema na coleção atividades do Firestore. Só administradores leem; ninguém altera nem apaga
// (firestore.rules). De onde vêm os registros:
//  - gravações locais: cada txWrite entrega as operações (onLocalCommit) e atvDeOps as descreve comparando com o estado anterior
//    (state ainda não foi recarregado nesse momento). Gravações automáticas do sistema passam opts.semLog;
//  - gravações diretas na nuvem (acessos e notas da obra): pelo window.__fb.commit, envolvido em atvEnvolverCommit;
//  - entrada, saída, modo offline, exportações e impressão: registrarAtividade onde acontecem.
// Sem conexão, os registros esperam numa fila neste navegador (localStorage) e sobem no próximo login.
const ATV_FILA = 'tcs_atividades_fila', ATV_MAX = 5000;
const ATV_CAT = {sessao:'Entrada e saída', estoque:'Estoque e baixas', notas:'Notas fiscais', cadastros:'Clientes e projetos', catalogo:'Catálogo de produtos',
 orcamentos:'Pedidos de orçamento', obra:'Notas da obra', acessos:'Usuários e acessos', exportacao:'Exportações e impressões', dados:'Dados e segurança'};
const ATV_IGNORAR = new Set(['notas_projeto', 'chaves']); // projeções derivadas: a nota e o rateio já descrevem a mudança

function atvFila(){try{return JSON.parse(localStorage.getItem(ATV_FILA) || '[]')}catch(e){return []}}
function atvFilaGravar(l){try{l.length ? localStorage.setItem(ATV_FILA, JSON.stringify(l.slice(-ATV_MAX))) : localStorage.removeItem(ATV_FILA)}catch(e){}}
function atvAparelho(){const u = navigator.userAgent;
 const nav = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'Navegador';
 const so = /Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iOS' : /Windows/.test(u) ? 'Windows' : /Mac OS/.test(u) ? 'macOS' : /Linux/.test(u) ? 'Linux' : '';
 return nav + (so ? ' · ' + so : '')}
const atvProj = pid => {const p = projectById(pid); return p ? projectLabel(p) : (pid ? 'projeto ' + pid : '')};
const atvNota = inv => inv ? `nº ${inv.number || '—'}${inv.series ? '/' + inv.series : ''} de ${inv.issuer || 'emitente não informado'}` : 'nota';

/** a = {cat, acao, texto, projetoId?, clienteId?, ref?, valor?}. Grava na fila e tenta enviar. */
function registrarAtividade(a){
 const e = {id: uid(), em: new Date().toISOString(), por: Nuvem.user?.email || '', nome: Nuvem.perfil?.nome || Nuvem.user?.nome || '', papel: Nuvem.perfil?.papel || '',
  cat: a.cat, acao: a.acao, texto: String(a.texto || '').slice(0, 1500), projetoId: a.projetoId || '', clienteId: a.clienteId || '', ref: a.ref || '',
  valor: Number.isFinite(a.valor) ? Math.round(a.valor * 100) / 100 : null, aparelho: atvAparelho(), offline: !nuvemConectada()};
 atvFilaGravar(atvFila().concat(e));
 atvEnviar();
 return e;
}

// Envio: lotes de até 400. Uma recusa do lote é conferida registro a registro: o que já existe na nuvem (envio anterior que a página
// não viu terminar) sai da fila; o resto continua nela (por exemplo, enquanto as regras novas não forem publicadas).
let atvEnviando = false;
async function atvEnviar(){
 const fb = window.__fb;
 if(atvEnviando || !fb || !nuvemConectada()) return;
 atvEnviando = true;
 try{
  const email = Nuvem.user.email;
  const lote = atvFila().filter(e => !e.por || e.por === email).slice(0, 400);
  if(!lote.length) return;
  const dado = e => ({...e, por: email, nome: e.nome || Nuvem.perfil?.nome || Nuvem.user.nome || email, papel: e.papel || Nuvem.perfil?.papel || '',
   offline: !!(e.offline || !e.por), emServidor: fb.agora()});
  const commit = fb.commitDireto || fb.commit;
  const enviados = new Set();
  try{await commit(lote.map(e => ({op:'set', store:'atividades', id:e.id, data:dado(e)}))); lote.forEach(e => enviados.add(e.id))}
  catch(err){
   for(const e of lote){
    if(await fb.get('atividades', e.id).catch(() => null)){enviados.add(e.id); continue}
    try{await commit([{op:'set', store:'atividades', id:e.id, data:dado(e)}]); enviados.add(e.id)}catch(e2){console.warn('Atividade ainda não registrada na nuvem:', e2.message)}
   }
  }
  atvFilaGravar(atvFila().filter(e => !enviados.has(e.id)));
  if(enviados.size === lote.length && atvFila().some(e => !e.por || e.por === email)) setTimeout(atvEnviar, 0);
 }catch(e){console.warn('Atividades não enviadas:', e.message)}
 finally{atvEnviando = false}
}

/** Registra a saída e espera (até 3 s) o registro subir antes do logout. */
async function atvRegistrarSaida(texto){
 const e = registrarAtividade({cat:'sessao', acao:'saida', texto: texto || 'Saiu do sistema'});
 for(let i = 0; i < 30 && atvFila().some(x => x.id === e.id); i++){await new Promise(r => setTimeout(r, 100)); atvEnviar()}
}

/* ------------------------- gravações locais (txWrite) ------------------------- */
function atvDiferencas(antes, depois, campos){
 return Object.entries(campos).filter(([k]) => String(antes?.[k] ?? '') !== String(depois?.[k] ?? ''))
  .map(([k, rot]) => `${rot}: ${antes?.[k] ?? '—'} → ${depois?.[k] ?? '—'}`).join('; ');
}
function atvDeOps(ops){
 const lista = [], porStore = {};
 ops.forEach(o => {if(o.op !== 'clear' && !ATV_IGNORAR.has(o.store)) (porStore[o.store] = porStore[o.store] || []).push(o)});
 const antigo = (store, id) => (state[store] || []).find(x => String(x.id) === String(id));
 const comNota = !!(porStore.invoices || porStore.allocations || porStore.movements || porStore.quotes);
 // baixas e estornos (o mais importante do log)
 for(const o of porStore.movements || []){
  const m = o.obj, v = antigo('movements', o.id);
  if(o.op === 'delete'){if(v?.type === 'SAIDA') lista.push({cat:'estoque', acao:'baixa_excluida', texto:`Excluiu a baixa de ${num(v.quantity)} de ${v.description || 'produto'} (${atvProj(v.projectId)})`, projetoId:v.projectId, clienteId:v.clientId, ref:'movements/' + o.id}); continue}
  if(m.type !== 'SAIDA' || v) continue;
  const p = state.products.find(x => x.id === m.productId), un = p?.unit || 'UN', valor = Math.abs(Number(m.quantity) * Number(m.unitCost || 0));
  if(m.estornoDe){const orig = antigo('movements', m.estornoDe);
   lista.push({cat:'estoque', acao:'estorno', texto:`Estornou a baixa de ${num(-m.quantity)} ${un} de ${p?.name || m.description || 'produto'} de ${orig?.date ? orig.date.split('-').reverse().join('/') : 'data não informada'} (${atvProj(m.projectId)}), registrada por ${orig?.criadoPorNome || orig?.criadoPor || orig?._atualizadoPor || 'pessoa não identificada'}. Motivo: ${m.note}. Valor devolvido ao estoque: ${money(valor)}`, projetoId:m.projectId, clienteId:m.clientId, ref:'movements/' + m.estornoDe, valor});
  }else lista.push({cat:'estoque', acao:'baixa', texto:`Baixa de estoque: ${num(m.quantity)} ${un} de ${p?.name || m.description || 'produto'} — ${atvProj(m.projectId)}, em ${String(m.date || '').split('-').reverse().join('/')}. Motivo: ${m.note || '—'}. Valor: ${money(valor)}`, projetoId:m.projectId, clienteId:m.clientId, ref:'movements/' + o.id, valor});
 }
 // notas
 for(const o of porStore.invoices || []){
  const n = o.obj, v = antigo('invoices', o.id);
  if(o.op === 'delete'){lista.push({cat:'notas', acao:'nota_excluida', texto:`Excluiu a nota ${atvNota(v)}${v ? ' (' + money(v.total) + ')' : ''}`, ref:'invoices/' + o.id}); continue}
  if(!v) lista.push({cat:'notas', acao:'nota_importada', texto:`Importou a nota ${atvNota(n)}, ${money(n.total)}, ${isServico(n) ? 'serviços' : 'materiais'} (${n.source || n.format || 'importação'})`, ref:'invoices/' + o.id, valor:Number(n.total) || 0});
  // só campos que a pessoa vê; o escopo (aberta/fechada) é interno e muda junto com o vínculo, que já tem registro próprio
  else{const d = atvDiferencas(v, n, {number:'Número', series:'Série', date:'Data', issuer:'Emitente', total:'Total', tipo:'Tipo', format:'Formato'});
   if(d) lista.push({cat:'notas', acao:'nota_alterada', texto:`Alterou a nota ${atvNota(n)}: ${d}`, ref:'invoices/' + o.id})}
 }
 // vínculos e distribuição: o quadro inteiro da nota, antes e depois (rateios inalterados não são regravados e não vêm nas operações)
 const notasRateio = new Set();
 for(const o of porStore.allocations || []){const a = o.op === 'delete' ? antigo('allocations', o.id) : o.obj; if(a) notasRateio.add(a.invoiceId)}
 for(const invId of notasRateio){
  const inv = (porStore.invoices || []).find(x => x.id === invId)?.obj || antigo('invoices', invId);
  const antes = state.allocations.filter(a => a.invoiceId === invId), depois = new Map(antes.map(a => [String(a.id), a]));
  for(const o of porStore.allocations) {if(o.op === 'delete') depois.delete(String(o.id)); else if(o.obj.invoiceId === invId) depois.set(String(o.id), o.obj)}
  const somar = l => {const m = new Map(); l.forEach(a => m.set(a.projectId, (m.get(a.projectId) || 0) + (inv ? Number(a.quantity || 0) * itemUnitCost(inv, a.itemIndex) : 0))); return m};
  const fmt = m => [...m.entries()].filter(([, v]) => v > 0.004).map(([pid, v]) => `${atvProj(pid)}: ${money(v)}`).join('; ') || 'nenhum projeto';
  const ma = somar(antes), md = somar([...depois.values()]), so = [...md.keys()];
  lista.push({cat:'notas', acao: md.size ? 'nota_distribuida' : 'nota_desvinculada',
   texto: md.size ? `${ma.size ? 'Redistribuiu' : 'Vinculou'} a nota ${atvNota(inv)}: ${fmt(md)}${ma.size ? ' (antes: ' + fmt(ma) + ')' : ''}` : `Desvinculou a nota ${atvNota(inv)} de ${fmt(ma)}`,
   projetoId: so.length === 1 ? so[0] : '', clienteId: so.length === 1 ? projectById(so[0])?.clientId || '' : '', ref:'invoices/' + invId,
   valor: [...md.values()].reduce((x, y) => x + y, 0)});
 }
 // clientes e projetos
 for(const o of porStore.clients || []){
  const c = o.obj, v = antigo('clients', o.id);
  if(o.op === 'delete') lista.push({cat:'cadastros', acao:'cliente_excluido', texto:`Excluiu o cliente ${v?.name || o.id}`, clienteId:o.id});
  else if(!v) lista.push({cat:'cadastros', acao:'cliente_criado', texto:`Cadastrou o cliente ${c.name}${c.doc ? ' (' + c.doc + ')' : ''}`, clienteId:o.id});
  else{const d = atvDiferencas(v, c, {name:'Nome', doc:'CNPJ/CPF'}); if(d) lista.push({cat:'cadastros', acao:'cliente_alterado', texto:`Alterou o cliente ${c.name}: ${d}`, clienteId:o.id})}
 }
 for(const o of porStore.projects || []){
  const p = o.obj, v = antigo('projects', o.id), cli = id => clientById(id)?.name || '';
  if(o.op === 'delete') lista.push({cat:'cadastros', acao:'projeto_excluido', texto:`Excluiu o projeto ${v?.name || o.id}${v ? ' (' + cli(v.clientId) + ')' : ''}`, projetoId:o.id, clienteId:v?.clientId});
  else if(!v) lista.push({cat:'cadastros', acao:'projeto_criado', texto:`Cadastrou o projeto ${p.name} (${cli(p.clientId)})`, projetoId:o.id, clienteId:p.clientId});
  else{const d = atvDiferencas(v, p, {name:'Nome', status:'Situação', color:'Cor'}); if(d) lista.push({cat:'cadastros', acao:'projeto_alterado', texto:`Alterou o projeto ${p.name} (${cli(p.clientId)}): ${d}`, projetoId:o.id, clienteId:p.clientId})}
 }
 // catálogo: só quando o produto é editado sozinho (nas notas, baixas e pedidos o saldo muda junto)
 if(!comNota) for(const o of porStore.products || []){
  const p = o.obj, v = antigo('products', o.id);
  if(o.op === 'delete') lista.push({cat:'catalogo', acao:'produto_excluido', texto:`Excluiu o produto ${v?.name || o.id}`});
  else if(!v) lista.push({cat:'catalogo', acao:'produto_criado', texto:`Cadastrou o produto ${p.name}`});
  else{const d = atvDiferencas(v, p, {name:'Nome', barcode:'EAN', unit:'Unidade', stock:'Saldo'}); if(d) lista.push({cat:'catalogo', acao:'produto_alterado', texto:`Alterou o produto ${p.name}: ${d}`})}
 }
 // pedidos de orçamento
 for(const o of porStore.quotes || []){
  const q = o.obj, v = antigo('quotes', o.id);
  if(o.op === 'delete') lista.push({cat:'orcamentos', acao:'orcamento_excluido', texto:`Excluiu o pedido de orçamento ${v?.number || o.id}`, projetoId:v?.projectId, clienteId:v?.clientId});
  else if(!v) lista.push({cat:'orcamentos', acao:'orcamento_criado', texto:`Gerou o pedido de orçamento ${q.number} para ${q.supplier?.name || 'fornecedor não informado'}, ${q.items?.length || 0} item(ns)${q.projectId ? ' — ' + atvProj(q.projectId) : ''}`, projetoId:q.projectId, clienteId:q.clientId});
  else lista.push({cat:'orcamentos', acao:'orcamento_alterado', texto:`Alterou o pedido de orçamento ${q.number}`, projetoId:q.projectId, clienteId:q.clientId});
 }
 // qualquer outra coleção (para nada escapar do log)
 for(const [s, l] of Object.entries(porStore)) if(!['movements', 'invoices', 'allocations', 'clients', 'projects', 'products', 'quotes'].includes(s))
  lista.push({cat:'dados', acao:'gravacao', texto:`${l.length} alteração(ões) em ${s}`});
 return lista;
}

/* --------------------- gravações diretas na nuvem (__fb.commit) --------------------- */
function atvDeCommit(ops){
 for(const o of ops){
  const d = o.data || {};
  if(o.store === 'auditoria' && o.op === 'set'){
   const r = typeof auditResumo === 'function' ? auditResumo(d) : {antes:'', depois:''};
   const verbo = {criar:'Cadastrou', alterar:'Alterou o cadastro e os acessos de', excluir:'Excluiu o cadastro de', recusar:'Recusou a solicitação de acesso de', config:'Alterou a configuração'}[d.acao] || 'Alterou';
   registrarAtividade({cat:'acessos', acao:'acesso_' + (d.acao || 'alterar'), texto:`${verbo} ${d.acao === 'config' ? '' : d.alvo}${d.acao === 'alterar' || d.acao === 'criar' ? `. Antes: ${r.antes}. Depois: ${r.depois}` : ''}`.trim(), ref:'auditoria/' + o.id});
  }else if(o.store === 'capturas' && o.op === 'update' && d.status){
   const c = typeof Fila !== 'undefined' ? Fila.itens.get(o.id) : null;
   const de = c ? ` enviada por ${c.autor} (${atvProj(c.projectId)})` : '';
   const t = {em_conferencia:`Abriu para conferência a nota da obra${de}`, lancada:`Lançou a nota da obra${de}`, descartada:`Descartou a nota da obra${de}. Motivo: ${d.motivo || '—'}`}[d.status];
   if(t) registrarAtividade({cat:'obra', acao:'obra_' + d.status, texto:t, projetoId:c?.projectId, clienteId:c?.clientId, ref:'capturas/' + o.id});
  }else if(o.store === 'usuarios' && o.op === 'update' && 'telefone' in d) registrarAtividade({cat:'acessos', acao:'telefone', texto:'Atualizou o próprio telefone de contato'});
 }
}
function atvEnvolverCommit(){
 const fb = window.__fb;
 if(!fb || fb.commitDireto) return;
 const orig = fb.commit;
 fb.commitDireto = orig;
 fb.commit = async ops => {const r = await orig(ops); try{atvDeCommit(ops)}catch(e){console.error('Falha ao registrar a atividade:', e)} return r};
}
window.addEventListener('tcs-fb', atvEnvolverCommit);
atvEnvolverCommit();

// Liga o log às gravações locais. O envio à nuvem continua com o onLocalCommit original (js/nuvem.js).
{const enviarNuvem = onLocalCommit;
 onLocalCommit = (ops, opts = {}) => {
  if(!opts.semLog){try{atvDeOps(ops).forEach(registrarAtividade)}catch(e){console.error('Falha ao registrar a atividade:', e)}}
  if(enviarNuvem) enviarNuvem(ops, opts);
 };
}

/* ----------------------------- telas (só administradores) ----------------------------- */
const AtvAdm = {itens: [], unsub: null, dias: 30, pessoa: '', cat: '', busca: '', erro: ''};
function atvLigar(){
 if(AtvAdm.unsub || !window.__fb) return;
 const desde = AtvAdm.dias ? new Date(Date.now() - AtvAdm.dias * 864e5).toISOString() : '';
 const m = new Map();
 AtvAdm.itens = []; AtvAdm.erro = '';
 AtvAdm.unsub = window.__fb.listen('atividades', desde ? [['em', '>=', desde]] : [], ch => {
  ch.forEach(c => c.type === 'removed' ? m.delete(c.id) : m.set(c.id, {...c.data, id:c.id}));
  AtvAdm.itens = [...m.values()].sort((a, b) => String(b.em).localeCompare(String(a.em)));
  if(Adm.aba === 'atividades') renderUsuarios();
 }, e => {AtvAdm.erro = 'Não foi possível ler o log: ' + e.message; renderUsuarios()});
}
function atvDesligar(){if(AtvAdm.unsub){try{AtvAdm.unsub()}catch(e){} AtvAdm.unsub = null}}
function atvFiltradas(){
 const q = norm(AtvAdm.busca);
 return AtvAdm.itens.filter(a => (!AtvAdm.pessoa || a.por === AtvAdm.pessoa) && (!AtvAdm.cat || a.cat === AtvAdm.cat)
  && (!q || norm([a.texto, a.nome, a.por, atvProj(a.projetoId)].join(' ')).includes(q)));
}
function atvAdmHtml(){
 atvLigar();
 const l = atvFiltradas(), MOSTRA = 500;
 const pessoas = [...new Map(AtvAdm.itens.map(a => [a.por, a.nome || a.por])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'));
 const baixas = l.filter(a => a.acao === 'baixa').length, estornos = l.filter(a => a.acao === 'estorno').length;
 const sel = (attr, atual, ops, dica) => `<select ${attr} title="${esc(dica)}">${ops.map(([v, r]) => `<option value="${esc(v)}"${String(atual) === String(v) ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select>`;
 return `<div class="row" style="margin:12px 0">${sel('data-atv-dias', AtvAdm.dias, [[1, 'Últimas 24 horas'], [7, 'Últimos 7 dias'], [30, 'Últimos 30 dias'], [90, 'Últimos 90 dias'], [365, 'Últimos 12 meses'], [0, 'Todo o período']], 'Período carregado da nuvem')}
 ${sel('data-atv-pessoa', AtvAdm.pessoa, [['', 'Todas as pessoas'], ...pessoas], 'Mostra só as atividades de uma pessoa')}
 ${sel('data-atv-cat', AtvAdm.cat, [['', 'Todos os tipos'], ...Object.entries(ATV_CAT)], 'Mostra só um tipo de atividade')}
 <input class="search" data-atv-busca value="${esc(AtvAdm.busca)}" placeholder="Buscar produto, projeto, nota, pessoa…" title="Filtra pelo texto da atividade, pela pessoa ou pelo projeto">
 <button class="btn" data-atv-csv title="Baixa em CSV as atividades filtradas">Exportar CSV</button></div>
 ${AtvAdm.erro ? `<div class="notice danger">${esc(AtvAdm.erro)}</div>` : ''}
 <p class="hint" style="margin:0 0 10px">Registro somente leitura de tudo o que cada pessoa faz no sistema: entradas e saídas, notas, vínculos, baixas e estornos de estoque, cadastros, pedidos, acessos, exportações e impressões. ${l.length} atividade(s)${AtvAdm.cat || AtvAdm.pessoa || AtvAdm.busca ? ' no filtro' : ''}, ${baixas} baixa(s) e ${estornos} estorno(s) de estoque.</p>
 <div class="tablewrap"><table class="no-sort atv-tabela"><thead><tr><th>Quando</th><th>Pessoa</th><th>Tipo</th><th>Atividade</th><th>Projeto</th></tr></thead><tbody>${
  l.slice(0, MOSTRA).map(a => `<tr class="${a.acao === 'baixa' ? 'atv-baixa' : a.acao === 'estorno' ? 'atv-estorno' : ''}"><td style="white-space:nowrap" title="${esc('Hora do aparelho: ' + fmtData(a.em) + (a.emServidor ? '\nHora do servidor: ' + fmtData(a.emServidor) : '') + (a.offline ? '\nFeita sem conexão e enviada depois' : ''))}">${fmtData(a.em)}${a.offline ? ' <span class="pill warn" title="Feita sem conexão e enviada depois">offline</span>' : ''}</td><td><strong>${esc(a.nome || a.por)}</strong><div class="hint">${esc(a.por)}${a.aparelho ? ' · ' + esc(a.aparelho) : ''}</div></td><td><span class="pill${a.cat === 'estoque' ? ' red' : ''}">${esc(ATV_CAT[a.cat] || a.cat)}</span></td><td>${esc(a.texto)}</td><td>${a.projetoId ? esc(atvProj(a.projetoId)) : '<span class="muted">—</span>'}</td></tr>`).join('')
  || '<tr><td colspan="5" class="muted">Nenhuma atividade no período.</td></tr>'}</tbody></table></div>
 ${l.length > MOSTRA ? `<p class="hint">Mostrando as ${MOSTRA} mais recentes. Use os filtros ou o CSV para ver todas.</p>` : ''}`;
}
document.addEventListener('change', e => {
 const t = e.target;
 if(t.matches('[data-atv-dias]')){AtvAdm.dias = Number(t.value); atvDesligar(); renderUsuarios()}
 else if(t.matches('[data-atv-pessoa]')){AtvAdm.pessoa = t.value; renderUsuarios()}
 else if(t.matches('[data-atv-cat]')){AtvAdm.cat = t.value; renderUsuarios()}
});
document.addEventListener('input', e => {
 if(!e.target.matches('[data-atv-busca]')) return;
 AtvAdm.busca = e.target.value;
 const pos = e.target.selectionStart; renderUsuarios();
 const i = document.querySelector('[data-atv-busca]'); if(i){i.focus(); i.setSelectionRange(pos, pos)}
});
document.addEventListener('click', e => {
 if(!e.target.closest('[data-atv-csv]')) return;
 csvDownload('log-de-atividades.csv', [['Quando (aparelho)', 'Quando (servidor)', 'Pessoa', 'E-mail', 'Papel', 'Tipo', 'Ação', 'Atividade', 'Cliente', 'Projeto', 'Valor (R$)', 'Offline', 'Aparelho', 'Referência']]
  .concat(atvFiltradas().map(a => [fmtData(a.em), a.emServidor ? fmtData(a.emServidor) : '', a.nome, a.por, a.papel, ATV_CAT[a.cat] || a.cat, a.acao, a.texto,
   clientById(a.clienteId)?.name || '', a.projetoId ? atvProj(a.projetoId) : '', a.valor == null ? '' : String(a.valor).replace('.', ','), a.offline ? 'sim' : '', a.aparelho, a.ref])));
});
// ==== #JS-ATIVIDADES: END ====
