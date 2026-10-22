// ==== #JS-FILA: START ====
// Fila "Notas recebidas da obra": capturas enviadas pela tela captura.html.
// Situações: pendente → em_conferencia → lancada (ligada à nota gerada) ou descartada (com motivo).
// Quem vê a fila: administradores e o Escritório com escrita no projeto da captura (as regras do Firestore conferem).
const FILA_STATUS={pendente:'Pendente',em_conferencia:'Em conferência',lancada:'Lançada',descartada:'Descartada'};
const FILA_ATRASO_H=48;
const Fila={ligada:false,chave:'',unsubs:[],itens:new Map(),aba:'abertas',msg:'',gatilho:null};
// Busca automática da NFC-e (servidor/buscar-nfce.mjs, no GitLab CI): situação mostrada na fila.
// O job cobre a NFC-e com link do QR e a NFC-e do Ceará só pela chave (mesma regra de servidor/buscar-nfce.mjs).
function buscaCobre(c){const k=chaveDecompor(c.chave);return !!c.consultaUrl||(!!k?.valida&&k.uf===23&&k.modelo===65)}
function buscaSelo(c){const b=c.busca;if(c.status!=='pendente'&&c.status!=='em_conferencia')return '';
 if(!b)return !buscaCobre(c)?(c.chave&&!(c.fotos||[]).length?'<div class="hint" title="A busca automática cobre só a NFC-e (cupom). A NF-e se confere pela nota ou pelo XML do fornecedor">NF-e: sem busca automática</div>':''):'<div><span class="pill gray" title="O job do GitLab busca os dados da NFC-e de hora em hora, das 7 às 18 h; use Buscar agora para não esperar">Busca na SEFAZ na fila</span></div>';
 if(b.status==='ok')return `<div><span class="pill" title="${esc(b.fonte||'')} em ${esc(fmtQuando(b.em))}. Ao conferir, os itens e valores vêm da SEFAZ">Dados da SEFAZ prontos</span></div>`;
 if(b.status==='erro')return `<div><span class="pill warn" title="Tentativa ${b.tentativas||1} de 3 em ${esc(fmtQuando(b.em))}">Busca falhou</span><div class="hint">${esc(b.motivo||'')}</div></div>`;
 return `<div class="hint" title="${esc(b.motivo||'')}">Sem busca automática: conferir pela foto</div>`}
function filaVisivel(){return !!Nuvem.perfil&&!!Nuvem.user&&escritorVigente(Nuvem.perfil)}
// Projetos e clientes com escrita: as consultas que as regras aceitam para ler as capturas.
function filaFiltros(){const p=Nuvem.perfil;if(p.papel==='admin')return [[]];const {nivel}=perfilConcessoes(p);const pe=Object.entries(nivel).filter(([k,n])=>n==='E'&&k.startsWith('p:')).map(([k])=>k.slice(2)),ce=Object.entries(nivel).filter(([k,n])=>n==='E'&&k.startsWith('c:')).map(([k])=>k.slice(2));
 return [...fatias(pe).map(f=>[['projectId','in',f]]),...fatias(ce).map(f=>[['clientId','in',f]])]}
function filaLigar(){const filtros=filaFiltros();const chave=JSON.stringify(filtros);if(Fila.ligada&&chave===Fila.chave)return;filaDesligar();Fila.ligada=true;Fila.chave=chave;
 window.__fb.get('config','busca').then(d=>{Fila.gatilho=d;filaRender()}).catch(()=>{Fila.gatilho=null});
 filtros.forEach(f=>Fila.unsubs.push(window.__fb.listen('capturas',f,ch=>{ch.forEach(c=>c.type==='removed'?Fila.itens.delete(c.id):Fila.itens.set(c.id,{...c.data,id:c.id}));filaRender();renderSubnav($('.view.active')?.id)},e=>{console.error('Fila da obra:',e);Fila.msg='Não foi possível ler as notas recebidas da obra: '+e.message;filaRender()})))}
function filaDesligar(){Fila.unsubs.forEach(u=>{try{u()}catch(e){}});Fila.unsubs=[];Fila.ligada=false;Fila.chave='';Fila.itens=new Map()}
const horasDesde=iso=>(Date.now()-new Date(iso).getTime())/36e5;
function filaContagem(){const l=[...Fila.itens.values()];const ab=l.filter(c=>c.status==='pendente'||c.status==='em_conferencia');return {pend:ab.length,atrasadas:ab.filter(c=>horasDesde(c.enviadoEm||c.capturadoEm)>FILA_ATRASO_H).length,total:l.length}}
const fmtQuando=iso=>{const d=new Date(iso);return isNaN(d)?'—':d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};
const fmtEspera=h=>h<1?'menos de 1 h':h<48?Math.floor(h)+' h':Math.floor(h/24)+' dias';
// Cartão na Visão geral
function filaCartao(){const el=$('#cardObra');if(!el)return;if(!filaVisivel()){el.innerHTML='';return}const c=filaContagem();
 el.innerHTML=`<div class="card cartao-obra${c.atrasadas?' atraso':''}" data-go="recebidas" role="button" tabindex="0" title="Abre a fila das notas enviadas pela obra. Conta as notas pendentes ou em conferência dos projetos em que você tem escrita; destaca as que esperam há mais de ${FILA_ATRASO_H} horas desde o envio."><div><label>Notas recebidas da obra</label><strong class="calc" title="Fórmula: capturas com situação Pendente ou Em conferência, nos projetos em que você tem escrita">${c.pend}</strong><small>${c.pend?(c.atrasadas?`<b>${c.atrasadas} aguardando há mais de ${FILA_ATRASO_H} h</b>`:'aguardando conferência'):'nenhuma aguardando'}</small></div><span class="btn sm">Abrir fila</span></div>`}
// Tela da fila
function filaRender(){filaCartao();const root=$('#filaBody');if(!root)return;
 if(!filaVisivel()){root.innerHTML='<p class="hint">A fila aparece para quem tem escrita em algum projeto e está conectado à nuvem.</p>';return}
 const todos=[...Fila.itens.values()].sort((a,b)=>String(b.enviadoEm).localeCompare(String(a.enviadoEm)));const grupos={abertas:todos.filter(c=>c.status==='pendente'||c.status==='em_conferencia'),lancada:todos.filter(c=>c.status==='lancada'),descartada:todos.filter(c=>c.status==='descartada')};
 const abas=[['abertas','A conferir','Notas pendentes ou em conferência'],['lancada','Lançadas','Notas já lançadas a partir das fotos'],['descartada','Descartadas','Notas descartadas, com o motivo']];
 const linha=c=>{const h=horasDesde(c.enviadoEm||c.capturadoEm),atr=(c.status==='pendente'||c.status==='em_conferencia')&&h>FILA_ATRASO_H;const p=projectById(c.projectId);return `<tr class="${atr?'atrasada':''}"><td>${fmtQuando(c.enviadoEm||c.capturadoEm)}${c.capturadoEm&&c.enviadoEm&&Math.abs(new Date(c.enviadoEm)-new Date(c.capturadoEm))>36e5?`<div class="hint" title="A foto foi tirada sem internet e enviada depois">fotografada em ${fmtQuando(c.capturadoEm)}</div>`:''}</td><td><strong>${esc(p?.name||c.projetoNome||'Projeto')}</strong><div class="hint">${esc(clientById(p?.clientId)?.name||'')}</div></td><td>${esc(c.autorNome||c.autor)}</td><td class="num">${(c.fotos||[]).length||'<span class="pill gray" title="A obra mandou só o código da nota (QR, código de barras ou os números), sem foto">Só código</span>'}</td><td>${(c.observacoes||[]).map(o=>`<span class="pill warn">${esc(o)}</span>`).join(' ')||'<span class="muted">—</span>'}</td><td><span class="pill ${c.status==='lancada'?'':c.status==='descartada'?'gray':'blue'}">${FILA_STATUS[c.status]||c.status}</span>${c.motivo?`<div class="hint">${esc(c.motivo)}</div>`:''}${c.conferindoPor&&c.status==='em_conferencia'?`<div class="hint">com ${esc(c.conferindoPor)}</div>`:''}${buscaSelo(c)}</td><td class="num">${c.status==='lancada'||c.status==='descartada'?'—':`<span class="${atr?'atraso-txt':''}" title="Tempo desde o envio pela obra">${fmtEspera(h)}</span>`}</td>
  <td class="acoes-fila">${c.status==='lancada'?`<button class="btn sm" data-fila-nota="${esc(c.notaId||'')}" title="Abre a nota lançada a partir destas fotos">Abrir nota</button>`:''}${(c.fotos||[]).length?`<button class="btn sm" data-fila-fotos="${esc(c.id)}" title="Mostra as fotos enviadas pela obra">Ver fotos</button>`:''}${c.status==='pendente'||c.status==='em_conferencia'?`<button class="btn sm primary" data-fila-conferir="${esc(c.id)}" title="Usa os dados da SEFAZ, quando a busca já trouxe, e lê as fotos (código de barras, QR e OCR); abre a conferência com o projeto indicado pela obra; nada é gravado antes de você confirmar">Conferir</button><button class="btn sm" data-fila-descartar="${esc(c.id)}" title="Tira esta captura da fila, com o motivo (por exemplo: foto repetida ou não é nota)">Descartar</button>`:''}</td></tr>`};
 const lista=grupos[Fila.aba]||[];
 root.innerHTML=`<div class="tabs">${abas.map(([k,l,d])=>`<button data-fila-aba="${k}" class="${Fila.aba===k?'active':''}" title="${esc(d)}">${l}<span class="count${k==='abertas'&&grupos[k].length?' alert':''}">${grupos[k].length}</span></button>`).join('')}</div>${Fila.msg?`<div class="notice">${Fila.msg}</div>`:''}${filaBuscaHtml(grupos.abertas)}
 <div class="panel"><div class="tablewrap"><table class="no-sort"><thead><tr><th>Recebida em</th><th>Obra</th><th>Enviada por</th><th class="num">Fotos</th><th>Observações</th><th>Situação</th><th class="num" title="Tempo desde o envio; acima de ${FILA_ATRASO_H} h fica destacado">Aguardando</th><th></th></tr></thead><tbody>${lista.map(linha).join('')||`<tr><td colspan="8" class="muted">${Fila.aba==='abertas'?'Nenhuma nota da obra aguardando conferência.':'Nada aqui.'}</td></tr>`}</tbody></table></div></div><div id="filaFotos"></div>`}
function filaMsg(h){Fila.msg=h;filaRender()}
// Fotos da captura: as partes (capturas_fotos) são juntadas na ordem de cada foto.
async function filaFotosDe(c){const partes=await new Promise((res,rej)=>{const u=window.__fb.listen('capturas_fotos',[['capturaId','==',c.id],['projectId','==',c.projectId]],(ch,m)=>{if(!m.fromCache||ch.length){u();res(ch.map(x=>x.data))}},rej)});
 const porFoto=new Map();partes.forEach(p=>{if(!porFoto.has(p.ordem))porFoto.set(p.ordem,[]);porFoto.get(p.ordem).push(p)});
 return [...porFoto.entries()].sort((a,b)=>a[0]-b[0]).map(([ordem,ps])=>{ps.sort((a,b)=>a.parte-b.parte);if(ps.length<(ps[0].partes||1))throw new Error('Uma das fotos ainda não chegou inteira. Tente de novo em instantes.');const bin=atob(ps.map(p=>p.dados).join(''));const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return new File([u8],`obra-${c.id.slice(0,8)}-${ordem+1}.jpg`,{type:ps[0].tipo||'image/jpeg'})})}
function filaAtualizar(id,campos){return window.__fb.commit([{op:'update',store:'capturas',id,data:{...campos,_atualizadoEm:new Date().toISOString(),_atualizadoPor:Nuvem.user.email}}])}
async function filaConferir(id){const c=Fila.itens.get(id);if(!c)return;if(draft.some(d=>d._captura===id)){go('import');$('#preview').scrollIntoView();return}
 const aviso=t=>filaMsg('<span class="spin"></span> '+esc(t));const repetida=key=>`<button class="btn sm" data-fila-descartar="${esc(id)}" data-motivo="Nota já lançada (chave repetida)" title="Descarta esta captura como repetida">Descartar como repetida</button>`;
 try{const temFoto=(c.fotos||[]).length>0,sefaz=c.busca?.status==='ok';if(!temFoto&&!chaveValida(c.chave)&&!sefaz)throw new Error('A captura não tem fotos nem chave da nota.');
  // outra captura com a mesma chave já aberta na conferência (a obra mandou a mesma nota duas vezes)
  const jaAberta=chaveValida(c.chave)&&draft.find(d=>d.key===c.chave);if(jaAberta){filaMsg(`A nota ${esc(jaAberta.number||c.chave)} desta captura já está na conferência, aberta por outra captura com a mesma chave. Confira só uma delas.`+repetida());return}
  if(c.status==='pendente')await filaAtualizar(id,{status:'em_conferencia',conferindoPor:Nuvem.user.email,conferenciaEm:new Date().toISOString()});
  let inv=null,fotos=[];
  if(temFoto){aviso('Baixando as fotos da obra…');fotos=await filaFotosDe(c);if(!fotos.length)throw new Error('As fotos da captura não chegaram.');
   const lido=await fotoLer(fotos[0],aviso);if(!lido.cod.chave&&c.chave&&chaveValida(c.chave)){lido.cod.chave=c.chave;lido.cod.fonte='celular da obra'}if(!lido.cod.url&&c.consultaUrl)lido.cod.url=c.consultaUrl;
   inv=await notaDaFoto(fotos[0],lido,'material');
   const dup=await chaveJaLancada(inv.key);if(dup){URL.revokeObjectURL(inv._foto.url);filaMsg(duplicadaHtml(inv.key,dup,'Captura da obra')+repetida());return}}
  if(sefaz){aviso('Lendo os dados trazidos da SEFAZ…');const texto=htmlParaTexto(c.busca.html);const origem='Busca automática · '+(c.busca.fonte||'SEFAZ');
   if(inv){draft.push(inv);const r=await consultaParaConferencia(texto,{origem,url:c.consultaUrl});
    // chave diferente da foto: a consulta não se mistura com a foto; fica o aviso para conferir
    if(r.acao!=='completou'){if(r.acao==='nova')draft=draft.filter(d=>d!==r.inv);inv._avisos.push('Os dados trazidos da SEFAZ são de outra chave ('+esc(r.r.key||'sem chave')+') e não foram usados. Confira a foto.')}
    draft=draft.filter(d=>d!==inv)}
   else{const r=await consultaParaConferencia(texto,{origem,url:c.consultaUrl});if(r.acao==='duplicada'){filaMsg(duplicadaHtml(r.r.key,r.dup,'Captura da obra')+repetida());return}inv=r.inv;draft=draft.filter(d=>d!==inv)}}
  // a página da SEFAZ nem sempre traz a chave legível: completa pela chave que a obra mandou
  if(inv&&!inv.key&&chaveValida(c.chave)){const k=chaveDecompor(c.chave);Object.assign(inv,{id:k.chave,key:k.chave,number:inv.number||k.numero,series:inv.series||k.serie,issuerDoc:inv.issuerDoc||k.cnpj});['key','number','series','issuerDoc'].forEach(f=>inv._fontes[f]={f:'chave',origem:'chave da obra'})}
  if(!inv){const dup=await chaveJaLancada(c.chave);if(dup){filaMsg(duplicadaHtml(c.chave,dup,'Captura da obra')+repetida());return}inv=notaDaChave(c)}
  const outra=inv.key&&draft.find(d=>d!==inv&&d.key===inv.key);if(outra){if(inv._foto?.url)URL.revokeObjectURL(inv._foto.url);filaMsg(`A nota ${esc(inv.number||inv.key)} desta captura já está na conferência, aberta por outra captura com a mesma chave. Confira só uma delas.`+repetida());return}
  inv._captura=id;inv._projeto=podeGravarProjeto(c.projectId)?c.projectId:'';inv._fotosExtra=fotos.slice(1).map(f=>URL.createObjectURL(f));inv._avisos=inv._avisos||[];
  if((c.observacoes||[]).length)inv._avisos.unshift('A obra informou: '+c.observacoes.join(' e ')+'. Confira as quantidades com a nota.');
  if(fotos.length>1)inv._avisos.push(`A obra enviou ${fotos.length} fotos desta nota; a leitura usou a primeira. As outras aparecem abaixo da foto principal.`);
  if(!temFoto)inv._avisos.push('A obra mandou só o código da nota, sem foto: não há comprovante de recebimento.');
  draft.push(inv);Fila.msg='';filaRender();go('import');renderPreview();$('#importMessage').innerHTML=`<div class="notice success">Captura da obra aberta na conferência, com o projeto indicado${sefaz?' e os dados trazidos da SEFAZ':''}. Confira e confirme a entrada.</div>`;$('#preview').scrollIntoView({behavior:'smooth'})}
 catch(e){filaMsg('<span class="erro-txt">Não foi possível abrir a captura: '+esc(e.message)+'</span>')}}
// Só a chave, sem foto e sem dados da SEFAZ: número, série e CNPJ saem da chave; o resto se completa pela consulta (botão Aproveitar a consulta) ou à mão.
function notaDaChave(c){const k=chaveDecompor(c.chave);const fontes={key:{f:'chave',origem:'chave da obra'},number:{f:'chave',origem:'chave da obra'},series:{f:'chave',origem:'chave da obra'},issuerDoc:{f:'chave',origem:'chave da obra'},issuer:{f:'vazio'},date:{f:'vazio'},total:{f:'vazio'}};
 const motivo=c.busca?.status==='erro'?'a busca na SEFAZ falhou ('+c.busca.motivo+')':c.busca?.status==='sem_fonte'?'a busca automática só cobre NFC-e do Ceará ou com o link do QR':!buscaCobre(c)?'a busca automática só cobre a NFC-e (cupom); para a NF-e, use o XML do fornecedor':'a busca na SEFAZ ainda não rodou (use Buscar agora na fila e confira de novo em alguns minutos)';
 return {id:k.chave,key:k.chave,number:k.numero,series:k.serie,date:'',operation:'',issuer:'',issuerDoc:k.cnpj,recipient:'',totalProducts:0,discount:0,total:0,source:'Chave enviada pela obra',format:'Chave da obra',tipo:'material',protocolStatus:'Só a chave de acesso; confira com a nota.',items:[],
  _conferir:true,_fontes:fontes,_conf:0,_codigos:c.consultaUrl?{url:c.consultaUrl,lidos:0}:{lidos:0},_avisos:[`${k.modeloNome} nº ${k.numero}, série ${k.serie}, CNPJ ${k.cnpj}. Sem itens: ${motivo}. Complete pela consulta da nota ou à mão.`]}}
// Botão "Buscar agora": dispara o pipeline do GitLab (trigger) em vez de esperar o agendamento de hora em hora.
// O token fica em config/busca, lido só por quem confere a fila; no GitLab, as variáveis de pipeline ficam bloqueadas (docs/busca-nfce.md).
function filaBuscaHtml(abertas){const espera=abertas.filter(c=>buscaCobre(c)&&(!c.busca||(c.busca.status==='erro'&&(c.busca.tentativas||0)<3))).length;
 if(Fila.gatilho?.gatilhoToken)return espera?`<div class="row" style="gap:8px;align-items:center;margin:8px 0"><button class="btn sm" data-fila-buscar title="Pede ao GitLab para buscar agora os dados das NFC-e na SEFAZ, sem esperar a rodada de hora em hora. Leva de 1 a 3 minutos">Buscar agora na SEFAZ</button><span class="hint">${espera} nota(s) esperando a busca automática.</span></div>`:'';
 return Nuvem.perfil?.papel==='admin'?`<p class="hint">Busca automática da NFC-e: de hora em hora, das 7 às 18 h. <button class="btn sm" data-fila-gatilho title="Grava o token de trigger do GitLab para mostrar o botão Buscar agora na fila (roteiro em docs/busca-nfce.md)">Configurar "Buscar agora"</button></p>`:''}
async function filaBuscarAgora(b){const g=Fila.gatilho;b.disabled=true;
 try{const f=new FormData();f.append('token',g.gatilhoToken);f.append('ref',g.ref||'main');const r=await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(g.projeto||'87585318')}/trigger/pipeline`,{method:'POST',body:f});
  if(!r.ok)throw new Error('GitLab respondeu '+r.status);Fila.msg='Busca pedida ao GitLab. Os dados aparecem nesta fila em 1 a 3 minutos.'}
 catch(e){Fila.msg='<span class="erro-txt">Não foi possível pedir a busca: '+esc(e.message)+'. A rodada de hora em hora continua.</span>'}filaRender()}
async function filaConfigurarGatilho(){const token=prompt('Token de trigger do pipeline (GitLab › Settings › CI/CD › Pipeline trigger tokens). Deixe vazio para retirar o botão:',Fila.gatilho?.gatilhoToken||'');if(token===null)return;
 try{await window.__fb.commit([{op:'set',store:'config',id:'busca',data:{gatilhoToken:token.trim(),projeto:'87585318',ref:'main',_atualizadoEm:new Date().toISOString(),_atualizadoPor:Nuvem.user.email}}]);Fila.gatilho={gatilhoToken:token.trim(),projeto:'87585318',ref:'main'};Fila.msg=token.trim()?'Botão "Buscar agora" configurado.':'Botão "Buscar agora" retirado.'}
 catch(e){Fila.msg='<span class="erro-txt">Não foi possível gravar: '+esc(e.message)+'</span>'}filaRender()}
// Depois da confirmação: a nota é ligada ao projeto escolhido e a captura vira "lançada", ligada à nota.
async function filaAposLancar(vinculos){for(const v of vinculos){const inv=state.invoices.find(i=>i.key===v.key&&!i._parcial);if(!inv)continue;
 try{if(v.projeto&&podeGravarProjeto(v.projeto)&&invoiceStatus(inv)==='a_vincular')await saveInvoiceAllocations(inv,(inv.items||[]).map((it,j)=>makeAlloc(inv,j,v.projeto,Number(it.quantity))));
  await filaAtualizar(v.captura,{status:'lancada',notaId:inv.id,lancadaEm:new Date().toISOString(),lancadaPor:Nuvem.user.email})}catch(e){console.error('Captura não atualizada:',e);$('#importMessage').insertAdjacentHTML('beforeend',`<div class="notice danger">A nota foi gravada, mas a captura da obra não foi marcada como lançada (${esc(e.message)}). Marque-a na fila.</div>`)}}}
// Ver as fotos (fila ou nota lançada): comprovante de recebimento.
async function filaVerFotos(id,alvo){const c=Fila.itens.get(id)||{id,projectId:alvo?.projeto};const box=alvo?.box||$('#filaFotos');box.innerHTML='<div class="notice"><span class="spin"></span> Carregando as fotos…</div>';
 try{const fotos=await filaFotosDe(c);const urls=fotos.map(f=>URL.createObjectURL(f));box.innerHTML=`<div class="panel fotos-obra"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Fotos enviadas pela obra${c.projetoNome?' · '+esc(c.projetoNome):''}</h3><button class="btn sm" data-fila-fechar-fotos title="Fecha as fotos">Fechar</button></div><p class="hint">Comprovante de recebimento${c.autorNome?' enviado por '+esc(c.autorNome):''}${c.capturadoEm?' em '+fmtQuando(c.capturadoEm):''}.</p><div class="fotos-obra-grade">${urls.map((u,i)=>`<a href="${u}" target="_blank" rel="noopener" title="Abre a foto ${i+1} em tamanho original"><img src="${u}" alt="Foto ${i+1} da nota"></a>`).join('')}</div></div>`;box.scrollIntoView({behavior:'smooth'})}
 catch(e){box.innerHTML=`<div class="notice danger">Não foi possível carregar as fotos: ${esc(e.message)}</div>`}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-fila-buscar],[data-fila-gatilho],[data-fila-aba],[data-fila-conferir],[data-fila-descartar],[data-fila-fotos],[data-fila-nota],[data-fila-fechar-fotos],[data-nota-fotos]');if(!b)return;const d=b.dataset;
 if(d.filaBuscar!==undefined){filaBuscarAgora(b);return}
 if(d.filaGatilho!==undefined){filaConfigurarGatilho();return}
 if(d.filaAba){Fila.aba=d.filaAba;filaRender();return}
 if(d.filaConferir){b.disabled=true;await filaConferir(d.filaConferir);return}
 if(d.filaDescartar){const motivo=d.motivo||prompt('Motivo do descarte (por exemplo: foto repetida, não é nota, nota de outra obra):','');if(!motivo||!motivo.trim())return;try{await filaAtualizar(d.filaDescartar,{status:'descartada',motivo:motivo.trim(),descartadaEm:new Date().toISOString(),descartadaPor:Nuvem.user.email});draft=draft.filter(x=>x._captura!==d.filaDescartar);renderPreview();Fila.msg='Captura descartada.'}catch(err){Fila.msg='Não foi possível descartar: '+esc(err.message)}filaRender();return}
 if(d.filaFotos){filaVerFotos(d.filaFotos);return}
 if(d.filaFecharFotos!==undefined){b.closest('.fotos-obra')?.remove();return}
 if(d.filaNota){selectedInvoiceId=d.filaNota;invoiceTab='todas';go('invoices');renderInvoices();return}
 if(d.notaFotos){const inv=state.invoices.find(i=>i.id===d.notaFotos);if(inv?.capturaId)filaVerFotos(inv.capturaId,{projeto:inv.capturaProjeto,box:$('#notaFotosObra')})}});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.cartao-obra')){e.preventDefault();go('recebidas')}});
// Projeto da conferência (indicado pela obra; editável dentro dos projetos com escrita)
document.addEventListener('change',e=>{const s=e.target.closest('[data-fila-projeto]');if(!s)return;const inv=draft[+s.dataset.filaProjeto];if(inv)inv._projeto=s.value});
function filaProjetoHtml(inv,ii){if(!inv._captura)return '';const c=Fila.itens.get(inv._captura);const indicado=projectById(c?.projectId);
 return `<div class="field fila-projeto"><label>Projeto ${indicado?`<span class="selo-fonte ocr" title="Projeto escolhido por quem fotografou na obra">indicado pela obra</span>`:''}</label><select data-fila-projeto="${ii}" title="Ao confirmar, a nota inteira é vinculada a este projeto. Só aparecem projetos em que você tem escrita"><option value="">Deixar a vincular</option>${projectOptions(inv._projeto)}</select></div>${(inv._fotosExtra||[]).length?`<div class="fotos-extra">${inv._fotosExtra.map((u,i)=>`<a href="${u}" target="_blank" rel="noopener" title="Abre a foto ${i+2} em tamanho original"><img src="${u}" alt="Foto ${i+2}"></a>`).join('')}</div>`:''}`}

// ---------- XML que chega depois da foto ----------
// Se a nota foi lançada pela foto (ou consulta, ou PDF) e depois chega o XML da mesma chave, os dados lidos são trocados pelos do XML,
// mantendo fotos, vínculo com a captura e o projeto (quando a nota estava toda num projeto só).
const xmlPendentes=new Map();
function xmlSubstituirHtml(xml,atual){xmlPendentes.set(xml.key,xml);return `<div class="notice">${esc(xml.source)}: a nota ${esc(atual.number)} já foi lançada a partir de ${esc(atual.format)}. O XML é a fonte mais confiável. <button class="btn sm primary" data-xml-substituir="${esc(xml.key)}" title="Troca emitente, valores e itens pelos do XML. Mantém fotos, vínculo com a captura e o projeto; as entradas no estoque são refeitas">Substituir os dados pelos do XML</button></div>`}
async function xmlSubstituir(key){const xml=xmlPendentes.get(key),inv=state.invoices.find(i=>i.key===key&&!i._parcial);if(!xml||!inv)return;
 const allocs=state.allocations.filter(a=>a.invoiceId===inv.id);const projetos=[...new Set(allocs.map(a=>a.projectId))];
 if(projetos.length>1)throw new Error('A nota está distribuída entre vários projetos. Desfaça a distribuição antes de substituir pelos dados do XML.');
 const prods=new Set((inv.items||[]).map(it=>it.productId).filter(Boolean));if(state.movements.some(m=>m.type==='SAIDA'&&prods.has(m.productId)&&(!projetos.length||m.projectId===projetos[0])))throw new Error('Já há saídas registradas de produtos desta nota. Ajuste as saídas antes de substituir pelos dados do XML.');
 const now=new Date().toISOString();const novo={...xml,id:inv.id,tipo:inv.tipo,postedAt:inv.postedAt,escopo:inv.escopo,projetos:inv.projetos,clientes:inv.clientes,capturaId:inv.capturaId,capturaProjeto:inv.capturaProjeto,consultaUrl:inv.consultaUrl,consultaOrigem:inv.consultaOrigem,formatoAnterior:inv.format,substituidaPorXmlEm:now,items:xml.items.map(it=>({...it}))};
 await txWrite(['products','invoices','movements'],os=>{const cache=new Map(state.products.map(p=>[p.id,{...p}]));
  (inv.items||[]).forEach(it=>{const p=cache.get(it.productId);if(p){p.stock=Number(p.stock||0)-Number(it.quantity);os.products.put(p)}});
  state.movements.filter(m=>m.type==='ENTRADA'&&m.invoiceId===inv.id).forEach(m=>os.movements.delete(m.id));
  const porChave=new Map([...cache.values()].map(p=>[p.key,p]));
  novo.items.forEach((it,itemIndex)=>{const k=productKey(it);let p=porChave.get(k);if(!p){p={id:uid(),key:k,code:it.code||'',barcode:it.barcode||'',name:it.description,unit:it.unit||'UN',stock:0,createdAt:now};porChave.set(k,p);cache.set(p.id,p)}p.stock=Number(p.stock||0)+Number(it.quantity);os.products.put(p);it.productId=p.id;
   os.movements.add({id:uid(),productId:p.id,invoiceId:novo.id,invoiceKey:novo.key,itemIndex,date:novo.date,type:'ENTRADA',escopo:'aberta',quantity:Number(it.quantity),unitCost:Number(it.unitPrice),description:it.description,source:novo.source,createdAt:now})});
  os.invoices.put({...novo,escopo:'aberta',projetos:[],clientes:[]})});
 await refresh();const atual=state.invoices.find(i=>i.id===inv.id);
 await saveInvoiceAllocations(atual,projetos.length?atual.items.map((it,j)=>makeAlloc(atual,j,projetos[0],Number(it.quantity))):[]);
 xmlPendentes.delete(key);return projetos[0]}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-xml-substituir]');if(!b)return;b.disabled=true;try{const p=await xmlSubstituir(b.dataset.xmlSubstituir);b.closest('.notice').outerHTML=`<div class="notice success">Dados substituídos pelos do XML${p?' e nota mantida no projeto '+esc(projectLabel(projectById(p))):''}. As fotos e o vínculo com a captura foram mantidos.</div>`}catch(err){b.disabled=false;b.closest('.notice').insertAdjacentHTML('beforeend',`<div class="erro-txt">${esc(err.message)}</div>`)}});
// Liga ou desliga a fila conforme o papel; chamado a cada render.
function filaSincronizar(){if(filaVisivel())filaLigar();else if(Fila.ligada)filaDesligar();filaRender()}
// ==== #JS-FILA: END ====
