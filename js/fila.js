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
// Resumo da nota trazida da SEFAZ (itens e total), lido uma vez por captura.
const buscaResumos=new Map();
function buscaResumo(c){if(!c.busca?.html)return null;const k=c.id+'|'+c.busca.em;if(!buscaResumos.has(k)){let r=null;try{const x=consultaInterpretar(htmlParaTexto(c.busca.html));r=x.items.length?{itens:x.items.length,total:x.total||x.items.reduce((s,i)=>s+i.lineTotal,0)}:null}catch(e){}buscaResumos.set(k,r)}return buscaResumos.get(k)}
function buscaSelo(c){const b=c.busca;if(c.status!=='pendente'&&c.status!=='em_conferencia')return '';
 if(!b&&buscaCobre(c)&&horasDesde(c.enviadoEm||c.capturadoEm)<4/60)return '<div><span class="pill blue" title="O envio pela obra já pediu a busca ao GitLab; os produtos e valores chegam em 1 a 3 minutos">Buscando na SEFAZ…</span></div>';
 if(!b)return !buscaCobre(c)?(c.chave&&!(c.fotos||[]).length?'<div class="hint" title="A busca automática cobre só a NFC-e (cupom). A NF-e se confere pela nota ou pelo XML do fornecedor">NF-e: sem busca automática</div>':''):'<div><span class="pill gray" title="O job do GitLab busca os dados da NFC-e de hora em hora, das 7 às 18 h; use Buscar agora para não esperar">Busca na SEFAZ na fila</span></div>';
 if(b.status==='ok'){const r=buscaResumo(c);return `<div><span class="pill selo-importado" title="${esc(b.fonte||'')} em ${esc(fmtQuando(b.em))}. Ao conferir, os itens e valores já vêm preenchidos">✓ Produtos e valores importados</span>${r?`<div class="hint">${r.itens} ${r.itens===1?'item':'itens'} · ${money(r.total)}</div>`:''}</div>`}
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
 const linha=c=>{const h=horasDesde(c.enviadoEm||c.capturadoEm),atr=(c.status==='pendente'||c.status==='em_conferencia')&&h>FILA_ATRASO_H;const p=projectById(c.projectId);return `<tr class="${atr?'atrasada':''}"><td>${fmtQuando(c.enviadoEm||c.capturadoEm)}${c.capturadoEm&&c.enviadoEm&&Math.abs(new Date(c.enviadoEm)-new Date(c.capturadoEm))>36e5?`<div class="hint" title="A foto foi tirada sem internet e enviada depois">fotografada em ${fmtQuando(c.capturadoEm)}</div>`:''}</td><td>${(c.obras?.length>1?c.obras:[{projectId:c.projectId,nome:c.projetoNome}]).map(o=>{const pp=projectById(o.projectId);return `<div><strong>${esc(pp?.name||o.nome||'Projeto')}</strong> <span class="hint">${esc(clientById(pp?.clientId)?.name||'')}</span></div>`}).join('')}${c.obras?.length>1?`<span class="pill blue" title="A obra indicou mais de uma obra para esta nota; os produtos são separados na conferência">${c.obras.length} obras</span>`:''}</td><td>${esc(c.autorNome||c.autor)}</td><td class="num">${(c.fotos||[]).length||'<span class="pill gray" title="A obra mandou só o código da nota (QR, código de barras ou os números), sem foto">Só código</span>'}</td><td>${(c.observacoes||[]).map(o=>`<span class="pill warn">${esc(o)}</span>`).join(' ')||'<span class="muted">—</span>'}</td><td><span class="pill ${c.status==='lancada'?'':c.status==='descartada'?'gray':'blue'}">${FILA_STATUS[c.status]||c.status}</span>${c.motivo?`<div class="hint">${esc(c.motivo)}</div>`:''}${c.conferindoPor&&c.status==='em_conferencia'?`<div class="hint">com ${esc(c.conferindoPor)}</div>`:''}${buscaSelo(c)}</td><td class="num">${c.status==='lancada'||c.status==='descartada'?'—':`<span class="${atr?'atraso-txt':''}" title="Tempo desde o envio pela obra">${fmtEspera(h)}</span>`}</td>
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
  if(!inv.issuer&&/^\d{14}$/.test(inv.issuerDoc||'')){aviso('Buscando o emitente pelo CNPJ…');const e=await emitentePorCnpj(inv.issuerDoc);if(e){inv.issuer=e.nome;inv._fontes=inv._fontes||{};inv._fontes.issuer={f:'cnpj',fantasia:e.fantasia}}}
  inv._captura=id;inv._obras=filaObrasDaCaptura(c).filter(podeGravarProjeto);inv._projeto=inv._obras[0]||'';inv._fotosExtra=fotos.slice(1).map(f=>URL.createObjectURL(f));inv._avisos=inv._avisos||[];
  if((c.observacoes||[]).length)inv._avisos.unshift('A obra informou: '+c.observacoes.join(' e ')+'. Confira as quantidades com a nota.');
  if(filaObrasDaCaptura(c).length>1)inv._avisos.unshift(`A obra indicou ${filaObrasDaCaptura(c).length} obras para esta nota. Separe os produtos entre elas no quadro "Separação entre as obras", abaixo dos itens.`);
  if(fotos.length>1)inv._avisos.push(`A obra enviou ${fotos.length} fotos desta nota; a leitura usou a primeira. As outras aparecem abaixo da foto principal.`);
  if(!temFoto)inv._avisos.push('A obra mandou só o código da nota, sem foto: não há comprovante de recebimento.');
  draft.push(inv);Fila.msg='';filaRender();go('import');renderPreview();$('#importMessage').innerHTML=`<div class="notice success">Captura da obra aberta na conferência, com o projeto indicado${sefaz?' e os dados trazidos da SEFAZ':''}. Confira e confirme a entrada.</div>`;$('#preview').scrollIntoView({behavior:'smooth'})}
 catch(e){filaMsg('<span class="erro-txt">Não foi possível abrir a captura: '+esc(e.message)+'</span>')}}
// Só a chave, sem foto e sem dados da SEFAZ: número, série e CNPJ saem da chave; o resto se completa pela consulta (botão Aproveitar a consulta) ou à mão.
function notaDaChave(c){const k=chaveDecompor(c.chave);const fontes={key:{f:'chave',origem:'chave da obra'},number:{f:'chave',origem:'chave da obra'},series:{f:'chave',origem:'chave da obra'},issuerDoc:{f:'chave',origem:'chave da obra'},issuer:{f:'vazio'},date:{f:'vazio'},total:{f:'vazio'}};
 const motivo=c.busca?.status==='erro'?'a busca na SEFAZ falhou ('+c.busca.motivo+')':c.busca?.status==='sem_fonte'?'a busca automática só cobre NFC-e do Ceará ou com o link do QR':!buscaCobre(c)?'a busca automática só cobre a NFC-e (cupom); para a NF-e, use o XML do fornecedor':'a busca na SEFAZ ainda não rodou (use Buscar agora na fila e confira de novo em alguns minutos)';
 return {id:k.chave,key:k.chave,number:k.numero,series:k.serie,date:'',operation:'',issuer:'',issuerDoc:k.cnpj,recipient:'',totalProducts:0,discount:0,total:0,source:'Chave enviada pela obra',format:'Chave da obra',tipo:'material',protocolStatus:'Só a chave de acesso; confira com a nota.',items:[],
  _conferir:true,_fontes:fontes,_conf:0,_codigos:c.consultaUrl?{url:c.consultaUrl,lidos:0}:{lidos:0},_avisos:[`${k.modeloNome} nº ${k.numero}, série ${k.serie}, CNPJ ${k.cnpj}. Sem itens: ${motivo}. Complete pela consulta da nota ou à mão.`]}}
// Emitente pela razão social da Receita Federal (BrasilAPI, gratuita e sem chave), quando a nota não trouxe o nome.
// Sem resposta em 6 s, o campo fica para preencher.
const cnpjCache=new Map();
async function emitentePorCnpj(cnpj){if(cnpjCache.has(cnpj))return cnpjCache.get(cnpj);
 try{const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),6000);const r=await fetch('https://brasilapi.com.br/api/cnpj/v1/'+cnpj,{signal:ctl.signal});clearTimeout(t);if(!r.ok)return null;
  const j=await r.json();const e=j.razao_social?{nome:j.razao_social,fantasia:j.nome_fantasia||''}:null;cnpjCache.set(cnpj,e);return e}catch(e){return null}}
// Botão "Buscar agora": dispara o pipeline do GitLab (trigger) em vez de esperar o agendamento de hora em hora.
// O token fica em config/busca, lido só por quem confere a fila; no GitLab, as variáveis de pipeline ficam bloqueadas (docs/busca-nfce.md).
// Agenda do job no GitLab (Pipeline schedule "0 7-18 * * 1-6", fuso de São Paulo = Fortaleza, UTC−3): de hora em hora, das 7 às 18 h, de segunda a sábado.
// O GitLab costuma começar 1 a 2 minutos depois da hora cheia, e a busca leva cerca de 1 minuto: por isso a janela "buscando" de 4 minutos.
const BUSCA_AGENDA={horas:[7,18],dias:[1,6],fusoMin:-180,janelaMin:4};
function buscaRodadas(agora=Date.now()){const H=36e5,off=BUSCA_AGENDA.fusoMin*6e4;const vale=t=>{const d=new Date(t+off);const h=d.getUTCHours(),w=d.getUTCDay();return h>=BUSCA_AGENDA.horas[0]&&h<=BUSCA_AGENDA.horas[1]&&w>=BUSCA_AGENDA.dias[0]&&w<=BUSCA_AGENDA.dias[1]};
 const cheia=Math.floor(agora/H)*H;let ant=null,prox=null;for(let t=cheia;t>cheia-8*24*H&&ant===null;t-=H)if(vale(t))ant=t;for(let t=cheia+H;t<cheia+8*24*H&&prox===null;t+=H)if(vale(t))prox=t;return {ant,prox}}
const doisDig=n=>String(n).padStart(2,'0');
const horaFtz=t=>new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Fortaleza'});
// Estado da agenda agora: próxima rodada, contagem, andamento da hora e as rodadas de hoje (7h às 18h) com a situação de cada uma.
function buscaEstado(agora=Date.now()){const {ant,prox}=buscaRodadas(agora),jan=BUSCA_AGENDA.janelaMin*6e4,H=36e5,off=BUSCA_AGENDA.fusoMin*6e4;
 const pedida=Fila.pedidaEm&&agora-Fila.pedidaEm<jan,rodando=pedida||(ant!==null&&agora-ant<jan);
 const seg=Math.max(0,Math.ceil((prox-agora)/1000)),h=Math.floor(seg/3600),m=Math.floor(seg%3600/60),ss=seg%60;
 const local=new Date(agora+off),dia0=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())-off,util=local.getUTCDay()>=BUSCA_AGENDA.dias[0]&&local.getUTCDay()<=BUSCA_AGENDA.dias[1];
 const rodadas=[];for(let hr=BUSCA_AGENDA.horas[0];hr<=BUSCA_AGENDA.horas[1];hr++){const t=dia0+hr*H;rodadas.push({hr,t,sit:!util?'folga':agora>=t&&agora-t<jan?'agora':t===prox?'proxima':t<agora?'feita':'futura'})}
 const amanha=new Date(prox+off).getUTCDate()!==local.getUTCDate();
 return {rodando,pedida,prox,ant,contagem:h?`${h} h ${doisDig(m)} min`:doisDig(m)+':'+doisDig(ss),longa:h>0,
  hora:horaFtz(prox),diaProx:amanha?new Date(prox).toLocaleDateString('pt-BR',{weekday:'long',timeZone:'America/Fortaleza'}):'hoje',
  fracao:ant!==null&&prox-ant===H?Math.min(1,(agora-ant)/H):null,rodadas,util,agora}}
function buscaProximaHtml(e=buscaEstado()){
 const dia=`<span class="bp-legenda">${e.util?'rodadas de hoje':'hoje não há rodadas'}</span><ol class="bp-dia" aria-label="Rodadas de hoje, das 7h às 18h">${e.rodadas.map(r=>`<li class="${r.sit}" title="${r.hr}h: ${({feita:'já rodou',agora:'rodando agora',proxima:'próxima rodada',futura:'mais tarde',folga:'sem busca hoje (domingo)'})[r.sit]}"><span>${r.hr}</span></li>`).join('')}</ol>`;
 if(e.rodando)return `<div class="bp-topo"><span class="bp-rotulo">${e.pedida?'Buscar agora pedido':'Rodada das '+horaFtz(e.ant)}</span></div><div class="bp-agora"><span class="bp-pulso" aria-hidden="true"></span>Buscando na SEFAZ…</div><p class="bp-nota">Os dados aparecem na fila em 1 a 3 minutos.</p>${dia}`;
 return `<div class="bp-topo"><span class="bp-rotulo">Próxima busca</span><span class="bp-hora">${e.diaProx==='hoje'?'':esc(e.diaProx)+', '}${e.hora}</span></div>
  <div class="bp-contagem"><span class="calc" tabindex="0" title="Fórmula: próxima rodada − agora = ${e.hora} − ${horaFtz(e.agora)} (agenda do GitLab: de hora em hora, das 7h às 18h, de segunda a sábado, horário de Fortaleza)">${e.contagem}</span><small>${e.longa?'faltam':'min:s'}</small></div>
  ${e.fracao!==null?`<div class="bp-barra" title="Andamento da hora até a próxima rodada"><i style="width:${(e.fracao*100).toFixed(1)}%"></i></div>`:''}${dia}`}
// Relógio ao vivo: redesenha só o cartão da próxima busca, uma vez por segundo.
setInterval(()=>{const el=document.getElementById('buscaProxima');if(el)el.innerHTML=buscaProximaHtml()},1000);
function filaBuscaHtml(abertas){const espera=abertas.filter(c=>buscaCobre(c)&&(!c.busca||(c.busca.status==='erro'&&(c.busca.tentativas||0)<3))).length;
 const adm=Nuvem.perfil?.papel==='admin',pronto=!!Fila.gatilho?.gatilhoToken;
 return `<div class="busca-sefaz"><div class="busca-sefaz-info"><h3>Busca automática na SEFAZ</h3>
  <p class="bp-freq"><b>De hora em hora, das 7h às 18h, de segunda a sábado</b> <span>(horário de Fortaleza)</span></p>
  <p>Traz os dados dos cupons (NFC-e) enviados pela obra. A NF-e se confere pela foto ou pelo XML.</p>
  <p class="busca-sefaz-espera">${espera?`<b>${espera}</b> ${espera===1?'nota esperando':'notas esperando'} a próxima busca.`:'Nenhuma nota esperando busca.'}</p>
  <div class="busca-sefaz-acoes"><button class="btn primary" data-fila-buscar ${!pronto&&!adm?'disabled':''} title="${pronto?'Pede ao GitLab para buscar agora os dados das NFC-e na SEFAZ, sem esperar a próxima rodada. Os dados chegam em 1 a 3 minutos':adm?'Antes, grave o token de trigger do GitLab (roteiro em docs/busca-nfce.md)':'O administrador ainda não liberou o Buscar agora'}">Buscar agora</button>${adm?`<button class="btn sm" data-fila-gatilho title="Grava ou troca o token de trigger do GitLab usado pelo Buscar agora (roteiro em docs/busca-nfce.md)">${pronto?'Trocar token':'Configurar token'}</button>`:''}</div></div>
 <div class="busca-sefaz-proxima" id="buscaProxima" aria-live="off">${buscaProximaHtml()}</div></div>`}
async function filaBuscarAgora(b){const g=Fila.gatilho;if(!g?.gatilhoToken){if(Nuvem.perfil?.papel==='admin')return filaConfigurarGatilho();return}b.disabled=true;
 try{const f=new FormData();f.append('token',g.gatilhoToken);f.append('ref',g.ref||'main');const r=await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(g.projeto||'87585318')}/trigger/pipeline`,{method:'POST',body:f});
  if(!r.ok)throw new Error('GitLab respondeu '+r.status);Fila.pedidaEm=Date.now();Fila.msg='Busca pedida ao GitLab. Os dados aparecem nesta fila em 1 a 3 minutos.'}
 catch(e){Fila.msg='<span class="erro-txt">Não foi possível pedir a busca: '+esc(e.message)+'. A rodada de hora em hora continua.</span>'}filaRender()}
async function filaConfigurarGatilho(){const token=prompt('Token de trigger do pipeline (GitLab › Settings › CI/CD › Pipeline trigger tokens). Deixe vazio para retirar o botão:',Fila.gatilho?.gatilhoToken||'');if(token===null)return;
 try{await window.__fb.commit([{op:'set',store:'config',id:'busca',data:{gatilhoToken:token.trim(),projeto:'87585318',ref:'main',_atualizadoEm:new Date().toISOString(),_atualizadoPor:Nuvem.user.email}}]);Fila.gatilho={gatilhoToken:token.trim(),projeto:'87585318',ref:'main'};Fila.msg=token.trim()?'Botão "Buscar agora" configurado.':'Botão "Buscar agora" retirado.'}
 catch(e){Fila.msg='<span class="erro-txt">Não foi possível gravar: '+esc(e.message)+'</span>'}filaRender()}
// Depois da confirmação: a nota é ligada ao projeto escolhido e a captura vira "lançada", ligada à nota.
async function filaAposLancar(vinculos){for(const v of vinculos){const inv=state.invoices.find(i=>i.key===v.key&&!i._parcial);if(!inv)continue;
 try{const obras=(v.obras||[]).filter(podeGravarProjeto);
  if(obras.length&&invoiceStatus(inv)==='a_vincular'){const al=[];(inv.items||[]).forEach((it,j)=>{const d=v.dist?.[j]||{};for(const pid of obras){const q=Math.min(Number(d[pid]||0),Number(it.quantity)||0);if(q>1e-9)al.push(makeAlloc(inv,j,pid,q))}});if(al.length)await saveInvoiceAllocations(inv,al)}
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
// ---------- Obras da nota na conferência ----------
// A obra pode indicar até 5 obras para a mesma nota (captura.obras; capturas antigas: só projectId). Na conferência, quem tem escrita
// tira, troca ou acrescenta obras e separa cada produto entre elas; ao confirmar, a nota é vinculada conforme a separação.
// Uma obra só: a nota inteira vai para ela. Sem obra: a nota fica a vincular.
function filaObrasDaCaptura(c){return (c?.obras?.length?c.obras.map(o=>o.projectId):[c?.projectId]).filter(Boolean)}
const filaObras=inv=>inv._obras||(inv._obras=inv._projeto?[inv._projeto]:[]);
// separação de um item: {projetoId: quantidade}. Com uma obra só, tudo nela; com várias, o padrão é tudo na primeira.
function filaDistItem(inv,it){const ob=filaObras(inv),q=Number(it.quantity)||0;if(ob.length===1)return {[ob[0]]:q};if(!ob.length)return {};
 const d=it._obras||(it._obras={});Object.keys(d).forEach(k=>{if(!ob.includes(k))delete d[k]});if(!Object.keys(d).length)d[ob[0]]=q;return d}
const filaLivre=(inv,it)=>Math.round(((Number(it.quantity)||0)-Object.values(filaDistItem(inv,it)).reduce((s,v)=>s+Number(v||0),0))*1e6)/1e6;
function filaDistErro(inv){if(!inv._captura||filaObras(inv).length<2)return '';const it=inv.items.find(x=>filaLivre(inv,x)<-1e-6);return it?`Na nota ${inv.number||''}, o item "${it.description}" foi separado em quantidade maior que a da nota. Corrija o quadro "Separação entre as obras".`:''}
function filaProjetoHtml(inv,ii){if(!inv._captura)return '';const c=Fila.itens.get(inv._captura);const ob=filaObras(inv),indicadas=filaObrasDaCaptura(c);
 const chips=ob.map(pid=>`<span class="chip-obra">${esc(projectLabel(projectById(pid))||pid)}${indicadas.includes(pid)?' <small title="Obra escolhida por quem enviou a nota">indicada</small>':''}<button type="button" data-fila-obra-tirar="${ii}" data-p="${esc(pid)}" title="Tira esta obra da nota${ob.length===2?'; a outra fica com a nota inteira':''}" aria-label="Tirar a obra">×</button></span>`).join('');
 const fora=indicadas.filter(p=>!ob.includes(p)&&!podeGravarProjeto(p));
 return `<div class="field fila-projeto"><label>${ob.length>1?'Obras':'Obra'} da nota ${indicadas.length?`<span class="selo-fonte ocr" title="Obras escolhidas por quem enviou a nota; você pode trocar, tirar ou acrescentar antes de confirmar">indicadas pela obra</span>`:''}</label>
  <div class="obras-chips">${chips||'<span class="hint">Nenhuma: a nota fica a vincular.</span>'}${ob.length<5?`<select data-fila-obra-add="${ii}" title="Acrescenta uma obra à nota. Só aparecem projetos em que você tem escrita"><option value="">+ Adicionar obra…</option>${projectOptions('')}</select>`:''}</div>
  ${fora.length?`<p class="hint">Indicada pela obra sem acesso seu: ${fora.map(p=>esc(projectById(p)?.name||Fila.itens.get(inv._captura)?.obras?.find(o=>o.projectId===p)?.nome||p)).join(', ')}.</p>`:''}
  ${ob.length===1?'<p class="hint">Ao confirmar, a nota inteira é vinculada a esta obra.</p>':ob.length>1?'<p class="hint">Separe os produtos entre as obras no quadro abaixo dos itens.</p>':''}</div>${(inv._fotosExtra||[]).length?`<div class="fotos-extra">${inv._fotosExtra.map((u,i)=>`<a href="${u}" target="_blank" rel="noopener" title="Abre a foto ${i+2} em tamanho original"><img src="${u}" alt="Foto ${i+2}"></a>`).join('')}</div>`:''}`}
// Quadro "Separação entre as obras" (mais de uma obra): produto × obra, com a quantidade livre e o valor de cada obra.
function filaDistHtml(inv,ii){const ob=filaObras(inv);if(!inv._captura||ob.length<2||!inv.items.length)return '';
 const valorObra=pid=>inv.items.reduce((s,it,j)=>s+Number(filaDistItem(inv,it)[pid]||0)*itemUnitCost(inv,j),0);
 const linhas=inv.items.map((it,j)=>{const d=filaDistItem(inv,it),l=filaLivre(inv,it);return `<tr><td>${esc(it.description||'Item '+(j+1))}</td><td class="num">${num(it.quantity)} ${esc(it.unit||'')}</td>${ob.map(pid=>`<td class="num"><input type="number" min="0" step="any" data-fila-dist="${ii}" data-j="${j}" data-p="${esc(pid)}" value="${d[pid]?d[pid]:''}" aria-label="Quantidade de ${esc(it.description)} para ${esc(projectById(pid)?.name||'a obra')}"></td>`).join('')}<td class="num ${l<-1e-6?'erro-txt':l>1e-6?'':'muted'}">${l<-1e-6?'excede '+num(-l):l>1e-6?num(l):'✓'}</td></tr>`}).join('');
 return `<div class="panel fila-dist"><h3>Separação entre as obras</h3><p class="hint">Quanto de cada produto vai para cada obra. O que ficar livre continua a vincular e pode ser distribuído depois em Notas fiscais.</p>
  <div class="tablewrap"><table class="no-sort"><thead><tr><th>Produto</th><th class="num">Na nota</th>${ob.map(pid=>`<th class="num">${esc(projectById(pid)?.name||pid)}<div><button type="button" class="btn sm" data-fila-tudo="${ii}" data-p="${esc(pid)}" title="Põe todos os produtos desta nota nesta obra">Tudo aqui</button></div></th>`).join('')}<th class="num">Livre</th></tr></thead>
  <tbody>${linhas}</tbody><tfoot><tr><td colspan="2"><strong>Valor por obra</strong></td>${ob.map(pid=>{const v=valorObra(pid);return `<td class="num"><span class="calc" title="Fórmula: soma de quantidade × custo unitário pago (com descontos e despesas rateados) dos produtos separados para esta obra">${money(v)}</span></td>`}).join('')}<td></td></tr></tfoot></table></div></div>`}
document.addEventListener('change',e=>{const t=e.target;
 const add=t.closest('[data-fila-obra-add]');if(add){const inv=draft[+add.dataset.filaObraAdd];if(inv&&add.value){const ob=filaObras(inv);if(!ob.includes(add.value)){if(ob.length===1)inv.items.forEach(it=>{it._obras={[ob[0]]:Number(it.quantity)||0}});ob.push(add.value)}inv._projeto=ob[0]}renderPreview();return}
 const d=t.closest('[data-fila-dist]');if(d){const inv=draft[+d.dataset.filaDist];const it=inv?.items[+d.dataset.j];if(!it)return;filaDistItem(inv,it)[d.dataset.p]=Math.max(0,Number(String(d.value).replace(',','.'))||0);renderPreview()}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-fila-obra-tirar],[data-fila-tudo]');if(!b)return;
 if(b.dataset.filaObraTirar!==undefined){const inv=draft[+b.dataset.filaObraTirar];if(!inv)return;inv._obras=filaObras(inv).filter(p=>p!==b.dataset.p);inv.items.forEach(it=>{if(it._obras)delete it._obras[b.dataset.p]});inv._projeto=inv._obras[0]||'';renderPreview();return}
 const inv=draft[+b.dataset.filaTudo];if(!inv)return;inv.items.forEach(it=>{it._obras={[b.dataset.p]:Number(it.quantity)||0}});renderPreview()});

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
  // entradas antigas: as que este navegador vê e as anotadas nos itens (quem tem escrita não lê as entradas de nota já vinculada)
  new Set([...state.movements.filter(m=>m.type==='ENTRADA'&&m.invoiceId===inv.id).map(m=>m.id),...(inv.items||[]).map(it=>it.movementId).filter(Boolean)]).forEach(id=>os.movements.delete(id));
  const porChave=new Map([...cache.values()].map(p=>[p.key,p]));
  novo.items.forEach((it,itemIndex)=>{const k=productKey(it);let p=porChave.get(k);if(!p){p={id:uid(),key:k,code:it.code||'',barcode:it.barcode||'',name:it.description,unit:it.unit||'UN',stock:0,createdAt:now};porChave.set(k,p);cache.set(p.id,p)}p.stock=Number(p.stock||0)+Number(it.quantity);os.products.put(p);it.productId=p.id;
   it.movementId=uid();os.movements.add({id:it.movementId,productId:p.id,invoiceId:novo.id,invoiceKey:novo.key,itemIndex,date:novo.date,type:'ENTRADA',escopo:'aberta',quantity:Number(it.quantity),unitCost:Math.round(itemUnitCost(novo,itemIndex)*1e6)/1e6,description:it.description,source:novo.source,createdAt:now})});
  os.invoices.put({...novo,escopo:'aberta',projetos:[],clientes:[]})});
 await refresh();const atual=state.invoices.find(i=>i.id===inv.id);
 await saveInvoiceAllocations(atual,projetos.length?atual.items.map((it,j)=>makeAlloc(atual,j,projetos[0],Number(it.quantity))):[]);
 xmlPendentes.delete(key);return projetos[0]}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-xml-substituir]');if(!b)return;b.disabled=true;try{const p=await xmlSubstituir(b.dataset.xmlSubstituir);b.closest('.notice').outerHTML=`<div class="notice success">Dados substituídos pelos do XML${p?' e nota mantida no projeto '+esc(projectLabel(projectById(p))):''}. As fotos e o vínculo com a captura foram mantidos.</div>`}catch(err){b.disabled=false;b.closest('.notice').insertAdjacentHTML('beforeend',`<div class="erro-txt">${esc(err.message)}</div>`)}});
// Liga ou desliga a fila conforme o papel; chamado a cada render.
function filaSincronizar(){if(filaVisivel())filaLigar();else if(Fila.ligada)filaDesligar();filaRender()}
// ==== #JS-FILA: END ====
