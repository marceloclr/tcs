// ==== #JS-ESCOPO: START ====
// Escopo de acesso das notas (acessos por cliente e projeto).
// - Cada nota guarda escopo ('aberta' enquanto há unidades sem projeto; 'fechada' quando tudo está distribuído), projetos e clientes.
// - Para cada projeto da nota existe uma projeção em notas_projeto ({notaId}__{projetoId}) com o cabeçalho da nota e só os itens
//   rateados àquele projeto, com o custo unitário pago já calculado. Quem não tem acesso a todos os projetos da nota lê só as projeções.
// - O índice chaves/{chave} acusa nota repetida em toda a base sem revelar a nota.
// - Os rateios e as entradas da nota carregam o mesmo escopo, para que quem tem escrita veja as notas abertas e o que já foi distribuído.
const NOTA_CAMPOS=['id','key','number','series','date','operation','issuer','issuerDoc','recipient','tipo','format','source','postedAt','protocolStatus','servico'];
const projecaoId=(invId,pid)=>invId+'__'+pid;
// Situação calculada sobre uma lista de rateios (a mesma conta de invoiceStatus, que usa os rateios do estado).
function notaEscopo(inv,allocs){const items=inv.items||[];const tot=items.reduce((a,it)=>a+Number(it.quantity||0),0),alo=allocs.reduce((a,x)=>a+Number(x.quantity||0),0);
 const projetos=[...new Set(allocs.map(a=>a.projectId))].sort(),clientes=[...new Set(allocs.map(a=>a.clientId||projectById(a.projectId)?.clientId||'').filter(Boolean))].sort();
 return {escopo:alo>1e-9&&alo+1e-9>=tot?'fechada':'aberta',projetos,clientes}}
// Projeção da nota para um projeto: itens de outros projetos viram marcadores vazios (o índice do item é mantido para os rateios).
function notaProjecao(inv,allocs,pid){const meus=allocs.filter(a=>a.projectId===pid);const cab={};NOTA_CAMPOS.forEach(k=>{if(inv[k]!==undefined)cab[k]=inv[k]});
 const items=(inv.items||[]).map((it,j)=>{const q=meus.filter(a=>a.itemIndex===j).reduce((s,a)=>s+Number(a.quantity||0),0);if(q<=1e-12)return {description:'',quantity:0,lineTotal:0,discount:0,_oculto:true};const qo=Number(it.quantity)||1;return {...it,quantity:Math.round(q*1e8)/1e8,lineTotal:Math.round(q*Number(it.unitPrice||0)*100)/100,discount:Math.round(Number(it.discount||0)*q/qo*100)/100,_custoUnit:itemUnitCost(inv,j)}});
 const total=items.reduce((s,it)=>s+(it._oculto?0:Number(it.quantity)*Number(it._custoUnit||0)),0);
 const cid=meus[0]?.clientId||projectById(pid)?.clientId||'';
 return {id:projecaoId(inv.id,pid),invoiceId:inv.id,projectId:pid,clientId:cid,nota:{...cab,total:Math.round(total*100)/100,items}}}
// Notas montadas a partir das projeções (para quem não lê a nota inteira). Várias projeções da mesma nota são somadas item a item.
function notasDasProjecoes(projecoes,excluir){const por=new Map();for(const p of projecoes){if(excluir?.has(p.invoiceId)||!p.nota)continue;const n=por.get(p.invoiceId);
  if(!n){por.set(p.invoiceId,{...p.nota,id:p.invoiceId,items:p.nota.items.map(it=>({...it})),_parcial:true,_projetos:[p.projectId]});continue}
  n._projetos.push(p.projectId);n.total=Math.round((Number(n.total)+Number(p.nota.total))*100)/100;
  p.nota.items.forEach((it,j)=>{const a=n.items[j];if(it._oculto)return;if(!a||a._oculto){n.items[j]={...it};return}const q=Number(a.quantity)+Number(it.quantity);a.lineTotal=Math.round((Number(a.lineTotal)+Number(it.lineTotal))*100)/100;a.discount=Math.round((Number(a.discount||0)+Number(it.discount||0))*100)/100;a.quantity=Math.round(q*1e8)/1e8})}
 return [...por.values()]}
const sem=(o,...k)=>{const c={...o};k.forEach(x=>delete c[x]);return c};
const igual=(a,b)=>JSON.stringify(sem(a,'_atualizadoEm','_atualizadoPor'))===JSON.stringify(sem(b,'_atualizadoEm','_atualizadoPor'));
// Grava, dentro de uma transação de txWrite (stores: allocations, invoices, notas_projeto, movements), a nova distribuição de uma nota:
// só os rateios que mudaram, o escopo da nota, as projeções e o escopo das entradas. Rateios inalterados mantêm o id.
const STORES_DIST=['allocations','invoices','notas_projeto','movements'];
function escopoGravarNota(os,inv,novas,antigas){const sc=notaEscopo(inv,novas);const ids=new Set(novas.map(a=>a.id));
 antigas.filter(a=>!ids.has(a.id)).forEach(a=>os.allocations.delete(a.id));
 const velhas=new Map(antigas.map(a=>[a.id,a]));
 novas.forEach(a=>{const n={...a,escopo:sc.escopo};const v=velhas.get(a.id);if(!v||!igual(v,n))os.allocations.put(n)});
 const invNovo={...sem(inv,'_parcial','_projetos'),...sc};if(!igual(inv,invNovo))os.invoices.put(invNovo);
 const proj=new Map(state.notas_projeto.filter(p=>p.invoiceId===inv.id).map(p=>[p.projectId,p]));
 for(const pid of sc.projetos){const p=notaProjecao(inv,novas,pid),v=proj.get(pid);if(!v||!igual(v,p))os.notas_projeto.put(p);proj.delete(pid)}
 for(const p of proj.values())os.notas_projeto.delete(p.id);
 state.movements.filter(m=>m.type==='ENTRADA'&&m.invoiceId===inv.id&&m.escopo!==sc.escopo).forEach(m=>os.movements.put({...m,escopo:sc.escopo}));
 return sc}
// Preparação da base (administradores): calcula escopo, projeções, índice de chaves e o cliente dos pedidos de orçamento
// para todos os registros. Só grava o que mudou; pode ser executada de novo sem efeito colateral.
async function escopoRecalcular(){let n=0;await txWrite([...STORES_DIST,'chaves','quotes'],os=>{const cont=f=>({put:o=>{f.put(o);n++},delete:id=>{f.delete(id);n++}});
  const o2={allocations:cont(os.allocations),invoices:cont(os.invoices),notas_projeto:cont(os.notas_projeto),movements:cont(os.movements)};
  const comNota=new Set();
  for(const inv of state.invoices){if(inv._parcial)continue;comNota.add(inv.id);escopoGravarNota(o2,inv,state.allocations.filter(a=>a.invoiceId===inv.id),state.allocations.filter(a=>a.invoiceId===inv.id));
   if(!state.chaves.some(c=>c.id===inv.key)){os.chaves.put({id:inv.key,notaId:inv.id,criadoEm:inv.postedAt||new Date().toISOString()});n++}}
  state.notas_projeto.filter(p=>!comNota.has(p.invoiceId)).forEach(p=>{os.notas_projeto.delete(p.id);n++});
  state.quotes.forEach(q=>{const cid=q.projectId?projectById(q.projectId)?.clientId||'':'';if((q.clientId||'')!==cid||!q.criadoPor){os.quotes.put({...q,clientId:cid,criadoPor:q.criadoPor||Nuvem.user?.email||''});n++}})});
 await refresh();return n}
// Prepara um conjunto completo de registros (backup a restaurar ou nota de exemplo) antes de gravar: escopo das notas,
// dos rateios e das entradas, projeções, índice de chaves e cliente dos pedidos. Assim o lote já chega à nuvem como as regras exigem.
function escopoNormalizar(b){const projCli=new Map((b.projects||[]).concat(state.projects).map(p=>[p.id,p.clientId]));
 b.allocations=(b.allocations||[]).map(a=>({...a,clientId:a.clientId||projCli.get(a.projectId)||''}));b.notas_projeto=[];const chaves=new Map((b.chaves||[]).map(c=>[c.id,c]));
 b.invoices=(b.invoices||[]).map(inv0=>{const al=b.allocations.filter(a=>a.invoiceId===inv0.id);const inv={...inv0,...notaEscopo(inv0,al)};
  al.forEach(a=>a.escopo=inv.escopo);(b.movements||[]).forEach(m=>{if(m.type==='ENTRADA'&&m.invoiceId===inv.id)m.escopo=inv.escopo});
  inv.projetos.forEach(pid=>b.notas_projeto.push(notaProjecao(inv,al,pid)));if(!chaves.has(inv.key))chaves.set(inv.key,{id:inv.key,notaId:inv.id,criadoEm:inv.postedAt||new Date().toISOString()});return inv});
 b.chaves=[...chaves.values()];b.quotes=(b.quotes||[]).map(q=>({...q,clientId:q.projectId?projCli.get(q.projectId)||'':'',criadoPor:q.criadoPor||Nuvem.user?.email||''}));return b}
// Totais por projeto como os vê quem lê só as projeções; devem bater com os da base completa.
function escopoTotais(usarProjecoes){const salvo=state.invoices;try{if(usarProjecoes){const proj=state.projects.map(p=>p.id);state.invoices=notasDasProjecoes(state.notas_projeto.filter(p=>proj.includes(p.projectId)))}const {clientes}=stockTree();const m=new Map();clientes.forEach(c=>{m.set('c:'+c.c.id,c.tot);c.projetos.forEach(x=>m.set('p:'+x.p.id,x.tot))});return m}finally{state.invoices=salvo}}
function escopoConferir(){const a=escopoTotais(false),b=escopoTotais(true);const linhas=[];let ok=true;
 for(const [k,t] of a){const u=b.get(k)||emptyTot();const nome=k.startsWith('c:')?clientById(k.slice(2))?.name:projectLabel(projectById(k.slice(2)));const dif=Math.abs(t.pago-u.pago)+Math.abs(t.serv-u.serv)+Math.abs(t.estoque-u.estoque);if(dif>0.02)ok=false;linhas.push({k,nome,antes:t,depois:u,ok:dif<=0.02})}
 return {ok,linhas}}
// ==== #JS-ESCOPO: END ====
// ==== #JS-ESCOPO-PREPARO: START ====
// Painel "Preparar a base para acessos por projeto" (Dados e segurança): backup obrigatório, preparação e conferência dos totais.
let escopoBackupFeito=false,escopoResultado=null;
function escopoPrecisa(){const fal=[];const ab=state.invoices.filter(i=>!i._parcial);
 if(ab.some(i=>!i.escopo))fal.push(ab.filter(i=>!i.escopo).length+' nota(s) sem escopo');
 const chs=new Set(state.chaves.map(c=>c.id));const semCh=ab.filter(i=>!chs.has(i.key)).length;if(semCh)fal.push(semCh+' nota(s) sem registro no índice de chaves');
 const semProj=ab.filter(i=>state.allocations.some(a=>a.invoiceId===i.id&&!state.notas_projeto.some(p=>p.id===projecaoId(i.id,a.projectId)))).length;if(semProj)fal.push(semProj+' nota(s) sem projeção por projeto');
 const semCli=state.quotes.filter(q=>q.clientId===undefined||!q.criadoPor).length;if(semCli)fal.push(semCli+' pedido(s) de orçamento sem cliente ou autor');
 return fal}
function renderEscopoPanel(){const el=$('#escopoPanel');if(!el)return;const fal=escopoPrecisa();
 const tab=escopoResultado?`<div class="notice ${escopoResultado.ok?'success':'danger'}" style="margin-top:12px">${escopoResultado.ok?'Conferência concluída: os totais de cada cliente e projeto vistos pelas projeções batem com os da base completa.':'Atenção: há diferença nos totais de algum cliente ou projeto. Não libere acessos parciais antes de revisar; se preferir, restaure o backup baixado.'} ${escopoResultado.n} registro(s) gravado(s).</div><details style="margin-top:8px"><summary>Totais antes e depois, por cliente e projeto</summary><div class="tablewrap" style="margin-top:8px"><table class="no-sort"><thead><tr><th>Cliente / projeto</th><th class="num">Custo (base completa)</th><th class="num">Custo (projeções)</th><th class="num">Em estoque (completa)</th><th class="num">Em estoque (projeções)</th><th></th></tr></thead><tbody>${escopoResultado.linhas.map(l=>`<tr class="${l.k.startsWith('c:')?'lv-client':''}"><td>${esc(l.nome||'—')}</td><td class="num">${money(l.antes.pago+l.antes.serv)}</td><td class="num">${money(l.depois.pago+l.depois.serv)}</td><td class="num">${money(l.antes.estoque)}</td><td class="num">${money(l.depois.estoque)}</td><td>${l.ok?'✓':'<strong style="color:#b91c1c">diferença</strong>'}</td></tr>`).join('')}</tbody></table></div></details>`:'';
 el.innerHTML=`<h3>Acessos por projeto: preparação da base</h3><p>Para que cada pessoa veja só os clientes e projetos concedidos, cada nota precisa saber em quais projetos foi distribuída, e cada projeto recebe uma cópia restrita (projeção) com os itens e valores que lhe cabem. Esta preparação calcula isso para os registros existentes; as notas novas já nascem preparadas.</p>
 <p class="hint">Situação: ${fal.length?esc(fal.join(' · ')):'base preparada.'}</p>
 <div class="row" style="margin-top:10px"><button class="btn" data-escopo-backup title="Baixa um arquivo JSON com todos os registros deste navegador. É a cópia usada para desfazer a preparação, se necessário.">1. Baixar backup antes de preparar</button><button class="btn primary" data-escopo-preparar${escopoBackupFeito?'':' disabled'} title="Calcula o escopo de cada nota, as projeções por projeto, o índice de chaves e o cliente dos pedidos de orçamento, e confere se os totais por cliente e projeto continuam iguais. Só grava o que mudou.">2. Preparar e conferir totais</button></div>
 <p class="hint" style="margin-top:8px">Para desfazer: em <em>Importação de backup</em>, restaure o arquivo baixado no passo 1.</p>${tab}`}
document.addEventListener('click',async e=>{if(e.target.closest('[data-escopo-backup]')){downloadBackup();escopoBackupFeito=true;renderEscopoPanel();return}
 const b=e.target.closest('[data-escopo-preparar]');if(!b)return;b.disabled=true;b.textContent='Preparando…';
 try{const n=await escopoRecalcular();escopoResultado={...escopoConferir(),n}}catch(err){escopoResultado=null;alert('Não foi possível preparar a base: '+err.message)}renderEscopoPanel()});
// ==== #JS-ESCOPO-PREPARO: END ====
