// ---------- Requisições e devoluções da obra (escritório) ----------
// ==== #JS-REQUISICOES: START ====
// O mestre pede material pela tela da obra (captura.html); o pedido chega aqui pendente. Três posições por material e obra
// (stockTree, js/paineis.js): ESTOQUE → REQUISITADO → CONSUMIDO.
//  - Atender: o escritório informa o que entregou. Gera movimentos REQUISICAO (+) por produto de fornecedor, em ordem de
//    entrada (FIFO), ao custo médio: sai do estoque e entra no requisitado. Ainda não é custo.
//  - O mestre confirma o uso (captura.html): baixa SAIDA com requisicaoId, gravada por ele. Sai do requisitado e vira consumido.
//  - Devolução: o mestre registra o que sobrou; aqui se confirma o recebimento. Gera REQUISICAO (−): sai do requisitado e volta
//    ao estoque, nos mesmos produtos e custos entregues.
// A requisição guarda o que foi entregue de cada produto (itens[i].partes[p]); o consumo (gravado pelo mestre) e o devolvido
// (gravado aqui) ficam em mapas com a chave 'i_p'. Requisição e movimentos vão à nuvem num só lote (regras: firestore.rules).
const Req={itens:new Map(),unsubs:[],ligada:false,chave:'',aba:'pendentes',obra:'',msg:'',abrir:''};
const reqParteChave=(i,p)=>i+'_'+p;
const reqLista=()=>[...Req.itens.values()].sort((a,b)=>String(b.criadoEm).localeCompare(String(a.criadoEm)));
// devolução pendente que já reserva uma parte (o mestre não pode usar nem devolver de novo)
function reqDevPendente(rid,i,p){let q=0;for(const d of Req.itens.values())if(d.tipo==='devolucao'&&d.status==='pendente')(d.itens||[]).forEach(it=>(it.partes||[]).forEach(x=>{if(x.requisicaoId===rid&&x.i===i&&x.p===p)q+=Number(x.qtd)||0}));return q}
// o que ainda está com a obra de uma parte entregue: entregue − consumido − devolvido − devolução pendente
function reqEmMaos(r,i,p){const x=r.itens?.[i]?.partes?.[p];if(!x)return 0;const k=reqParteChave(i,p);return r4((Number(x.qtd)||0)-(Number(r.consumo?.[k])||0)-(Number(r.devolvido?.[k])||0)-reqDevPendente(r.id,i,p))}
function reqTotais(r,i){const it=r.itens?.[i]||{};let ent=0,con=0,dev=0,mao=0;(it.partes||[]).forEach((x,p)=>{const k=reqParteChave(i,p);ent+=Number(x.qtd)||0;con+=Number(r.consumo?.[k])||0;dev+=Number(r.devolvido?.[k])||0;mao+=reqEmMaos(r,i,p)});return {ent:r4(ent),con:r4(con),dev:r4(dev),mao:r4(mao)}}
// destino informado pelo mestre em cada item do pedido (onde o material vai ser usado); pedidos antigos não têm
const reqDestino=it=>it.destino?`<span class="pill blue">${esc(it.destino)}</span>`:'<span class="muted">—</span>';
const REQ_SIT={pendente:['Aguardando','warn'],atendida:['Atendida',''],recusada:['Recusada','gray'],cancelada:['Cancelada pela obra','gray'],recebida:['Recebida','']};

// ---------- Escuta (mesmos filtros de acesso da fila de notas da obra) ----------
function reqVisivel(){return filaVisivel()}
function reqLigar(){const filtros=filaFiltros();const chave=JSON.stringify(filtros);if(Req.ligada&&chave===Req.chave)return;reqDesligar();Req.ligada=true;Req.chave=chave;
 filtros.forEach(f=>Req.unsubs.push(window.__fb.listen('requisicoes',f,ch=>{ch.forEach(c=>c.type==='removed'?Req.itens.delete(c.id):Req.itens.set(c.id,{...c.data,id:c.id,_pendente:c.pending}));reqRender();renderSubnav($('.view.active')?.id)},e=>console.error('Requisições:',e))))}
function reqDesligar(){Req.unsubs.forEach(u=>{try{u()}catch(e){}});Req.unsubs=[];Req.ligada=false;Req.chave='';Req.itens=new Map()}
function reqSincronizar(){if(window.__fb&&reqVisivel())reqLigar();else if(Req.ligada)reqDesligar();reqRender()}
function reqContagem(){const l=reqLista().filter(r=>r.status==='pendente');return {req:l.filter(r=>r.tipo==='requisicao').length,dev:l.filter(r=>r.tipo==='devolucao').length,total:l.length}}

// ---------- Atender: estoque → requisitado ----------
// linhas (produtos) do material no projeto, com estoque disponível, da entrada mais antiga para a mais nova
function reqLinhasFifo(mid,pid){const {linhas}=saldoMaterialProjeto(mid,pid);const prim=l=>{let d='9999';state.allocations.forEach(a=>{if(a.projectId===pid&&a.productId===l.productId){const inv=state.invoices.find(i=>i.id===a.invoiceId);const x=String(inv?.date||'9999');if(x<d)d=x}});return d};
 return linhas.filter(l=>l.disp>1e-9).sort((a,b)=>prim(a).localeCompare(prim(b)))}
const reqDispMaterial=(mid,pid)=>r4(reqLinhasFifo(mid,pid).reduce((s,l)=>s+l.disp,0));
function reqAgora(){return {em:new Date().toISOString(),email:Nuvem.user?.email||'',nome:Nuvem.perfil?.nome||Nuvem.user?.nome||''}}
function reqMov(m,quem){return {...m,date:quem.em.slice(0,10),createdAt:quem.em,criadoPor:quem.email,criadoPorNome:quem.nome,_atualizadoEm:quem.em,_atualizadoPor:quem.email}}
async function reqGravar(ops,movs){await window.__fb.commit(ops);if(movs.length)await txWrite('movements',os=>movs.forEach(m=>os.movements.put(m)),{local:true});await refresh()}
async function reqAtender(r,entregas,obs){if(!nuvemConectada())throw new Error('Sem conexão com a nuvem: atenda quando a internet voltar.');if(!podeGravarProjeto(r.projectId))throw new Error('Você não tem escrita nesta obra.');
 const quem=reqAgora(),movs=[];const itens=r.itens.map((it,i)=>{const q=r4(Number(entregas[i])||0);if(q<0||q>Number(it.pedida)+1e-9)throw new Error(`${it.nome}: entregue de 0 até ${num(it.pedida)}.`);
  const mid=materialFinal(it.materialId)?.id;const partes=[];let falta=q;
  if(q>0){if(!mid)throw new Error(`${it.nome}: material não encontrado na tabela.`);const disp=reqDispMaterial(mid,r.projectId);if(q>disp+1e-9)throw new Error(`${it.nome}: só há ${num(disp)} ${it.unidade} no estoque da obra.`);
   for(const l of reqLinhasFifo(mid,r.projectId)){if(falta<=1e-9)break;const t=r4(Math.min(falta,l.disp));falta=r4(falta-t);const p=partes.length;
    partes.push({productId:l.productId,qtd:t,unitCost:Math.round(l.custo*1e6)/1e6});
    movs.push(reqMov({id:`req-${r.id}-${i}-${p}`,type:'REQUISICAO',requisicaoId:r.id,productId:l.productId,projectId:r.projectId,clientId:r.clientId,quantity:t,unitCost:Math.round(l.custo*1e6)/1e6,note:`Entregue à obra · ${r.codigo} · ${r.autorNome||r.autor}`,description:l.produto?.name||it.nome},quem))}}
  return {...it,atendida:q,partes}});
 if(!itens.some(it=>it.atendida>0))throw new Error('Nada a entregar. Para não atender, use Recusar.');
 const ops=movs.map(m=>({op:'set',store:'movements',id:m.id,data:m}));
 ops.push({op:'update',store:'requisicoes',id:r.id,data:{status:'atendida',itens,atendidoPor:quem.email,atendidoPorNome:quem.nome,atendidoEm:quem.em,obsAtendimento:obs||'',_atualizadoEm:quem.em,_atualizadoPor:quem.email}});
 await reqGravar(ops,movs)}
async function reqRecusar(r,motivo){if(!nuvemConectada())throw new Error('Sem conexão com a nuvem.');if(String(motivo||'').trim().length<3)throw new Error('Informe o motivo da recusa.');const quem=reqAgora();
 await reqGravar([{op:'update',store:'requisicoes',id:r.id,data:{status:'recusada',motivoRecusa:motivo.trim(),atendidoPor:quem.email,atendidoPorNome:quem.nome,atendidoEm:quem.em,_atualizadoEm:quem.em,_atualizadoPor:quem.email}}],[])}

// ---------- Confirmar devolução: requisitado → estoque ----------
async function reqReceberDevolucao(d,recebidas){if(!nuvemConectada())throw new Error('Sem conexão com a nuvem: confirme quando a internet voltar.');if(!podeGravarProjeto(d.projectId))throw new Error('Você não tem escrita nesta obra.');
 const quem=reqAgora(),movs=[],devolvido=new Map();// requisicaoId → {chave: quantidade}
 const itens=d.itens.map((it,i)=>{const q=r4(Number(recebidas[i])||0);if(q<0||q>Number(it.pedida)+1e-9)throw new Error(`${it.nome}: recebido de 0 até ${num(it.pedida)}.`);let falta=q;const usadas=[];
  (it.partes||[]).forEach((x,n)=>{if(falta<=1e-9)return;const o=Req.itens.get(x.requisicaoId);if(!o)throw new Error(`${it.nome}: a requisição de origem não está visível para você.`);
   const k=reqParteChave(x.i,x.p),ja=devolvido.get(o.id)||{...(o.devolvido||{})};
   // a própria devolução está pendente e reserva a parte: a conta do que ainda pode voltar a desconsidera
   const pode=r4((Number(o.itens?.[x.i]?.partes?.[x.p]?.qtd)||0)-(Number(o.consumo?.[k])||0)-(Number(ja[k])||0));const t=r4(Math.min(falta,Number(x.qtd)||0,pode));if(t<=1e-9)return;
   falta=r4(falta-t);ja[k]=r4((Number(ja[k])||0)+t);devolvido.set(o.id,ja);usadas.push({...x,recebida:t});
   const parte=o.itens[x.i].partes[x.p];movs.push(reqMov({id:`dev-${d.id}-${i}-${n}`,type:'REQUISICAO',requisicaoId:o.id,devolucaoId:d.id,productId:parte.productId,projectId:d.projectId,clientId:d.clientId,quantity:-t,unitCost:Number(parte.unitCost)||0,note:`Devolvido ao estoque · ${d.codigo} (de ${o.codigo}) · ${d.autorNome||d.autor}`,description:state.products.find(p=>p.id===parte.productId)?.name||it.nome},quem))});
  if(falta>1e-9)throw new Error(`${it.nome}: a obra só tem ${num(q-falta)} ${it.unidade} para devolver (o resto já foi usado ou devolvido).`);
  return {...it,recebida:q,partes:it.partes}});
 const ops=movs.map(m=>({op:'set',store:'movements',id:m.id,data:m}));
 for(const [rid,mapa] of devolvido)ops.push({op:'update',store:'requisicoes',id:rid,data:{devolvido:mapa,_atualizadoEm:quem.em,_atualizadoPor:quem.email}});
 ops.push({op:'update',store:'requisicoes',id:d.id,data:{status:'recebida',itens,atendidoPor:quem.email,atendidoPorNome:quem.nome,atendidoEm:quem.em,_atualizadoEm:quem.em,_atualizadoPor:quem.email}});
 await reqGravar(ops,movs)}

// ---------- Tela: Estoque › Requisições da obra ----------
function reqCartao(r){const pode=podeGravarProjeto(r.projectId),pend=r.status==='pendente',dev=r.tipo==='devolucao',[sit,cls]=REQ_SIT[r.status]||[r.status,'gray'];
 const cab=`<div class="row"><span class="pill ${dev?'serv':''}">${dev?'Devolução':'Requisição'}</span><strong>${esc(r.codigo||r.id)}</strong><span class="pill ${cls}">${sit}</span><span class="muted">${esc(projectLabel(projectById(r.projectId))||r.projetoNome||'')}</span><span class="muted right">${esc(r.autorNome||r.autor)} · ${fmtData(r.criadoEm)}</span></div>${r.obs?`<p class="hint">Obs. da obra: ${esc(r.obs)}</p>`:''}`;
 let corpo;
 if(pend&&!dev)corpo=`<table class="no-sort"><thead><tr><th>Material</th><th title="Onde o mestre vai usar o material">Destino</th><th class="num">Pedido</th><th class="num" title="Disponível no estoque desta obra (sem o que já está requisitado)">Estoque da obra</th><th class="num">Entregar</th></tr></thead><tbody>${r.itens.map((it,i)=>{const mid=materialFinal(it.materialId)?.id,disp=mid?reqDispMaterial(mid,r.projectId):0,sug=r4(Math.min(Number(it.pedida),disp));
  return `<tr><td>${esc(it.nome)}</td><td>${reqDestino(it)}</td><td class="num">${num(it.pedida)} ${esc(it.unidade)}</td><td class="num ${disp+1e-9<it.pedida?'erro-txt':''}">${num(disp)} ${esc(it.unidade)}</td><td class="num"><input type="number" min="0" step="any" max="${Math.min(Number(it.pedida),disp)}" value="${sug}" data-req-q="${i}" style="width:100px"${pode?'':' disabled'}></td></tr>`}).join('')}</tbody></table>`;
 else if(pend&&dev)corpo=`<table class="no-sort"><thead><tr><th>Material</th><th class="num">Devolvido pela obra</th><th class="num">Recebido no estoque</th></tr></thead><tbody>${r.itens.map((it,i)=>`<tr><td>${esc(it.nome)}<div class="hint">${esc([...new Set((it.partes||[]).map(x=>Req.itens.get(x.requisicaoId)?.codigo).filter(Boolean))].join(', '))}</div></td><td class="num">${num(it.pedida)} ${esc(it.unidade)}</td><td class="num"><input type="number" min="0" step="any" max="${it.pedida}" value="${it.pedida}" data-req-q="${i}" style="width:100px"${pode?'':' disabled'}></td></tr>`).join('')}</tbody></table>`;
 else if(dev)corpo=`<table class="no-sort"><thead><tr><th>Material</th><th class="num">Devolvido</th><th class="num">Recebido</th></tr></thead><tbody>${r.itens.map(it=>`<tr><td>${esc(it.nome)}</td><td class="num">${num(it.pedida)} ${esc(it.unidade)}</td><td class="num">${it.recebida!=null?num(it.recebida):'—'}</td></tr>`).join('')}</tbody></table>`;
 else corpo=`<table class="no-sort"><thead><tr><th>Material</th><th title="Onde o mestre vai usar o material">Destino</th><th class="num">Pedido</th><th class="num">Entregue</th><th class="num" title="Confirmado como usado pelo mestre">Consumido</th><th class="num">Devolvido</th><th class="num" title="Entregue e ainda não usado nem devolvido">Com a obra</th></tr></thead><tbody>${r.itens.map((it,i)=>{const t=reqTotais(r,i);return `<tr><td>${esc(it.nome)}</td><td>${reqDestino(it)}</td><td class="num">${num(it.pedida)} ${esc(it.unidade)}</td><td class="num">${r.status==='atendida'?num(t.ent):'—'}</td><td class="num">${r.status==='atendida'?num(t.con):'—'}</td><td class="num">${r.status==='atendida'?num(t.dev):'—'}</td><td class="num">${r.status==='atendida'?`<strong class="pos-req">${num(t.mao)}</strong>`:'—'}</td></tr>`}).join('')}</tbody></table>`;
 const pe=r.atendidoPor?`<p class="hint">${r.status==='recusada'?'Recusada':r.status==='recebida'?'Recebida':'Atendida'} por ${esc(r.atendidoPorNome||r.atendidoPor)} em ${fmtData(r.atendidoEm)}${r.motivoRecusa?'. Motivo: '+esc(r.motivoRecusa):''}${r.obsAtendimento?'. '+esc(r.obsAtendimento):''}</p>`:r.status==='cancelada'?`<p class="hint">Cancelada pela obra${r.canceladoEm?' em '+fmtData(r.canceladoEm):''}.</p>`:'';
 const acoes=pend&&pode?`<div class="row" style="margin-top:8px;align-items:flex-end">${dev?'':'<div class="field"><label>Observação (opcional)</label><input data-req-obs placeholder="Ex.: entregue ao encarregado; o restante chega amanhã"></div>'}<button class="btn primary" data-req-ok="${esc(r.id)}" title="${dev?'Confirma que o material voltou: sai do requisitado e volta ao estoque da obra':'Entrega o material: sai do estoque e entra no requisitado da obra. Vira custo só quando o mestre confirmar o uso'}">${dev?'Confirmar recebimento':'Atender'}</button><button class="btn" data-req-recusar="${esc(r.id)}">Recusar</button></div>`:pend?'<p class="hint">Você não tem escrita nesta obra para atender.</p>':'';
 return `<div class="panel req-cartao" data-req-cartao="${esc(r.id)}" style="margin-bottom:12px">${cab}<div class="tablewrap">${corpo}</div>${pe}${acoes}<div data-req-msg></div></div>`}
function reqComObra(){// requisitado por obra e material, com a requisição de origem
 const g=new Map();for(const r of reqLista()){if(r.tipo!=='requisicao'||r.status!=='atendida'||(Req.obra&&r.projectId!==Req.obra))continue;(r.itens||[]).forEach((it,i)=>{const t=reqTotais(r,i);if(t.mao<=1e-9)return;const k=r.projectId+'|'+(materialFinal(it.materialId)?.id||it.nome);
  if(!g.has(k))g.set(k,{pid:r.projectId,nome:materialFinal(it.materialId)?.nome||it.nome,un:it.unidade,mao:0,reqs:[]});const x=g.get(k);x.mao=r4(x.mao+t.mao);x.reqs.push(`${r.codigo} (${num(t.mao)}, ${r.autorNome||r.autor})`)})}
 return [...g.values()].sort((a,b)=>projectLabel(projectById(a.pid)).localeCompare(projectLabel(projectById(b.pid)),'pt-BR')||a.nome.localeCompare(b.nome,'pt-BR'))}
function reqRender(){const root=$('#requisicoesBody');if(!root)return;
 if(!reqVisivel()){root.innerHTML='<p class="muted">Entre com uma conta com escrita em alguma obra para ver as requisições.</p>';return}
 const c=reqContagem(),todas=reqLista().filter(r=>!Req.obra||r.projectId===Req.obra);
 const abas=[['pendentes',`Pendentes${c.total?` <span class="count alert">${c.total}</span>`:''}`],['obra','Com a obra (requisitado)'],['historico','Histórico']];
 const obras=[...new Set(reqLista().map(r=>r.projectId))].map(projectById).filter(Boolean);
 let corpo;
 if(Req.aba==='pendentes'){const l=todas.filter(r=>r.status==='pendente');corpo=l.length?l.map(reqCartao).join(''):'<p class="muted">Nenhum pedido aguardando. Os pedidos e as devoluções da obra aparecem aqui assim que o mestre envia.</p>'}
 else if(Req.aba==='obra'){const l=reqComObra();corpo=l.length?`<div class="panel"><div class="tablewrap"><table class="no-sort"><thead><tr><th>Obra</th><th>Material</th><th class="num">Com a obra</th><th>Requisições</th></tr></thead><tbody>${l.map(x=>`<tr><td>${esc(projectLabel(projectById(x.pid)))}</td><td><strong>${esc(x.nome)}</strong></td><td class="num"><strong class="pos-req">${num(x.mao)} ${esc(x.un)}</strong></td><td class="hint">${esc(x.reqs.join(' · '))}</td></tr>`).join('')}</tbody></table></div><p class="hint">Material entregue que o mestre ainda não confirmou como usado nem devolveu. Continua sob custódia: vira custo da obra só quando o mestre confirmar o uso.</p></div>`:'<p class="muted">Nenhum material requisitado com a obra.</p>'}
 else{const l=todas.filter(r=>r.status!=='pendente');corpo=l.length?l.map(reqCartao).join(''):'<p class="muted">Nenhuma requisição concluída.</p>'}
 root.innerHTML=`${Req.msg}<div class="row" style="margin-bottom:12px"><div class="tabs" style="margin:0">${abas.map(([k,r])=>`<button data-req-aba="${k}" class="${Req.aba===k?'active':''}">${r}</button>`).join('')}</div><select data-req-obra title="Mostra só uma obra"><option value="">Todas as obras</option>${obras.map(p=>`<option value="${esc(p.id)}"${p.id===Req.obra?' selected':''}>${esc(projectLabel(p))}</option>`).join('')}</select><button class="btn sm right" id="reqCsv" title="Baixa as requisições e devoluções do filtro, item a item">Exportar CSV</button></div>${corpo}`}
function reqMsg(h,t){Req.msg=h?`<div class="notice ${t||''}">${h}</div>`:'';reqRender()}
document.addEventListener('click',async e=>{const a=e.target.closest('[data-req-aba]');if(a){Req.aba=a.dataset.reqAba;Req.msg='';reqRender();return}
 if(e.target.closest('#reqCsv')){const rows=[['Código','Tipo','Situação','Obra','Mestre','Pedido em','Material','Destino','Unidade','Pedido','Entregue/recebido','Consumido','Devolvido','Com a obra','Atendido por','Atendido em','Motivo da recusa']];
  reqLista().filter(r=>!Req.obra||r.projectId===Req.obra).forEach(r=>(r.itens||[]).forEach((it,i)=>{const t=r.tipo==='requisicao'&&r.status==='atendida'?reqTotais(r,i):null,f=n=>n==null?'':String(n).replace('.',',');
   rows.push([r.codigo,r.tipo==='devolucao'?'Devolução':'Requisição',(REQ_SIT[r.status]||[r.status])[0],projectLabel(projectById(r.projectId))||r.projetoNome,r.autorNome||r.autor,r.criadoEm?fmtData(r.criadoEm):'',it.nome,it.destino||'',it.unidade,f(it.pedida),f(r.tipo==='devolucao'?it.recebida:it.atendida),f(t?.con),f(t?.dev),f(t?.mao),r.atendidoPorNome||r.atendidoPor||'',r.atendidoEm?fmtData(r.atendidoEm):'',r.motivoRecusa||''])}));
  csvDownload('requisicoes-da-obra.csv',rows);return}
 const ok=e.target.closest('[data-req-ok]'),rc=e.target.closest('[data-req-recusar]');if(!ok&&!rc)return;
 const card=(ok||rc).closest('[data-req-cartao]'),r=Req.itens.get(card.dataset.reqCartao),box=card.querySelector('[data-req-msg]');if(!r)return;
 const b=ok||rc;b.disabled=true;
 try{if(rc){const motivo=prompt(`Recusar ${r.tipo==='devolucao'?'a devolução':'o pedido'} ${r.codigo}? Escreva o motivo (o mestre vê no celular):`,'');if(motivo===null){b.disabled=false;return}await reqRecusar(r,motivo);reqMsg(`${esc(r.codigo)} recusado.`,'success');return}
  const qs=[...card.querySelectorAll('[data-req-q]')].map(x=>Number(String(x.value).replace(',','.')));
  if(r.tipo==='devolucao'){await reqReceberDevolucao(r,qs);reqMsg(`Devolução ${esc(r.codigo)} recebida: o material voltou ao estoque da obra.`,'success')}
  else{await reqAtender(r,qs,card.querySelector('[data-req-obs]')?.value.trim());reqMsg(`${esc(r.codigo)} atendido: o material está no requisitado da obra até o mestre confirmar o uso.`,'success')}}
 catch(err){b.disabled=false;box.innerHTML=`<div class="notice danger">${esc(err.message)}</div>`}});
document.addEventListener('change',e=>{const s=e.target.closest?.('[data-req-obra]');if(s){Req.obra=s.value;reqRender()}});
// ==== #JS-REQUISICOES: END ====
