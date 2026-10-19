// ==== #JS-IMAGEM: START ====
// Fotos de notas: abertura (inclusive HEIC), preparo para o OCR, leitura de código de barras e QR Code, chave de acesso
// validada pelo dígito verificador e conferência com a foto ao lado. O texto lido segue pelo mesmo caminho do PDF (parsePDF).
const LIB_ZXING=['./libs/zxing/index.min.js','https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js','ZXing'];
const LIB_HEIC=['./libs/heic2any/heic2any.min.js','https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js','heic2any'];
const ehImagem=f=>/^image\//.test(f.type||'')||/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name||'');
const ehHeic=f=>/hei[cf]/i.test(f.type||'')||/\.(heic|heif)$/i.test(f.name||'');

// ---------- Abrir e preparar a imagem ----------
// Abre a foto já na orientação do EXIF e limita o lado maior (fotos de celular passam de 4000 px).
async function imagemCarregar(file,ladoMax=3000){let blob=file;
 if(ehHeic(file)){try{const h=await loadLibrary(...LIB_HEIC);blob=await h({blob:file,toType:'image/jpeg',quality:0.92});if(Array.isArray(blob))blob=blob[0]}catch(e){throw new Error('Não foi possível abrir a foto em HEIC (formato do iPhone). No iPhone, em Ajustes › Câmera › Formatos, escolha "Mais compatível", ou envie a foto pelo WhatsApp, que já a converte para JPG.')}}
 let bmp;try{bmp=await createImageBitmap(blob,{imageOrientation:'from-image'})}catch(e){throw new Error('O arquivo não parece ser uma imagem válida.')}
 const k=Math.min(1,ladoMax/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);if(bmp.close)bmp.close();
 return {canvas:c,url:URL.createObjectURL(blob),blob}}
// Para o Tesseract: lado maior perto de 2400 px, tons de cinza e contraste esticado (1% mais escuro vira preto, 1% mais claro vira branco).
function ocrPreparar(src,alvo=2400){const lado=Math.max(src.width,src.height);const s=(lado>alvo||lado<1600)?alvo/lado:1;const c=document.createElement('canvas');c.width=Math.round(src.width*s);c.height=Math.round(src.height*s);const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingQuality='high';x.drawImage(src,0,0,c.width,c.height);
 const im=x.getImageData(0,0,c.width,c.height),d=im.data,h=new Uint32Array(256),n=d.length/4;for(let i=0;i<d.length;i+=4){const g=(d[i]*299+d[i+1]*587+d[i+2]*114)/1000|0;d[i]=g;h[g]++}
 let a=0,acc=0;while(a<254&&(acc+=h[a])<n*0.01)a++;let b=255;acc=0;while(b>a+1&&(acc+=h[b])<n*0.01)b--;const f=255/(b-a);
 for(let i=0;i<d.length;i+=4){const v=Math.max(0,Math.min(255,(d[i]-a)*f));d[i]=d[i+1]=d[i+2]=v}x.putImageData(im,0,0);return c}
// Qualidade da foto: brilho médio (0–255) e nitidez pela variância do Laplaciano numa cópia de 500 px.
function fotoQualidade(src){const k=Math.min(1,500/Math.max(src.width,src.height));const w=Math.max(3,Math.round(src.width*k)),h=Math.max(3,Math.round(src.height*k));const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,w,h);const d=x.getImageData(0,0,w,h).data;const g=new Float32Array(w*h);let soma=0;for(let i=0;i<w*h;i++){g[i]=(d[i*4]*299+d[i*4+1]*587+d[i*4+2]*114)/1000;soma+=g[i]}
 let m=0,m2=0,q=0;for(let y=1;y<h-1;y++)for(let xx=1;xx<w-1;xx++){const i=y*w+xx,l=4*g[i]-g[i-1]-g[i+1]-g[i-w]-g[i+w];m+=l;m2+=l*l;q++}const nitidez=q?m2/q-(m/q)**2:0,brilho=soma/(w*h);
 return {brilho,nitidez,escura:brilho<70,borrada:nitidez<60}}
function recorte(src,rx,ry,rw,rh,rot,max){const sw=Math.round(src.width*rw),sh=Math.round(src.height*rh),k=Math.min(1,max/Math.max(sw,sh));const w=Math.round(sw*k),h=Math.round(sh*k);const c=document.createElement('canvas');const x=c.getContext('2d');
 if(rot){c.width=h;c.height=w;x.translate(h/2,w/2);x.rotate(rot*Math.PI/180);x.drawImage(src,Math.round(src.width*rx),Math.round(src.height*ry),sw,sh,-w/2,-h/2,w,h)}else{c.width=w;c.height=h;x.drawImage(src,Math.round(src.width*rx),Math.round(src.height*ry),sw,sh,0,0,w,h)}return c}

// ---------- Código de barras e QR Code ----------
// Usa o BarcodeDetector do navegador (Chrome no Android) e completa com o ZXing, tentando a imagem inteira, faixas e a foto girada.
async function codigosLer(canvas){const achados=[];const add=(formato,texto)=>{texto=String(texto||'').trim();formato=String(formato||'').toLowerCase().replace(/[^a-z0-9]/g,'');if(texto&&!achados.some(a=>a.texto===texto))achados.push({formato,texto})};
 const completo=()=>achados.some(a=>a.formato==='code128')&&achados.some(a=>a.formato==='qrcode');
 if('BarcodeDetector' in window){try{const fmts=await BarcodeDetector.getSupportedFormats();const quer=['code_128','qr_code','itf'].filter(f=>fmts.includes(f));if(quer.length){const det=new BarcodeDetector({formats:quer});for(const r of await det.detect(canvas))add(r.format,r.rawValue)}}catch(e){console.warn('BarcodeDetector falhou:',e)}}
 if(!completo()){try{const Z=await loadLibrary(...LIB_ZXING);const hints=new Map();hints.set(Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.QR_CODE,Z.BarcodeFormat.CODE_128,Z.BarcodeFormat.ITF]);hints.set(Z.DecodeHintType.TRY_HARDER,true);const leitor=new Z.MultiFormatReader();leitor.setHints(hints);
  const regioes=[[0,0,1,1],[0,0,1,.5],[0,.5,1,.5],[0,0,1,.34],[0,.33,1,.34],[0,.66,1,.34],[.4,0,.6,.4]];
  for(const rot of [0,90])for(const [rx,ry,rw,rh] of regioes){if(completo())break;const c=recorte(canvas,rx,ry,rw,rh,rot,1800);try{const r=leitor.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(c))));add(Z.BarcodeFormat[r.getBarcodeFormat()],r.getText())}catch(e){}if(leitor.reset)leitor.reset()}}catch(e){console.warn('ZXing indisponível:',e.message)}}
 return achados}
// Chave de acesso de 44 dígitos (NF-e 55, NFC-e 65, CT-e 57/67, MDF-e 58): UF, ano e mês, CNPJ do emitente, modelo, série, número, tipo de emissão, código numérico e DV.
const UF_SIGLA={11:'RO',12:'AC',13:'AM',14:'RR',15:'PA',16:'AP',17:'TO',21:'MA',22:'PI',23:'CE',24:'RN',25:'PB',26:'PE',27:'AL',28:'SE',29:'BA',31:'MG',32:'ES',33:'RJ',35:'SP',41:'PR',42:'SC',43:'RS',50:'MS',51:'MT',52:'GO',53:'DF'};
const MODELO_NOME={55:'NF-e',65:'NFC-e',57:'CT-e',67:'CT-e OS',58:'MDF-e'};
// Dígito verificador: módulo 11, pesos 2 a 9 da direita para a esquerda; resto 0 ou 1 dá DV 0.
function chaveDV(c43){let s=0,p=2;for(let i=c43.length-1;i>=0;i--){s+=Number(c43[i])*p;p=p===9?2:p+1}const r=s%11;return r<2?0:11-r}
function chaveDecompor(ch){ch=String(ch||'').replace(/\D/g,'');if(ch.length!==44)return null;const uf=+ch.slice(0,2),mes=+ch.slice(4,6),mod=+ch.slice(20,22),dvOk=chaveDV(ch.slice(0,43))===+ch[43];
 return {chave:ch,dvOk,valida:dvOk&&!!UF_SIGLA[uf]&&mes>=1&&mes<=12&&!!MODELO_NOME[mod],uf,ufSigla:UF_SIGLA[uf]||'?',ano:2000+ +ch.slice(2,4),mes,cnpj:ch.slice(6,20),modelo:mod,modeloNome:MODELO_NOME[mod]||'modelo '+mod,serie:String(+ch.slice(22,25)),numero:String(+ch.slice(25,34)),tpEmis:+ch[34]}}
const chaveValida=ch=>!!chaveDecompor(ch)?.valida;
// Chaves no texto (OCR ou link), com e sem espaços. Se o OCR quebrou a chave, junta os dígitos que vêm depois de "CHAVE DE ACESSO".
function chavesDoTexto(t){const s=String(t||''),out=[];const ok=d=>{if(chaveValida(d)&&!out.includes(d))out.push(d)};
 for(const m of s.matchAll(/(?<!\d)(?:\d[ .]?){43}\d(?!\d)/g))ok(m[0].replace(/\D/g,''));
 if(!out.length){const i=s.search(/CHAVE\s+DE\s+ACESSO/i);if(i>=0){const dig=s.slice(i,i+260).replace(/\D/g,'');for(let k=0;k+44<=dig.length;k++)ok(dig.slice(k,k+44))}}
 return out}
// O que cada código lido significa. Boleto (ITF ou 44 dígitos que não fecham como chave) e PIX (conteúdo 000201...) são descartados.
function codigoInterpretar(c){const t=c.texto;
 if(/^000201/.test(t))return {tipo:'pix',descricao:'QR Code de PIX (ignorado)'};
 if(c.formato==='itf')return {tipo:'boleto',descricao:'código de barras de boleto (ignorado)'};
 if(/^https?:\/\//i.test(t)||/^www\./i.test(t)){const ch=chavesDoTexto(t)[0]||'';const nfse=(t.match(/(?<!\d)\d{50}(?!\d)/)||[])[0]||'';return {tipo:'url',url:/^www\./i.test(t)?'https://'+t:t,chave:ch,chaveNfse:nfse,descricao:'link de consulta'}}
 const d=t.replace(/\D/g,'');if(d.length===44&&!/[a-z]/i.test(t))return chaveValida(d)?{tipo:'chave',chave:d,descricao:c.formato==='qrcode'?'chave no QR Code':'chave no código de barras'}:{tipo:'boleto',descricao:'44 dígitos que não fecham como chave de nota (provável boleto, ignorado)'};
 const ch=chavesDoTexto(t)[0];if(ch)return {tipo:'chave',chave:ch,descricao:'chave no QR Code'};
 return {tipo:'outro',descricao:'código sem chave de nota'}}
// Resumo dos códigos de uma foto: a chave (o código de barras do DANFE tem preferência), o link e os avisos.
function codigosResumo(achados){const r={chave:'',fonte:'',url:'',chaveNfse:'',avisos:[],descartes:[],lidos:achados.length};const porFonte=[];
 for(const c of achados){const i=codigoInterpretar(c);if(i.tipo==='pix'||i.tipo==='boleto'){r.descartes.push(i.descricao);continue}if(i.tipo==='url'){if(!r.url)r.url=i.url;if(i.chaveNfse&&!r.chaveNfse)r.chaveNfse=i.chaveNfse}if(i.chave)porFonte.push({chave:i.chave,fonte:c.formato==='code128'?'código de barras':'QR Code'})}
 const barra=porFonte.find(x=>x.fonte==='código de barras'),qr=porFonte.find(x=>x.fonte==='QR Code');const esc=barra||qr;if(esc){r.chave=esc.chave;r.fonte=esc.fonte}
 if(barra&&qr&&barra.chave!==qr.chave)r.avisos.push(`A chave do código de barras (${barra.chave}) é diferente da chave do QR Code (${qr.chave}). Confira qual corresponde a esta nota.`);
 return r}

// ---------- Duplicidade pela chave ----------
// Procura a chave em toda a base pelo índice chaves/{chave}, que só confirma a existência (não revela a nota de outros projetos).
async function chaveJaLancada(key){if(!key)return null;const local=state.invoices.find(i=>i.key===key);if(local)return {local};if(state.chaves.some(c=>c.id===key))return {nuvem:true};
 if(nuvemConectada()&&Nuvem.perfil?.papel!=='obra'){try{const d=await window.__fb.get('chaves',key);if(d)return {nuvem:true,notaId:d.notaId}}catch(e){console.warn('Índice de chaves indisponível:',e.message)}}return null}
function duplicadaHtml(key,dup,origem){const nota=dup.local;return `<div class="notice danger">${esc(origem)}: esta nota já foi lançada (chave ${esc(key)}). Nenhuma entrada nova foi criada. ${nota?`<button class="btn sm" data-abrir-nota="${esc(nota.id)}" title="Abre a nota já lançada em Notas fiscais">Abrir a nota existente</button>`:'Ela pertence a projetos aos quais você não tem acesso; fale com quem administra esses projetos.'}</div>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-abrir-nota]');if(!b)return;selectedInvoiceId=b.dataset.abrirNota;invoiceTab='todas';go('invoices');renderInvoices();$('#distPanel')?.scrollIntoView({behavior:'smooth'})});

// ---------- Foto → nota em conferência ----------
// Lê a foto: códigos primeiro (exatos), depois OCR. Devolve o texto em linhas, como o PDF, para o mesmo parser.
async function fotoLer(file,aviso){aviso('Abrindo a foto '+file.name+'…');const img=await imagemCarregar(file);const q=fotoQualidade(img.canvas);
 aviso('Procurando código de barras e QR Code em '+file.name+'…');const cod=codigosResumo(await codigosLer(img.canvas));
 aviso('Lendo o texto de '+file.name+' (OCR em português). Pode levar até um minuto…');const ocr=await ocrCanvas(ocrPreparar(img.canvas));
 if(!cod.chave){const t=chavesDoTexto(ocr.texto)[0];if(t){cod.chave=t;cod.fonte='texto (OCR)'}}
 return {img,q,cod,ocr,linhas:ocr.linhas.map(l=>l.texto)}}
// Confiança do OCR para um valor extraído: a da linha em que ele aparece (0 se não foi achado).
function confiancaDe(lido,valor){const v=norm(valor).replace(/ /g,'');if(!v)return 0;const l=lido.ocr.linhas.find(x=>norm(x.texto).replace(/ /g,'').includes(v.slice(0,24)));return l?Math.round(l.confianca):0}
async function notaDaFoto(file,lido,tipo){const inv=await parsePDF(file,lido.linhas,{chave:lido.cod.chave||'',tolerante:true});inv.tipo=tipo;
 if(!inv.items.length){inv.items=itensCupom(lido.linhas);if(inv.items.length)inv.totalProducts=Math.round(inv.items.reduce((s,it)=>s+it.lineTotal,0)*100)/100}
 if(!inv.issuer)inv.issuer=emitenteCupom(lido.linhas);
 const fontes={};['number','series','date','issuer','issuerDoc','total'].forEach(k=>{fontes[k]=inv[k]?{f:'ocr',c:confiancaDe(lido,k==='total'?String(inv[k]).replace('.',','):k==='date'?inv[k].split('-').reverse().join('/'):inv[k])}:{f:'vazio'}});
 const dk=chaveDecompor(inv.key);if(dk?.valida){inv.number=dk.numero;inv.series=dk.serie;inv.issuerDoc=dk.cnpj;['number','series','issuerDoc'].forEach(k=>fontes[k]={f:'chave'});fontes.key={f:'chave',origem:lido.cod.fonte};
  if(inv.date&&(+inv.date.slice(0,4)!==dk.ano||+inv.date.slice(5,7)!==dk.mes))(inv._avisos=inv._avisos||[]).push(`A data lida (${inv.date.split('-').reverse().join('/')}) não cai no mês da chave (${String(dk.mes).padStart(2,'0')}/${dk.ano}). Confira a data de emissão.`)}
 else fontes.key={f:inv.key?'ocr':'vazio'};
 inv._foto={url:lido.img.url,nome:file.name};inv._fontes=fontes;inv._conf=Math.round(lido.ocr.confianca);inv._codigos=lido.cod;inv._avisos=(inv._avisos||[]).concat(lido.cod.avisos);if(lido.q.escura||lido.q.borrada)inv._avisos.push('A foto parece '+(lido.q.escura?'escura':'desfocada')+': a leitura pode ter falhas. Se possível, fotografe de novo em lugar claro, com a nota inteira e o celular firme.');
 if(dk?.valida&&dk.modelo!==55&&dk.modelo!==65)inv._avisos.push(`A chave é de ${dk.modeloNome}, não de nota de materiais. Confira se o documento certo foi enviado.`);
 inv.items=inv.items.map(it=>({...it}));inv.format='Foto/OCR';return inv}

// Cupom da NFC-e (layout de bobina): itens "001 CÓDIGO DESCRIÇÃO 1,000 UN X 18,90 18,90" e o emitente na primeira linha com nome.
function itensCupom(linhas){const re=/^\s*(\d{1,3})\s+(?:(\d{3,14})\s+)?(.+?)\s+(\d+(?:[.,]\d+)?)\s*([A-Za-z][A-Za-z0-9]{0,5})\.?\s*[xX×]\s*(\d{1,3}(?:\.\d{3})*,\d{2,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;const out=[];
 for(const l of linhas){const m=l.match(re);if(!m)continue;const quantity=brNumber(m[4]),unitPrice=brNumber(m[6]),lineTotal=brNumber(m[7]);if(!(quantity>0)||!(lineTotal>0))continue;out.push({code:m[2]||'',barcode:/^\d{8,14}$/.test(m[2]||'')?m[2]:'',description:m[3].trim(),ncm:'',cfop:'',unit:m[5].toUpperCase(),quantity,unitPrice,lineTotal,discount:0})}return out}
function emitenteCupom(linhas){const i=linhas.findIndex(l=>/CNPJ/i.test(l));const antes=(i>0?linhas.slice(0,i):linhas.slice(0,4));return (antes.find(l=>/[A-Za-zÀ-ú]{3,}\s+[A-Za-zÀ-ú]{2,}/.test(l)&&!/DANFE|DOCUMENTO AUXILIAR|CONSUMIDOR/i.test(l))||'').trim()}
// ---------- Conferência com a foto ao lado ----------
const FOTO_CAMPOS=[['key','Chave de acesso (44 dígitos)'],['number','Número'],['series','Série'],['date','Data de emissão'],['issuer','Emitente'],['issuerDoc','CNPJ/CPF do emitente'],['totalProducts','Total dos produtos'],['discount','Descontos'],['total','Total da nota']];
function fonteSelo(inv,k){const f=inv._fontes?.[k];if(!f)return '';if(f.f==='chave')return `<span class="selo-fonte exato" title="Valor exato, tirado da chave de acesso${f.origem?' lida no '+esc(f.origem):''}">exato</span>`;if(f.f==='vazio')return '<span class="selo-fonte falta" title="Não foi possível ler este campo na foto. Preencha olhando a imagem">preencher</span>';if(f.f==='editado')return '<span class="selo-fonte editado" title="Valor digitado na conferência">conferido</span>';if(f.f==='consulta')return `<span class="selo-fonte ${f.c<75?'baixa':'consulta'}" title="Lido do conteúdo da consulta (${esc(f.adaptador||'')}, confiança ${f.c}%). Confira com a página">consulta ${f.c}%</span>`;return `<span class="selo-fonte ${f.c<75?'baixa':'ocr'}" title="Lido por OCR${f.c?' (confiança '+f.c+'%)':''}. ${f.c<75?'Confiança baixa: confira com atenção na foto.':'Confira com a foto.'}">OCR${f.c?' '+f.c+'%':''}</span>`}
function previewFoto(inv,ii){const dk=chaveDecompor(inv.key);const c=inv._codigos||{};const tot=inv.items.reduce((s,it)=>s+Number(it.lineTotal||0),0);const desc=inv.items.reduce((s,it)=>s+Number(it.discount||0),0);
 const campo=(k,l)=>{const v=inv[k]??'';const tipo=k==='date'?'date':['totalProducts','discount','total'].includes(k)?'number':'text';const f=inv._fontes?.[k]?.f;return `<div class="field campo-foto ${f==='vazio'?'vazio':''} ${f==='ocr'&&inv._fontes[k].c<75?'baixa':''}"><label>${l} ${fonteSelo(inv,k)}</label><input data-fh="${k}" data-i="${ii}" type="${tipo}"${tipo==='number'?' step="0.01" min="0"':''} value="${esc(v)}"${k==='key'?' inputmode="numeric" maxlength="54"':''} title="${k==='key'?'Ao corrigir a chave, número, série e CNPJ são preenchidos a partir dela':'Confira com a foto ao lado'}"></div>`};
 const chaveInfo=inv.key?(dk?(dk.valida?`<span class="hint">✓ ${esc(dk.modeloNome)} · ${esc(dk.ufSigla)} · ${String(dk.mes).padStart(2,'0')}/${dk.ano} · série ${esc(dk.serie)} · nº ${esc(dk.numero)}</span>`:`<span class="hint erro-txt">${dk.dvOk?'Chave com UF, mês ou modelo impossível':'Dígito verificador não confere: algum número está errado'}</span>`):'<span class="hint erro-txt">A chave precisa ter 44 dígitos.</span>'):'';
 const avisos=(inv._avisos||[]).map(a=>`<div class="notice">${esc(a)}</div>`).join('')+(c.descartes?.length?`<p class="hint">Códigos ignorados: ${esc(c.descartes.join('; '))}.</p>`:'');
 const itens=inv.items.map((it,j)=>`<tr><td><input data-fi="description" data-i="${ii}" data-j="${j}" value="${esc(it.description)}" placeholder="Descrição" style="min-width:200px;width:100%"></td><td><input data-fi="code" data-i="${ii}" data-j="${j}" value="${esc(it.code||'')}" style="width:90px"></td><td><input data-fi="unit" data-i="${ii}" data-j="${j}" value="${esc(it.unit||'UN')}" style="width:56px"></td><td class="num"><input type="number" step="0.0001" min="0" data-fi="quantity" data-i="${ii}" data-j="${j}" value="${it.quantity??''}" style="width:84px"></td><td class="num"><input type="number" step="0.0001" min="0" data-fi="unitPrice" data-i="${ii}" data-j="${j}" value="${it.unitPrice??''}" style="width:96px"></td><td class="num"><span class="calc" title="Fórmula: quantidade × valor unitário = ${num(it.quantity)} × ${money(it.unitPrice)}">${money(it.lineTotal)}</span></td><td class="num"><input type="number" step="0.01" min="0" data-fi="discount" data-i="${ii}" data-j="${j}" value="${it.discount||0}" style="width:80px"></td><td><button class="btn sm" data-f-del="${j}" data-i="${ii}" title="Retira este item da nota">✕</button></td></tr>`).join('');
 const dif=Number(inv.total||0)-(tot-desc);
 return `<div class="prev-foto" style="margin-bottom:24px"><div class="row"><strong>${inv.number?'NF '+esc(inv.number):'Nota sem número'} • ${esc(inv.issuer||'Emitente não identificado')}</strong>${tipoEscolha(inv,ii)}<span class="pill warn" title="${inv._foto?'Dados lidos de uma foto: confira tudo com a imagem':'Dados lidos da página de consulta: confira com a página'}">${inv._foto?'Foto/OCR':'Consulta'}${inv._conf?' · confiança '+(inv._foto?'média ':'')+inv._conf+'%':''}</span><button class="btn sm" data-f-descartar="${ii}" title="Tira esta foto da conferência sem gravar nada">Descartar</button></div>
 ${avisos}<div class="foto-grid${inv._foto?'':' sem-foto'}">${inv._foto?`<div class="foto-box"><div class="foto-ctl"><button class="btn sm" data-f-zoom="${ii}" data-z="-1" title="Diminui a imagem">−</button><button class="btn sm" data-f-zoom="${ii}" data-z="1" title="Aumenta a imagem; arraste a área para navegar">+</button><a class="btn sm" href="${esc(inv._foto.url)}" target="_blank" rel="noopener" title="Abre a foto em tamanho original numa nova aba">Abrir em nova aba</a>${c.url?consultaBotao(c.url)+`<button class="btn sm" data-usar-consulta="${ii}" title="Leva o link para o painel de consulta, para importar a página salva ou colar o conteúdo; os dados completam esta nota">Aproveitar a consulta</button>`:''}</div><div class="foto-vista" data-f-vista="${ii}"><img src="${esc(inv._foto.url)}" alt="Foto da nota ${esc(inv._foto.nome)}" style="width:${inv._zoom||100}%"></div><p class="hint">${esc(inv._foto.nome)}${c.lidos?' · '+c.lidos+' código(s) lido(s)':' · nenhum código lido'}${c.chave?' · chave pelo '+esc(c.fonte):''}${c.url?' · link: '+esc(consultaOrigem(c.url).rotulo):''}</p></div>`:(c.url?`<div class="row" style="grid-column:1/-1">${consultaBotao(c.url)} <span class="pill">${esc(consultaOrigem(c.url).rotulo)}</span></div>`:'')}
 <div><div class="grid campos-foto">${FOTO_CAMPOS.map(([k,l])=>campo(k,l)).join('')}</div>${chaveInfo}
 <p class="hint" style="margin:8px 0">Selos: <span class="selo-fonte exato">exato</span> veio da chave · <span class="selo-fonte ocr">OCR</span> lido da foto · <span class="selo-fonte baixa">OCR baixo</span> confira com atenção · <span class="selo-fonte falta">preencher</span> não foi lido${inv._conferir||Object.values(inv._fontes||{}).some(f=>f.f==='consulta')?' · <span class="selo-fonte consulta">consulta</span> veio da página de consulta':''}.</p>
 ${Math.abs(dif)>0.05&&inv.items.length?`<div class="notice"><span class="calc" title="Fórmula: total da nota − (soma dos itens − descontos) = ${money(inv.total)} − (${money(tot)} − ${money(desc)})">Diferença de ${money(dif)}</span> entre o total da nota e os itens. Pode ser frete, seguro ou imposto (ele é rateado entre os itens), ou um item faltando.</div>`:''}</div></div>
 <div class="tablewrap" style="margin-top:12px"><table class="no-sort"><thead><tr><th>Descrição</th><th>Código</th><th>Unid.</th><th class="num">Quantidade</th><th class="num">Valor unit.</th><th class="num">Valor bruto</th><th class="num">Desconto</th><th></th></tr></thead><tbody>${itens||'<tr><td colspan="8" class="muted">Nenhum item reconhecido na foto. Inclua os itens olhando a imagem.</td></tr>'}</tbody></table></div>
 <button class="btn sm" data-f-add="${ii}" style="margin-top:8px" title="Inclui uma linha de item para preencher">+ Incluir item</button></div>`}
function fotoAplicarChave(inv){const dk=chaveDecompor(inv.key);if(!dk?.valida)return;inv.number=dk.numero;inv.series=dk.serie;inv.issuerDoc=dk.cnpj;inv.id=inv.key;['number','series','issuerDoc','key'].forEach(k=>inv._fontes[k]={f:'chave',origem:'chave digitada'})}
document.addEventListener('change',e=>{const t=e.target;const h=t.closest('[data-fh]'),it=t.closest('[data-fi]');if(!h&&!it)return;const inv=draft[+t.dataset.i];if(!inv)return;
 if(h){const k=h.dataset.fh;let v=t.value;if(['totalProducts','discount','total'].includes(k))v=Number(v)||0;if(k==='key')v=String(v).replace(/\D/g,'');inv[k]=v;inv._fontes[k]={f:'editado'};if(k==='key'){inv.id=v;fotoAplicarChave(inv)}}
 else{const x=inv.items[+t.dataset.j],k=it.dataset.fi;x[k]=['quantity','unitPrice','discount'].includes(k)?Number(t.value)||0:t.value;x.lineTotal=Math.round(Number(x.quantity||0)*Number(x.unitPrice||0)*100)/100;inv.totalProducts=Math.round(inv.items.reduce((s,y)=>s+Number(y.lineTotal||0),0)*100)/100;inv.discount=Math.round(inv.items.reduce((s,y)=>s+Number(y.discount||0),0)*100)/100}
 renderPreview()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-f-add],[data-f-del],[data-f-zoom],[data-f-descartar]');if(!b)return;const inv=draft[+b.dataset.i??+b.dataset.fAdd];
 if(b.dataset.fAdd!=null){draft[+b.dataset.fAdd].items.push({code:'',barcode:'',description:'',unit:'UN',quantity:1,unitPrice:0,lineTotal:0,discount:0});renderPreview();return}
 if(b.dataset.fDel!=null){inv.items.splice(+b.dataset.fDel,1);renderPreview();return}
 if(b.dataset.fZoom!=null){const n=draft[+b.dataset.fZoom];n._zoom=Math.max(50,Math.min(400,(n._zoom||100)+(+b.dataset.z)*50));renderPreview();return}
 if(b.dataset.fDescartar!=null){const n=draft[+b.dataset.fDescartar];if(n?._foto)URL.revokeObjectURL(n._foto.url);draft.splice(+b.dataset.fDescartar,1);renderPreview()}});
// Campos de trabalho da conferência que não vão para a base.
const CAMPOS_CONFERENCIA=['_foto','_fontes','_conf','_codigos','_avisos','_faltas','_zoom','_conferir'];
// ==== #JS-IMAGEM: END ====
