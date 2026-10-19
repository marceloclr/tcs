// ==== #JS-CONSULTA: START ====
// Links de consulta (QR Code ou informados) e aproveitamento do conteúdo, sem servidor próprio:
// o navegador não baixa a página do órgão (bloqueio CORS) nem contorna captcha. A pessoa abre a consulta, e depois
// envia a página salva em PDF ou cola o texto copiado; o texto passa pelos adaptadores e cai na conferência.

// ---------- Origem do link ----------
const UF_POR_SIGLA=Object.fromEntries(Object.entries(UF_SIGLA).map(([c,s])=>[s.toLowerCase(),s]));
const ORIGEM_ROTULO={sefaz_nfce:'NFC-e na SEFAZ estadual',nfse_nacional:'NFS-e no Portal Nacional',nfse_municipal:'NFS-e em portal municipal',cte:'CT-e',sefaz_nfe:'NF-e no portal da SEFAZ',fornecedor:'Portal de fornecedor',desconhecida:'Origem desconhecida'};
function consultaOrigem(url){let u;try{u=new URL(/^https?:/i.test(url)?url:'https://'+url)}catch(e){return {tipo:'desconhecida',rotulo:ORIGEM_ROTULO.desconhecida,host:''}}
 const h=u.hostname.toLowerCase(),c=(h+u.pathname+u.search).toLowerCase();const gov=/\.gov\.br$/.test(h);
 const sigla=(h.match(/(?:sefaz|fazenda|sef|sefin|sefa|set|sefa[a-z]*)\.([a-z]{2})\.gov\.br$/)||h.match(/\.([a-z]{2})\.gov\.br$/)||[])[1];const uf=sigla&&UF_POR_SIGLA[sigla]?UF_POR_SIGLA[sigla]:(/svrs\.rs\.gov\.br/.test(h)?'RS (SVRS)':'');
 let tipo='desconhecida';
 if(/nfse\.gov\.br$/.test(h))tipo='nfse_nacional';
 else if(/cte/.test(c)&&gov)tipo='cte';
 else if(/nfce|nfc-e|consultanfce|qrcode|qrnfce|shownfce/.test(c)&&gov)tipo='sefaz_nfce';
 else if(/nfse|notacarioca|nfe\.prefeitura|issnet|ginfes|betha|iss\.|webiss|notaeletronica|tinus|govbr\.net|e-?nota/.test(c))tipo='nfse_municipal';
 else if(gov&&/nfe|portalnfe|consulta/.test(c))tipo='sefaz_nfe';
 else if(!gov&&/nota|nfe|nf-e|xml|fatura|pedido|compra|cliente|minha|portal|danfe/.test(c))tipo='fornecedor';
 return {tipo,rotulo:ORIGEM_ROTULO[tipo]+(uf&&tipo.startsWith('sefaz')?' ('+uf+')':''),host:h,uf}}
function consultaDica(o){if(o.tipo==='fornecedor')return 'Se o portal do fornecedor oferecer o XML da nota para baixar, prefira baixar o XML e importá-lo: é a fonte mais confiável.';
 if(o.tipo==='desconhecida')return 'Confira se o link é mesmo da nota. Depois de abrir, salve a página em PDF ou copie o conteúdo.';
 return 'A página pertence ao órgão emissor. Depois de abri-la, use "Importar página salva" (Imprimir › Salvar como PDF) ou "Colar conteúdo da consulta" (Selecionar tudo › Copiar).'}
function consultaBotao(url,rotulo='Abrir consulta'){if(!url)return '';const o=consultaOrigem(url);return `<a class="btn sm" href="${esc(/^https?:/i.test(url)?url:'https://'+url)}" target="_blank" rel="noopener noreferrer" title="Abre a página de consulta em nova aba. Origem: ${esc(o.rotulo)} (${esc(o.host)}). A página pertence ao órgão emissor ou ao fornecedor, não ao TCS">${esc(rotulo)}</a>`}

// ---------- Adaptadores de texto ----------
// Cada adaptador diz o quanto reconhece o texto (0–100) e extrai o que conseguir, com o grau de confiança.
// O resultado sempre vai para a conferência; nada é gravado direto.
const dinheiro=s=>brNumber(String(s||'').replace(/[^\d.,]/g,''));
const RE_DIN='(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2}|\\d+(?:\\.\\d+)?)';
function cabecalhoComum(t){const o={};const ch=chavesDoTexto(t)[0];if(ch){o.key=ch;const d=chaveDecompor(ch);o.number=d.numero;o.series=d.serie;o.issuerDoc=d.cnpj}
 const cnpj=t.match(/CNPJ[:\s]*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i);if(cnpj&&!o.issuerDoc)o.issuerDoc=cnpj[1].replace(/\D/g,'');
 const dt=t.match(/(?:Emiss[ãa]o|Data de Emiss[ãa]o|Data)[^\d]{0,15}(\d{2})\/(\d{2})\/(\d{4})/i)||t.match(/(\d{2})\/(\d{2})\/(\d{4})/);if(dt)o.date=`${dt[3]}-${dt[2]}-${dt[1]}`;
 const num=t.match(/N[úu]mero[:\s]*(\d+)/i);if(num&&!o.number)o.number=String(+num[1]);const se=t.match(/S[ée]rie[:\s]*(\d+)/i);if(se&&!o.series)o.series=String(+se[1]);
 const tot=t.match(new RegExp('Valor\\s+a\\s+pagar\\s*R?\\$?:?\\s*'+RE_DIN,'i'))||t.match(new RegExp('Valor\\s+total\\s*(?:da\\s+nota|R\\$)?\\s*R?\\$?:?\\s*'+RE_DIN,'i'))||t.match(new RegExp('TOTAL\\s*R\\$\\s*'+RE_DIN,'i'));if(tot)o.total=dinheiro(tot[1]);
 const desc=t.match(new RegExp('Descontos?\\s*R?\\$?:?\\s*'+RE_DIN,'i'));if(desc)o.discount=dinheiro(desc[1]);
 return o}
function emitenteAntesDoCnpj(linhas){const i=linhas.findIndex(l=>/CNPJ/i.test(l));const cand=(i>0?linhas.slice(Math.max(0,i-3),i):linhas.slice(0,3)).reverse();const l=cand.find(x=>/[A-Za-zÀ-ú]{3,}/.test(x)&&!/consulta|nota fiscal|documento auxiliar|nfc-?e|danfe/i.test(x));return l?l.replace(/\s*CNPJ.*$/i,'').trim():''}
// NFC-e no padrão de consulta da SVRS, usado pela SEFAZ-CE e por outros estados:
// "PRODUTO (Código: 123) Qtde.:1 UN: UN Vl. Unit.: 18,90 Vl. Total 18,90".
const ADAPTADOR_NFCE_CE={id:'nfce_ce',nome:'NFC-e (consulta da SEFAZ-CE, padrão SVRS)',
 reconhece:t=>(/Vl\.?\s*Unit/i.test(t)&&/Qtde/i.test(t)?70:0)+(/sefaz\.ce\.gov\.br|Cear[áa]/i.test(t)?20:0)+(/C[óo]digo:/i.test(t)?10:0),
 extrair(t){const plano=t.replace(/\r/g,'').replace(/[ \t]+/g,' ');const itens=[];const re=/\(\s*C[óo]d(?:igo)?\.?:?\s*([^)]*)\)\s*Qtde\.?:?\s*([\d.,]+)\s*UN:?\s*([A-Za-z0-9]{1,6})\s*Vl\.?\s*Unit\.?:?\s*([\d.,]+)\s*Vl\.?\s*Total:?\s*([\d.,]+)/gi;let ultimo=0,m;
  while((m=re.exec(plano))){const antes=plano.slice(ultimo,m.index).split('\n').map(x=>x.trim()).filter(Boolean);const description=(antes[antes.length-1]||'').replace(/^\d+\s*[-–.]?\s*/,'').trim();ultimo=re.lastIndex;const quantity=brNumber(m[2]),unitPrice=brNumber(m[4]),lineTotal=brNumber(m[5]);
   if(description&&quantity>0)itens.push({code:m[1].trim(),barcode:/^\d{8,14}$/.test(m[1].trim())?m[1].trim():'',description,ncm:'',cfop:'',unit:m[3].toUpperCase(),quantity,unitPrice,lineTotal,discount:0})}
  const cab=cabecalhoComum(plano);cab.issuer=emitenteAntesDoCnpj(plano.split('\n').map(x=>x.trim()).filter(Boolean));
  const soma=itens.reduce((s,i)=>s+i.lineTotal,0);const bate=cab.total&&Math.abs(soma-(cab.total+(cab.discount||0)))<0.05;
  return {...cab,items:itens,confianca:itens.length?(bate?92:75):40,observacao:itens.length?(bate?'Itens somam o valor da nota.':'A soma dos itens não fecha com o total: confira.'):'Nenhum item no padrão da consulta.'}}};
// Genérico: chave, CNPJ, data, total e linhas de item com quantidade e valores no fim da linha.
const ADAPTADOR_GENERICO={id:'generico',nome:'Leitura genérica (heurística)',reconhece:()=>10,
 extrair(t){const linhas=t.replace(/\r/g,'').split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);const cab=cabecalhoComum(t);cab.issuer=emitenteAntesDoCnpj(linhas);
  let itens=itensCupom(linhas);if(!itens.length){const re=new RegExp('^(?:\\d{1,4}\\s+)?(?:(\\d{6,14})\\s+)?(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s+([A-Za-z][A-Za-z0-9]{0,5})\\s+'+RE_DIN+'\\s+'+RE_DIN+'$');
   for(const l of linhas){const m=l.match(re);if(!m||/total|subtotal|desconto|troco|pagar/i.test(m[2]))continue;const quantity=brNumber(m[3]),unitPrice=brNumber(m[5]),lineTotal=brNumber(m[6]);if(quantity>0&&lineTotal>0&&Math.abs(quantity*unitPrice-lineTotal)<=Math.max(0.05,lineTotal*0.02))itens.push({code:m[1]||'',barcode:/^\d{8,14}$/.test(m[1]||'')?m[1]:'',description:m[2],ncm:'',cfop:'',unit:m[4].toUpperCase(),quantity,unitPrice,lineTotal,discount:0})}}
  return {...cab,items:itens,confianca:Math.min(60,(cab.key?20:0)+(cab.total?15:0)+(itens.length?20:0)+(cab.issuer?5:0)),observacao:'Leitura por heurística: confira cada campo.'}}};
const ADAPTADORES=[ADAPTADOR_NFCE_CE,ADAPTADOR_GENERICO];
function consultaInterpretar(texto){const t=String(texto||'');const cands=ADAPTADORES.map(a=>({a,s:a.reconhece(t)})).sort((x,y)=>y.s-x.s);const r=cands[0].a.extrair(t);
 if(cands[0].a!==ADAPTADOR_GENERICO&&!r.items.length){const g=ADAPTADOR_GENERICO.extrair(t);if(g.items.length)return {...g,adaptador:ADAPTADOR_GENERICO}}return {...r,adaptador:cands[0].a}}
// Texto (colado ou da página salva) → nota na conferência. Se já houver na conferência uma nota com a mesma chave
// (por exemplo, a foto da mesma compra), os dados da consulta completam essa nota em vez de criar outra.
async function consultaParaConferencia(texto,{origem,url,tipo='material'}){const r=consultaInterpretar(texto);const fontes={};const marca=k=>fontes[k]={f:'consulta',c:r.confianca,adaptador:r.adaptador.nome};
 const existente=r.key&&draft.find(d=>d.key===r.key);
 if(existente){['issuer','date','total','discount'].forEach(k=>{if(r[k]&&(!existente[k]||['ocr','vazio'].includes(existente._fontes?.[k]?.f))){existente[k]=r[k];existente._fontes[k]={f:'consulta',c:r.confianca,adaptador:r.adaptador.nome}}});
  if(r.items.length&&(!existente.items.length||existente.format==='Foto/OCR')){existente.items=r.items;existente.totalProducts=Math.round(r.items.reduce((s,i)=>s+i.lineTotal,0)*100)/100}
  if(url&&!existente._codigos?.url)existente._codigos={...(existente._codigos||{}),url};(existente._avisos=existente._avisos||[]).push(`Completada com o conteúdo da consulta (${r.adaptador.nome}, confiança ${r.confianca}%). ${r.observacao}`);renderPreview();return {acao:'completou',inv:existente,r}}
 if(r.key){const dup=await chaveJaLancada(r.key);if(dup)return {acao:'duplicada',dup,r}}
 ['key','number','series','issuerDoc','issuer','date','total','discount'].forEach(k=>{if(r[k])marca(k);else if(k!=='discount')fontes[k]={f:'vazio'}});const dk=chaveDecompor(r.key);if(dk?.valida)['key','number','series','issuerDoc'].forEach(k=>fontes[k]={f:'chave',origem:'chave do texto'});
 const inv={id:r.key||'',key:r.key||'',number:r.number||'',series:r.series||'',date:r.date||'',operation:'',issuer:r.issuer||'',issuerDoc:r.issuerDoc||'',recipient:'',totalProducts:Math.round(r.items.reduce((s,i)=>s+i.lineTotal,0)*100)/100,discount:r.discount||0,total:r.total||0,source:origem,format:'Consulta',tipo,protocolStatus:'Dados da página de consulta ('+r.adaptador.nome+'); confira com a página.',items:r.items,
  _conferir:true,_fontes:fontes,_conf:r.confianca,_codigos:url?{url,lidos:0}:{lidos:0},_avisos:[`Lido com: ${r.adaptador.nome} (confiança ${r.confianca}%). ${r.observacao}`]};
 draft.push(inv);renderPreview();return {acao:'nova',inv,r}}

// ---------- Painel "A partir do link de consulta" ----------
function consultaMsg(h,t=''){$('#consultaMsg').innerHTML=h?`<div class="notice ${t}">${h}</div>`:''}
function consultaRenderOrigem(){const url=$('#consultaUrl')?.value.trim();const el=$('#consultaOrigem');if(!el)return;if(!url){el.innerHTML='';return}const o=consultaOrigem(url);el.innerHTML=`<span class="pill ${o.tipo==='desconhecida'?'warn':''}">${esc(o.rotulo)}</span> ${consultaBotao(url)} <span class="hint">${esc(consultaDica(o))}</span>`}
document.addEventListener('input',e=>{if(e.target.matches('#consultaUrl'))consultaRenderOrigem()});
document.addEventListener('click',async e=>{const b=e.target.closest('#consultaLer');if(!b)return;const texto=$('#consultaTexto').value;if(texto.trim().length<30){consultaMsg('Cole o conteúdo da página de consulta (na página: Selecionar tudo › Copiar; aqui: Colar).','danger');return}
 const url=$('#consultaUrl').value.trim();const tipo=$('#consultaTipo').value;const r=await consultaParaConferencia(texto,{origem:'Conteúdo colado'+(url?' · '+consultaOrigem(url).rotulo:''),url,tipo});
 if(r.acao==='duplicada'){consultaMsg(duplicadaHtml(r.r.key,r.dup,'Conteúdo colado'));return}
 consultaMsg(r.acao==='completou'?`A nota ${esc(r.inv.number)} que já estava na conferência foi completada com a consulta.`:`Conteúdo lido com <strong>${esc(r.r.adaptador.nome)}</strong> (confiança ${r.r.confianca}%): ${r.r.items.length} item(ns). Confira a nota abaixo antes de confirmar.`,'success');$('#consultaTexto').value='';$('#preview').scrollIntoView({behavior:'smooth'})});
$('#consultaPdf')?.addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;consultaMsg('<span class="spin"></span> Lendo a página salva…');
 try{const linhas=await pdfLinhas(f);const texto=linhas.join('\n');const url=$('#consultaUrl').value.trim();
  // DANFE em PDF continua pelo caminho do DANFE; página de consulta passa pelos adaptadores
  if(temChaveNFe(linhas)&&/DANFE|DOCUMENTO AUXILIAR DA NOTA FISCAL ELETR[ÔO]NICA/i.test(texto)&&!/Vl\.?\s*Unit/i.test(texto)){await loadFiles([f],$('#consultaTipo').value);consultaMsg('');return}
  const r=await consultaParaConferencia(texto,{origem:'Página salva: '+f.name,url,tipo:$('#consultaTipo').value});
  if(r.acao==='duplicada'){consultaMsg(duplicadaHtml(r.r.key,r.dup,f.name));return}
  consultaMsg(`Página salva lida com <strong>${esc(r.r.adaptador.nome)}</strong> (confiança ${r.r.confianca}%): ${r.r.items.length} item(ns). Confira abaixo.`,'success')}catch(err){consultaMsg('Não foi possível ler o PDF: '+esc(err.message),'danger')}});
// Na conferência de uma foto com link: leva o link para o painel de consulta.
document.addEventListener('click',e=>{const b=e.target.closest('[data-usar-consulta]');if(!b)return;const inv=draft[+b.dataset.usarConsulta];if(!inv?._codigos?.url)return;$('#consultaUrl').value=inv._codigos.url;consultaRenderOrigem();$('#consultaPainel').open=true;$('#consultaPainel').scrollIntoView({behavior:'smooth'})});
// ==== #JS-CONSULTA: END ====
