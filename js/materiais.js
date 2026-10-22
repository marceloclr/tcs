// ---------- Materiais padronizados (tabela do estoque) ----------
// ==== #JS-MATERIAIS: START ====
// Cada fornecedor descreve o mesmo material de um jeito ("CIMENTO CP II 50KG", "CIM CPII-32 SC 50"). A tabela de materiais
// (coleção materiais: nome, unidade, categoria) dá o nome do sistema, e cada produto de fornecedor (products) aponta para um
// material em products.materialId. Esse é o de-para: vinculado uma vez, vale para as próximas notas do mesmo produto.
// O estoque continua por projeto × produto (allocations e movements não mudam); o saldo por material soma os produtos dele.
// Unidade: sempre 1 para 1. Se a unidade do produto for diferente da do material, o sistema só avisa.
const Mat={busca:'',editar:'',juntar:'',abrir:'',msg:'',vbusca:'',vmsg:'',sel:new Set()};
const materialById=id=>state.materiais.find(m=>m.id===id);
// material juntado a outro (Juntar materiais) aponta para o destino em juntadoEm
function materialFinal(id){let m=materialById(id);for(let i=0;m&&m.juntadoEm&&i<10;i++)m=materialById(m.juntadoEm)||m;return m||null}
const materialDoProduto=p=>p?.materialId?materialFinal(p.materialId):null;
const produtosDoMaterial=mid=>state.products.filter(p=>materialDoProduto(p)?.id===mid);
const materiaisAtivos=()=>state.materiais.filter(m=>m.ativo!==false&&!m.juntadoEm).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));
const unidadeIgual=(a,b)=>norm(a||'UN')===norm(b||'UN');
// produtos que vieram de notas de materiais (ou digitados no catálogo); produto só de nota de serviço não entra
function produtosDeMaterial(){const usados=new Set();state.invoices.filter(i=>!isServico(i)).forEach(i=>(i.items||[]).forEach(it=>it.productId&&usados.add(it.productId)));state.allocations.forEach(a=>a.productId&&usados.add(a.productId));
 return state.products.filter(p=>usados.has(p.id)||p.origin==='manual')}
const produtosSemMaterial=()=>produtosDeMaterial().filter(p=>!materialDoProduto(p));
// fornecedores de cada produto, pelas notas
function fornecedoresDoProduto(pid){const s=new Set();state.invoices.forEach(i=>(i.items||[]).some(it=>it.productId===pid)&&s.add(i.issuer||'Emitente não identificado'));return [...s]}

// ---------- Sugestão de material para um produto ----------
// Semelhança de palavras (Jaccard) entre a descrição do produto e o nome do material ou as descrições já vinculadas a ele.
const MAT_VAZIAS=new Set(['de','da','do','das','dos','com','para','p','c','e','em','a','o','x','tipo','ref','cod']);
// palavras: número separado da unidade ("50KG" → 50 kg); sem as vazias
function matPalavras(s){return norm(s).replace(/(\d)([a-z])/g,'$1 $2').replace(/([a-z])(\d)/g,'$1 $2').split(' ').filter(w=>w&&!MAT_VAZIAS.has(w)&&(w.length>1||/\d/.test(w)))}
// a palavra A[i] casa com a lista B se: é igual; é abreviação (CIM → CIMENTO, de 3 letras para cima, sem números); ou está
// colada de um lado e separada do outro (CPII × CP II, nos dois sentidos)
function matCasa(A,i,B){const w=A[i];if(B.includes(w))return true;
 if(!/\d/.test(w)&&B.some(x=>!/\d/.test(x)&&Math.min(x.length,w.length)>=3&&(x.startsWith(w)||w.startsWith(x))))return true;
 for(let k=0;k<B.length-1;k++)if(B[k]+B[k+1]===w)return true;
 return (i+1<A.length&&B.includes(w+A[i+1]))||(i>0&&B.includes(A[i-1]+w))}
// semelhança (Dice): palavras de A que casam em B + palavras de B que casam em A, sobre o total. Números diferentes dos dois
// lados (50 kg × 40 kg, CP II × CP V 32) cortam a nota pela metade: costumam ser outro material.
function matSemelhanca(a,b){const A=matPalavras(a),B=matPalavras(b);if(!A.length||!B.length)return 0;
 const s=(A.filter((w,i)=>matCasa(A,i,B)).length+B.filter((w,i)=>matCasa(B,i,A)).length)/(A.length+B.length);
 const nA=A.filter(w=>/^\d+$/.test(w)),nB=B.filter(w=>/^\d+$/.test(w));return nA.length&&nB.length&&!nA.some(n=>nB.includes(n))?s/2:s}
function sugestoesMaterial(desc,n=3){const r=[];for(const m of materiaisAtivos()){let s=matSemelhanca(desc,m.nome);for(const p of produtosDoMaterial(m.id))s=Math.max(s,matSemelhanca(desc,p.name)*0.95);if(s>=0.15)r.push({m,s})}
 return r.sort((a,b)=>b.s-a.s).slice(0,n)}
function materialOpcoes(selId,desc){const sug=desc?sugestoesMaterial(desc):[];const ids=new Set(sug.map(x=>x.m.id));
 const op=(m,rot)=>`<option value="${esc(m.id)}"${m.id===selId?' selected':''}>${esc(rot||m.nome)} (${esc(m.unidade||'UN')})</option>`;
 return `<option value="">— escolher material —</option>${sug.length?`<optgroup label="Sugestões">${sug.map(x=>op(x.m,`${x.m.nome} · ${Math.round(x.s*100)}%`)).join('')}</optgroup>`:''}<optgroup label="Todos os materiais">${materiaisAtivos().filter(m=>!ids.has(m.id)).map(m=>op(m)).join('')}</optgroup>`}

// ---------- Saldo por material (sobre as linhas de stockTree) ----------
// Agrupa as linhas projeto × produto de um projeto por material; produto sem material fica numa linha própria, marcada.
function agruparPorMaterial(itens){const g=new Map();
 for(const l of itens){const m=materialDoProduto(l.produto);const k=m?m.id:'sem:'+l.productId;
  if(!g.has(k))g.set(k,{materialId:m?.id||'',mat:m,nome:m?m.nome:l.nome,unidade:m?m.unidade:(l.produto?.unit||'UN'),semMaterial:!m,linhas:[],entrada:0,saida:0,pago:0,estoque:0});
  const x=g.get(k);x.linhas.push(l);x.entrada+=l.entrada;x.saida+=l.saida;x.pago+=l.pago;x.estoque+=l.estoque}
 return [...g.values()].map(x=>({...x,saldo:r4(x.entrada-x.saida),custo:x.entrada>0?x.pago/x.entrada:0})).sort((a,b)=>(a.semMaterial-b.semMaterial)||a.nome.localeCompare(b.nome,'pt-BR'))}
// saldo de um material num projeto e as linhas (produtos) que o compõem
function saldoMaterialProjeto(mid,pid){const proj=stockTree().clientes.flatMap(c=>c.projetos).find(x=>x.p.id===pid);const linhas=(proj?.itens||[]).filter(l=>materialDoProduto(l.produto)?.id===mid);
 return {saldo:r4(linhas.reduce((s,l)=>s+l.saldo,0)),linhas}}
// saldo de um material em todas as obras: [{p, saldo, estoque}]
function saldoMaterialObras(mid){return stockTree().clientes.flatMap(c=>c.projetos).map(x=>{const ls=x.itens.filter(l=>materialDoProduto(l.produto)?.id===mid);return {p:x.p,saldo:r4(ls.reduce((s,l)=>s+l.saldo,0)),estoque:ls.reduce((s,l)=>s+l.estoque,0),tem:ls.length>0}}).filter(x=>x.tem)}

// ---------- Gravação ----------
async function materialSalvar(dados,id){const nome=String(dados.nome||'').trim().replace(/\s+/g,' '),unidade=String(dados.unidade||'').trim().toUpperCase()||'UN',categoria=String(dados.categoria||'').trim();
 if(nome.length<2)throw new Error('Informe o nome do material.');
 if(state.materiais.some(m=>m.id!==id&&!m.juntadoEm&&norm(m.nome)===norm(nome)&&unidadeIgual(m.unidade,unidade)))throw new Error('Já existe um material com esse nome e essa unidade.');
 const atual=id&&materialById(id);
 const m=atual?{...atual,nome,unidade,categoria}:{id:uid(),nome,unidade,categoria,ativo:true,criadoEm:new Date().toISOString(),criadoPor:Nuvem.user?.email||'',criadoPorNome:Nuvem.perfil?.nome||Nuvem.user?.nome||''};
 await put('materiais',m);return m}
// vincula produtos de fornecedor a um material (mid vazio desfaz o vínculo)
async function materialVincular(prodIds,mid){const ps=prodIds.map(id=>state.products.find(p=>p.id===id)).filter(Boolean);if(!ps.length)return;
 await txWrite('products',os=>ps.forEach(p=>{const n={...p};if(mid)n.materialId=mid;else delete n.materialId;os.products.put(n)}))}
// Juntar: os produtos de A passam para B, e A fica desativado apontando para B (requisições antigas de A continuam valendo)
async function materialJuntar(aId,bId){const a=materialById(aId),b=materialById(bId);if(!a||!b||a.id===b.id)throw new Error('Escolha outro material para juntar.');
 await txWrite(['materiais','products'],os=>{produtosDoMaterial(a.id).forEach(p=>os.products.put({...p,materialId:b.id}));os.materiais.put({...a,ativo:false,juntadoEm:b.id,juntadoEmData:new Date().toISOString()})})}

// ---------- Tela: Estoque › Materiais ----------
function renderMateriais(){const root=$('#materiaisBody');if(!root)return;const pode=podeEscrever();const q=norm(Mat.busca);
 const lista=state.materiais.filter(m=>!m.juntadoEm).sort((a,b)=>(a.ativo===false)-(b.ativo===false)||String(a.nome).localeCompare(String(b.nome),'pt-BR')).filter(m=>!q||norm([m.nome,m.unidade,m.categoria,...produtosDoMaterial(m.id).map(p=>p.name)].join(' ')).includes(q));
 const pend=produtosSemMaterial().length;const foco=document.activeElement?.matches?.('[data-mat="busca"]')?document.activeElement.selectionStart:null;
 const linha=m=>{const ps=produtosDoMaterial(m.id),obras=saldoMaterialObras(m.id),saldo=obras.reduce((s,x)=>s+x.saldo,0),valor=obras.reduce((s,x)=>s+x.estoque,0),aberto=Mat.abrir===m.id;
  const difUn=ps.filter(p=>!unidadeIgual(p.unit,m.unidade));
  const edit=Mat.editar===m.id?`<tr class="saida-form"><td colspan="7"><div class="row" style="align-items:flex-end" data-mat-form="${esc(m.id)}"><div class="field"><label>Nome</label><input data-mf="nome" value="${esc(m.nome)}"></div><div class="field" style="max-width:120px"><label>Unidade</label><input data-mf="unidade" value="${esc(m.unidade)}"></div><div class="field" style="max-width:220px"><label>Categoria</label><input data-mf="categoria" value="${esc(m.categoria||'')}" list="matCategorias"></div><button class="btn primary" data-mat-salvar="${esc(m.id)}" title="Grava o nome, a unidade e a categoria do material">Salvar</button><button class="btn" data-mat-cancelar>Cancelar</button></div></td></tr>`:'';
  const juntar=Mat.juntar===m.id?`<tr class="saida-form"><td colspan="7"><div class="row" style="align-items:flex-end"><div class="field"><label>Juntar "${esc(m.nome)}" em</label><select data-mat-destino><option value="">— escolha o material que fica —</option>${materiaisAtivos().filter(x=>x.id!==m.id).map(x=>`<option value="${esc(x.id)}">${esc(x.nome)} (${esc(x.unidade)})</option>`).join('')}</select></div><button class="btn primary" data-mat-juntar-ok="${esc(m.id)}" title="Os produtos de fornecedor deste material passam para o escolhido, e este fica desativado">Juntar</button><button class="btn" data-mat-cancelar>Cancelar</button></div><p class="hint">Use quando o mesmo material foi cadastrado duas vezes. O saldo das obras passa a somar no material que fica.</p></td></tr>`:'';
  const det=aberto?`<tr class="lv-product"><td colspan="7"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin:0"><div><strong>Produtos de fornecedor vinculados</strong>${ps.length?`<ul class="mat-lista">${ps.map(p=>`<li>${esc(p.name)} <span class="hint">${esc(p.unit||'UN')}${p.barcode?' · EAN '+esc(p.barcode):''} · ${esc(fornecedoresDoProduto(p.id).join(', ')||'sem nota')}</span>${unidadeIgual(p.unit,m.unidade)?'':' <span class="pill warn" title="Unidade da nota diferente da do material: a quantidade entra 1 para 1">unidade '+esc(p.unit||'UN')+'</span>'}${pode?` <button class="btn sm" data-mat-desvincular="${esc(p.id)}" title="Tira este produto do material; ele volta para Vincular itens">Desvincular</button>`:''}</li>`).join('')}</ul>`:'<p class="muted">Nenhum produto vinculado ainda.</p>'}</div><div><strong>Saldo por obra</strong>${obras.length?`<ul class="mat-lista">${obras.map(x=>`<li>${esc(projectLabel(x.p))}: <strong>${num(x.saldo)} ${esc(m.unidade)}</strong> <span class="hint">${money(x.estoque)}</span></li>`).join('')}</ul>`:'<p class="muted">Nenhuma obra com este material.</p>'}</div></div></td></tr>`:'';
  return `<tr class="${m.ativo===false?'bx-estornada':''}"><td><button class="link-btn" data-mat-abrir="${esc(m.id)}" title="Mostra os produtos de fornecedor vinculados e o saldo por obra">${aberto?'▾':'▸'} <strong>${esc(m.nome)}</strong></button>${m.categoria?`<div class="hint">${esc(m.categoria)}</div>`:''}</td><td>${esc(m.unidade)}</td><td class="num">${ps.length}${difUn.length?` <span class="pill warn" title="${difUn.length} produto(s) com unidade diferente">!</span>`:''}</td><td class="num">${num(saldo)}</td><td class="num">${money(valor)}</td><td>${m.ativo===false?'<span class="pill gray">Desativado</span>':'<span class="pill">Ativo</span>'}</td><td style="white-space:nowrap">${pode?`<button class="btn sm" data-mat-editar="${esc(m.id)}">Editar</button> <button class="btn sm" data-mat-juntar="${esc(m.id)}" title="Junta este material a outro, se for o mesmo cadastrado duas vezes">Juntar</button> <button class="btn sm" data-mat-ativo="${esc(m.id)}" title="${m.ativo===false?'Volta a aparecer para o mestre e nos vínculos':'Some da lista do mestre e dos vínculos; o histórico continua'}">${m.ativo===false?'Ativar':'Desativar'}</button>`:''}</td></tr>${edit}${juntar}${det}`};
 const cats=[...new Set(state.materiais.map(m=>m.categoria).filter(Boolean))].sort();
 root.innerHTML=`${pode?`<div class="panel" style="margin-bottom:14px"><h3>Novo material</h3><div class="row" style="align-items:flex-end" data-mat-form=""><div class="field"><label>Nome padronizado</label><input data-mf="nome" placeholder="Ex.: Cimento CP II 50 kg"></div><div class="field" style="max-width:120px"><label>Unidade</label><input data-mf="unidade" placeholder="SC" title="Unidade em que o material é controlado e pedido pela obra (UN, SC, M, M2, M3, KG, L, PC, RL…)"></div><div class="field" style="max-width:220px"><label>Categoria (opcional)</label><input data-mf="categoria" list="matCategorias" placeholder="Ex.: Cimento e argamassa"></div><button class="btn primary" data-mat-salvar="" title="Inclui o material na tabela do estoque">Cadastrar material</button></div><datalist id="matCategorias">${cats.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div>`:''}
 ${Mat.msg}${pend?`<div class="notice">${pend} produto(s) de fornecedor ainda sem material. <button class="btn sm" data-go="vincular">Vincular itens</button></div>`:''}
 <div class="row" style="margin-bottom:12px"><input class="search" data-mat="busca" value="${esc(Mat.busca)}" placeholder="Buscar material, categoria ou produto de fornecedor…"><span class="muted right">${state.materiais.filter(m=>!m.juntadoEm&&m.ativo!==false).length} material(is) ativo(s)</span><button class="btn sm" id="materiaisCsv" title="Baixa a tabela de materiais com o saldo e os produtos vinculados">Exportar CSV</button></div>
 <div class="panel"><div class="tablewrap"><table class="no-sort"><thead><tr><th>Material</th><th>Unid.</th><th class="num" title="Produtos de fornecedor vinculados a este material">Produtos</th><th class="num" title="Soma dos saldos das obras">Saldo</th><th class="num" title="Saldo × custo médio de cada produto">Valor em estoque</th><th>Situação</th><th></th></tr></thead><tbody>${lista.map(linha).join('')||`<tr><td colspan="7" class="muted">${state.materiais.length?'Nenhum material na busca.':'Nenhum material cadastrado. Cadastre acima ou crie a partir dos itens em Vincular itens.'}</td></tr>`}</tbody></table></div></div>`;
 if(foco!=null){const i=root.querySelector('[data-mat="busca"]');i.focus();i.setSelectionRange(foco,foco)}}

// ---------- Tela: Estoque › Vincular itens ----------
function renderVincular(){const root=$('#vincularBody');if(!root)return;const pode=podeEscrever();const q=norm(Mat.vbusca);
 const todos=produtosSemMaterial().sort(byName),lista=todos.filter(p=>!q||norm([p.name,p.barcode,p.code,...fornecedoresDoProduto(p.id)].join(' ')).includes(q));
 Mat.sel=new Set([...Mat.sel].filter(id=>lista.some(p=>p.id===id)));const foco=document.activeElement?.matches?.('[data-vin="busca"]')?document.activeElement.selectionStart:null;
 root.innerHTML=`${Mat.vmsg}${!pode?'<div class="notice">Você pode ver os itens sem material, mas não tem permissão para vincular.</div>':''}
 <div class="row" style="margin-bottom:12px"><input class="search" data-vin="busca" value="${esc(Mat.vbusca)}" placeholder="Buscar descrição, EAN ou fornecedor…"><span class="muted right">${todos.length} produto(s) sem material</span></div>
 ${pode&&lista.length?`<div class="row" style="margin-bottom:12px;align-items:flex-end"><div class="field"><label>Vincular os marcados a</label><select data-vin-lote>${materialOpcoes('', '')}</select></div><button class="btn primary" data-vin-lote-ok title="Vincula todos os produtos marcados ao material escolhido">Vincular marcados (${Mat.sel.size})</button><button class="btn" data-vin-sugestoes title="Vincula cada produto marcado à primeira sugestão dele (de 50% para cima)">Aceitar as sugestões dos marcados</button></div>`:''}
 <div class="panel"><div class="tablewrap"><table class="no-sort"><thead><tr>${pode?'<th style="width:28px"><input type="checkbox" data-vin-todos title="Marca ou desmarca todos"></th>':''}<th>Produto do fornecedor</th><th>Unid.</th><th>Material da tabela</th><th></th></tr></thead><tbody>${lista.map(p=>{const sug=sugestoesMaterial(p.name,1)[0];
  return `<tr data-vin-linha="${esc(p.id)}">${pode?`<td><input type="checkbox" data-vin-sel="${esc(p.id)}"${Mat.sel.has(p.id)?' checked':''}></td>`:''}<td><strong>${esc(p.name)}</strong><div class="hint">${esc(fornecedoresDoProduto(p.id).join(', ')||'digitado no catálogo')}${p.barcode?' · EAN '+esc(p.barcode):''}${p.code?' · cód. '+esc(p.code):''}</div></td><td>${esc(p.unit||'UN')}</td><td>${pode?`<select data-vin-mat="${esc(p.id)}" style="min-width:240px">${materialOpcoes(sug&&sug.s>=0.5?sug.m.id:'',p.name)}</select><div class="hint" data-vin-un></div>`:sug?esc('Sugestão: '+sug.m.nome):'—'}</td><td style="white-space:nowrap">${pode?`<button class="btn sm primary" data-vin-ok="${esc(p.id)}" title="Vincula este produto ao material escolhido; as próximas notas dele já entram vinculadas">Vincular</button> <button class="btn sm" data-vin-novo="${esc(p.id)}" title="Cria um material com esta descrição (pode ajustar) e já vincula">Criar material</button>`:''}</td></tr>${Mat.criar===p.id?`<tr class="saida-form"><td colspan="5"><div class="row" style="align-items:flex-end" data-mat-form="" data-mat-vincular="${esc(p.id)}"><div class="field"><label>Nome padronizado</label><input data-mf="nome" value="${esc(matNomeSugerido(p.name))}"></div><div class="field" style="max-width:120px"><label>Unidade</label><input data-mf="unidade" value="${esc(p.unit||'UN')}"></div><div class="field" style="max-width:220px"><label>Categoria (opcional)</label><input data-mf="categoria"></div><button class="btn primary" data-mat-salvar="" title="Cria o material e vincula este produto">Criar e vincular</button><button class="btn" data-mat-cancelar>Cancelar</button></div></td></tr>`:''}`}).join('')||`<tr><td colspan="5" class="muted">${todos.length?'Nenhum produto na busca.':'Todos os produtos de fornecedor estão vinculados a um material.'}</td></tr>`}</tbody></table></div></div>`;
 root.querySelectorAll('[data-vin-mat]').forEach(vinUnidade);
 if(foco!=null){const i=root.querySelector('[data-vin="busca"]');i.focus();i.setSelectionRange(foco,foco)}}
// nome sugerido ao criar material a partir da descrição do fornecedor: só capitaliza
function matNomeSugerido(s){return String(s||'').toLowerCase().replace(/\s+/g,' ').trim().replace(/(^|\s)(\p{L})/gu,(a,b,c)=>b+c.toUpperCase())}
function vinUnidade(sel){const p=state.products.find(x=>x.id===sel.dataset.vinMat),m=materialById(sel.value),h=sel.parentElement.querySelector('[data-vin-un]');if(!h)return;h.innerHTML=p&&m&&!unidadeIgual(p.unit,m.unidade)?`<span class="erro-txt">Unidade diferente (${esc(p.unit||'UN')} × ${esc(m.unidade)}): a quantidade entra 1 para 1.</span>`:''}

// ---------- Conferência das notas: material de cada item ----------
// Mostrado abaixo de cada nota de materiais na conferência (renderPreview). A escolha fica em it._materialId e, no lançamento,
// grava o de-para no produto (postDraft). Item sem material pode ser lançado e aparece depois em Vincular itens.
function materialItemPadrao(it){if(it._materialId!==undefined)return it._materialId;const p=state.products.find(x=>x.key===productKey(it));return materialDoProduto(p)?.id||''}
function materialConfHtml(inv,ii,html){if(isServico(inv)||!inv.items?.length)return html;const sem=inv.items.filter(it=>!materialItemPadrao(it)).length;
 return html+`<div class="mat-conf"><div class="row"><strong>Material de cada item</strong><span class="hint">${sem?`${sem} item(ns) sem material: escolha agora ou depois em Estoque › Vincular itens.`:'Todos os itens vinculados a um material da tabela.'}</span></div><div class="tablewrap"><table class="no-sort"><thead><tr><th>Item da nota</th><th>Unid.</th><th>Material da tabela</th></tr></thead><tbody>${inv.items.map((it,j)=>{const mid=materialItemPadrao(it),m=materialById(mid);
  return `<tr><td>${esc(it.description)}</td><td>${esc(it.unit||'UN')}</td><td><select data-mat-item="${ii}|${j}" style="min-width:240px">${materialOpcoes(mid,it.description)}</select>${m&&!unidadeIgual(it.unit,m.unidade)?`<div class="hint erro-txt">Unidade diferente (${esc(it.unit||'UN')} × ${esc(m.unidade)}): confira a quantidade.</div>`:''}</td></tr>`}).join('')}</tbody></table></div></div>`}
document.addEventListener('change',e=>{const s=e.target.closest?.('[data-mat-item]');if(!s)return;const [ii,j]=s.dataset.matItem.split('|').map(Number);const it=draft[ii]?.items[j];if(!it)return;it._materialId=s.value;renderPreview()});

// ---------- Eventos ----------
function matMsg(h,t){Mat.msg=h?`<div class="notice ${t||''}">${h}</div>`:'';renderMateriais()}
function vinMsg(h,t){Mat.vmsg=h?`<div class="notice ${t||''}">${h}</div>`:'';renderVincular()}
document.addEventListener('input',e=>{const b=e.target.closest?.('[data-mat="busca"]');if(b){Mat.busca=b.value;renderMateriais();return}const v=e.target.closest?.('[data-vin="busca"]');if(v){Mat.vbusca=v.value;renderVincular()}});
document.addEventListener('change',e=>{const s=e.target.closest?.('[data-vin-mat]');if(s){vinUnidade(s);return}const c=e.target.closest?.('[data-vin-sel]');if(c){c.checked?Mat.sel.add(c.dataset.vinSel):Mat.sel.delete(c.dataset.vinSel);renderVincular();return}
 const t=e.target.closest?.('[data-vin-todos]');if(t){const ids=[...document.querySelectorAll('[data-vin-sel]')].map(x=>x.dataset.vinSel);Mat.sel=t.checked?new Set(ids):new Set();renderVincular()}});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-mat-salvar],[data-mat-cancelar],[data-mat-editar],[data-mat-juntar],[data-mat-juntar-ok],[data-mat-ativo],[data-mat-abrir],[data-mat-desvincular],[data-vin-ok],[data-vin-novo],[data-vin-lote-ok],[data-vin-sugestoes],#materiaisCsv');if(!b)return;const d=b.dataset;
 const falhou=err=>($('#vincular').classList.contains('active')?vinMsg:matMsg)(esc(err.message),'danger');
 try{
  if(b.id==='materiaisCsv'){csvDownload('materiais.csv',[['Material','Unidade','Categoria','Situação','Produtos de fornecedor','Saldo nas obras','Valor em estoque']].concat(state.materiais.filter(m=>!m.juntadoEm).map(m=>{const o=saldoMaterialObras(m.id);return [m.nome,m.unidade,m.categoria||'',m.ativo===false?'Desativado':'Ativo',produtosDoMaterial(m.id).map(p=>p.name).join(' | '),String(o.reduce((s,x)=>s+x.saldo,0)).replace('.',','),String(Math.round(o.reduce((s,x)=>s+x.estoque,0)*100)/100).replace('.',',')]})));return}
  if(d.matAbrir!==undefined){Mat.abrir=Mat.abrir===d.matAbrir?'':d.matAbrir;renderMateriais();return}
  if(d.matCancelar!==undefined){Mat.editar='';Mat.juntar='';Mat.criar='';renderMateriais();renderVincular();return}
  if(d.matEditar){Mat.editar=d.matEditar;Mat.juntar='';renderMateriais();return}
  if(d.matJuntar){Mat.juntar=d.matJuntar;Mat.editar='';renderMateriais();return}
  if(d.matSalvar!==undefined){const f=b.closest('[data-mat-form]');const v=k=>f.querySelector(`[data-mf="${k}"]`)?.value||'';b.disabled=true;
   const m=await materialSalvar({nome:v('nome'),unidade:v('unidade'),categoria:v('categoria')},d.matSalvar||'');const vinc=f.dataset.matVincular;
   if(vinc){await materialVincular([vinc],m.id);Mat.criar='';await refresh();vinMsg(`Material <strong>${esc(m.nome)}</strong> criado e vinculado.`,'success');return}
   Mat.editar='';await refresh();matMsg(`Material <strong>${esc(m.nome)}</strong> ${d.matSalvar?'atualizado':'cadastrado'}.`,'success');return}
  if(d.matJuntarOk){const dest=b.closest('tr').querySelector('[data-mat-destino]').value;if(!dest){matMsg('Escolha o material que fica.','danger');return}const a=materialById(d.matJuntarOk),x=materialById(dest);
   if(!confirm(`Juntar "${a.nome}" em "${x.nome}"? Os produtos de fornecedor de "${a.nome}" passam para "${x.nome}", e "${a.nome}" fica desativado.`))return;await materialJuntar(a.id,x.id);Mat.juntar='';await refresh();matMsg(`"${esc(a.nome)}" juntado em "${esc(x.nome)}".`,'success');return}
  if(d.matAtivo){const m=materialById(d.matAtivo);await put('materiais',{...m,ativo:m.ativo===false});await refresh();renderMateriais();return}
  if(d.matDesvincular){await materialVincular([d.matDesvincular],'');await refresh();renderMateriais();return}
  if(d.vinOk){const mid=b.closest('tr').querySelector('[data-vin-mat]').value;if(!mid){vinMsg('Escolha o material na lista ou use Criar material.','danger');return}await materialVincular([d.vinOk],mid);Mat.sel.delete(d.vinOk);await refresh();vinMsg(`Vinculado a <strong>${esc(materialById(mid)?.nome)}</strong>.`,'success');return}
  if(d.vinNovo){Mat.criar=Mat.criar===d.vinNovo?'':d.vinNovo;renderVincular();return}
  if(d.vinLoteOk!==undefined){const mid=document.querySelector('[data-vin-lote]').value;if(!mid||!Mat.sel.size){vinMsg('Marque os produtos e escolha o material.','danger');return}const n=Mat.sel.size;await materialVincular([...Mat.sel],mid);Mat.sel.clear();await refresh();vinMsg(`${n} produto(s) vinculado(s) a <strong>${esc(materialById(mid)?.nome)}</strong>.`,'success');return}
  if(d.vinSugestoes!==undefined){const por=new Map();for(const id of Mat.sel){const p=state.products.find(x=>x.id===id),s=p&&sugestoesMaterial(p.name,1)[0];if(s&&s.s>=0.5){if(!por.has(s.m.id))por.set(s.m.id,[]);por.get(s.m.id).push(id)}}
   if(!por.size){vinMsg('Nenhum dos marcados tem sugestão de 50% para cima. Escolha o material de cada um.','danger');return}let n=0;for(const [mid,ids] of por){await materialVincular(ids,mid);n+=ids.length;ids.forEach(i=>Mat.sel.delete(i))}await refresh();vinMsg(`${n} produto(s) vinculado(s) pela sugestão. Os demais continuam na lista.`,'success');return}
 }catch(err){b.disabled=false;falhou(err)}});
// ==== #JS-MATERIAIS: END ====
