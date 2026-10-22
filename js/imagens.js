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
 let bmp;try{bmp=await createImageBitmap(blob,{imageOrientation:'from-image'})}catch(e){
  // Foto "Ultra HDR" (Samsung, Pixel): depois da imagem principal vêm o mapa de ganho e um trailer, e o navegador pode recusar o arquivo inteiro.
  // Nova tentativa só com a imagem principal (do início até o fim dela), mantendo os metadados, inclusive a orientação.
  const base=await jpegPrincipal(blob);if(!base)throw new Error('O arquivo não parece ser uma imagem válida.');blob=base;
  try{bmp=await createImageBitmap(blob,{imageOrientation:'from-image'})}catch(e2){throw new Error('O arquivo não parece ser uma imagem válida.')}}
 const k=Math.min(1,ladoMax/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);if(bmp.close)bmp.close();
 return {canvas:c,url:URL.createObjectURL(blob),blob}}
// JPEG só até o fim da imagem principal: percorre os segmentos até o início dos dados (SOS) e procura o marcador de fim (FFD9).
// Dentro dos dados, o byte FF sempre vem seguido de 00 ou de um marcador de reinício (D0–D7), então o primeiro FFD9 é o fim da imagem.
async function jpegPrincipal(blob){const b=new Uint8Array(await blob.arrayBuffer());if(b[0]!==0xFF||b[1]!==0xD8)return null;let i=2;
 while(i+4<b.length){if(b[i]!==0xFF)return null;const m=b[i+1];if(m===0xD8||(m>=0xD0&&m<=0xD7)){i+=2;continue}const len=(b[i+2]<<8)|b[i+3];if(m===0xDA){i+=2+len;break}i+=2+len}
 for(;i<b.length-1;i++)if(b[i]===0xFF&&b[i+1]===0xD9)return i+2<b.length?new Blob([b.subarray(0,i+2)],{type:'image/jpeg'}):null;return null}
// Para o Tesseract: lado maior perto de 2400 px, tons de cinza e contraste esticado (1% mais escuro vira preto, 1% mais claro vira branco).
function ocrPreparar(src,alvo=2400){const lado=Math.max(src.width,src.height);const s=(lado>alvo||lado<1600)?alvo/lado:1;const c=document.createElement('canvas');c.width=Math.round(src.width*s);c.height=Math.round(src.height*s);const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingQuality='high';x.drawImage(src,0,0,c.width,c.height);
 const im=x.getImageData(0,0,c.width,c.height),d=im.data,h=new Uint32Array(256),n=d.length/4;for(let i=0;i<d.length;i+=4){const g=(d[i]*299+d[i+1]*587+d[i+2]*114)/1000|0;d[i]=g;h[g]++}
 let a=0,acc=0;while(a<254&&(acc+=h[a])<n*0.01)a++;let b=255;acc=0;while(b>a+1&&(acc+=h[b])<n*0.01)b--;const f=255/(b-a);
 for(let i=0;i<d.length;i+=4){const v=Math.max(0,Math.min(255,(d[i]-a)*f));d[i]=d[i+1]=d[i+2]=v}x.putImageData(im,0,0);return c}
// Qualidade da foto: brilho médio (0–255) e nitidez pela variância do Laplaciano numa cópia de 500 px.
function fotoQualidade(src){const k=Math.min(1,500/Math.max(src.width,src.height));const w=Math.max(3,Math.round(src.width*k)),h=Math.max(3,Math.round(src.height*k));const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,w,h);const d=x.getImageData(0,0,w,h).data;const g=new Float32Array(w*h);let soma=0;for(let i=0;i<w*h;i++){g[i]=(d[i*4]*299+d[i*4+1]*587+d[i*4+2]*114)/1000;soma+=g[i]}
 let m=0,m2=0,q=0;for(let y=1;y<h-1;y++)for(let xx=1;xx<w-1;xx++){const i=y*w+xx,l=4*g[i]-g[i-1]-g[i+1]-g[i-w]-g[i+w];m+=l;m2+=l*l;q++}const nitidez=q?m2/q-(m/q)**2:0,brilho=soma/(w*h);
 const lado=Math.max(src.width,src.height);return {brilho,nitidez,escura:brilho<70,borrada:nitidez<60,lado,pequena:lado<1500}}
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
// Leitor nativo do navegador (Chrome no Android) na foto em resolução cheia, antes de reduzir: no DANFE fotografado inteiro,
// as barras do código ficam finas demais depois da redução. Devolve os códigos achados (vazio se não houver o leitor nativo).
async function codigosAltaResolucao(file){if(!('BarcodeDetector' in window))return [];let bmp;try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){const b=await jpegPrincipal(file).catch(()=>null);if(!b)return [];try{bmp=await createImageBitmap(b,{imageOrientation:'from-image'})}catch(e2){return []}}
 try{const fmts=await BarcodeDetector.getSupportedFormats();const quer=['code_128','qr_code','itf'].filter(f=>fmts.includes(f));if(!quer.length)return [];const det=new BarcodeDetector({formats:quer});return (await det.detect(bmp)).map(x=>({formato:String(x.format).replace(/[^a-z0-9]/gi,'').toLowerCase(),texto:String(x.rawValue||'').trim()})).filter(x=>x.texto)}catch(e){console.warn('Leitor nativo falhou:',e);return []}finally{if(bmp.close)bmp.close()}}
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
// ==== #JS-CHAVE-TEXTO: START ====
// Chave reconstruída do texto, para navegadores sem leitor nativo de código de barras (Firefox, Brave).
// O OCR da faixa de cima da foto lê os 11 grupos da chave com poucos erros (3↔8, 2↔5, 0↔6, dígito a mais).
// A correção usa o que a própria nota diz, sem adivinhar: número e série lidos em letra grande no cabeçalho, mês e ano da
// emissão, os dígitos verificadores do CNPJ e o dígito verificador da chave. Só aceita um resultado sem ambiguidade.
const CONFUSAO={0:'6895',1:'74',2:'573',3:'8924',4:'1390',5:'2638',6:'0589',7:'124',8:'36095',9:'8430'};
function cnpjValido(c){if(!/^\d{14}$/.test(c)||/^(\d)\1+$/.test(c))return false;const dv=(n,p)=>{let s=0;for(let i=0;i<p.length;i++)s+=Number(n[i])*p[i];const r=s%11;return r<2?0:11-r};const p1=[5,4,3,2,9,8,7,6,5,4,3,2],p2=[6,5,4,3,2,9,8,7,6,5,4,3,2];return dv(c,p1)===+c[12]&&dv(c,p2)===+c[13]}
// variações de uma sequência trocando até `max` dígitos por confusões comuns, nas posições dadas
function variacoes(seq,posicoes,max){const out=[];const passo=(s,ini,n)=>{out.push({s,n});if(n>=max)return;for(let k=ini;k<posicoes.length;k++){const i=posicoes[k];for(const c of CONFUSAO[s[i]]||'')passo(s.slice(0,i)+c+s.slice(i+1),k+1,n+1)}};passo(seq,0,0);return out}
function chaveReconstruir(grupos,texto,diag){const g=grupos.map(x=>x.replace(/\D/g,'')).filter(Boolean);if(g.length<10||g.length>12)return null;
 // grupos de 5 dígitos: um deles sobra (testa tirar cada um); grupos de 4 ficam como estão
 let bases=[''];for(const x of g){const op=x.length===4?[x]:x.length===5?[...new Set([...x].map((_,i)=>x.slice(0,i)+x.slice(i+1)))]:x.length===3?[x]:[x];const nb=[];for(const b of bases)for(const o of op)nb.push(b+o);bases=nb.slice(0,64)}
 const T=String(texto||'');const sigla=(T.match(/-\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/)||[])[1];const ufTexto=sigla?Object.keys(UF_SIGLA).find(c=>UF_SIGLA[c]===sigla):'';const nn=T.match(/N[º°o.]?\s*(\d{3})\.(\d{3})\.(\d{3})/);const se=T.match(/S[ÉE]RIE\s*(\d{1,3})/i);
 const resultados=new Map();
 for(let b of bases){if(b.length!==44)continue;
  if(nn)b=b.slice(0,25)+(nn[1]+nn[2]+nn[3]).padStart(9,'0')+b.slice(34);if(se)b=b.slice(0,22)+se[1].padStart(3,'0')+b.slice(25);
  const mes=(T.match(/(\d{2})\/(\d{2})\/(20\d{2})/g)||[]).map(d=>d.slice(8,10)+d.slice(3,5));if(mes.length&&!mes.includes(b.slice(2,6))){const m=mes.find(x=>x===b.slice(2,6))||mes[0];b=b.slice(0,2)+m+b.slice(6)}
  if(/DANFE|NF-?e/i.test(T)&&b.slice(20,22)!=='55')b=b.slice(0,20)+'55'+b.slice(22);
  if(ufTexto&&b.slice(0,2)!==ufTexto)b=ufTexto+b.slice(2);
  // CNPJ (posições 6 a 19) com os próprios dígitos verificadores
  const cnpjs=cnpjValido(b.slice(6,20))?[{s:b.slice(6,20),n:0}]:variacoes(b.slice(6,20),[...Array(14).keys()],2).filter(v=>cnpjValido(v.s));
  for(const c of cnpjs){const b2=b.slice(0,6)+c.s+b.slice(20);
   // resto: UF, tipo de emissão, código numérico e DV
   for(const v of variacoes(b2,[0,1,34,35,36,37,38,39,40,41,42,43],1)){if(chaveValida(v.s)){const custo=c.n+v.n;const ant=resultados.get(v.s);if(ant==null||custo<ant)resultados.set(v.s,custo)}}}}
 const lista=[...resultados.entries()].sort((a,b)=>a[1]-b[1]);if(diag)return lista.slice(0,8);if(!lista.length)return null;
 // Com 2 ou mais dígitos errados, dezenas de chaves diferentes também fecham os dígitos verificadores (teste de 19/10 com foto real):
 // só aceita no máximo 1 correção e sem empate; senão não decide. diag=true devolve as candidatas, para análise.
 if(lista[0][1]>1)return null;if(lista.length>1&&lista[1][1]===lista[0][1])return null;return {chave:lista[0][0],correcoes:lista[0][1]}}
// OCR da faixa de cima da foto (onde o DANFE traz a chave) e reconstrução a partir dos grupos de 4 dígitos.
async function chaveDoTextoFocado(file,textoPagina){let bmp;try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){const b=await jpegPrincipal(file).catch(()=>null);if(!b)return null;try{bmp=await createImageBitmap(b,{imageOrientation:'from-image'})}catch(e2){return null}}
 try{const W=bmp.width,H=bmp.height,larg=Math.min(3000,W),k=larg/W;const c=document.createElement('canvas');c.width=larg;c.height=Math.round(H*0.35*k);c.getContext('2d').drawImage(bmp,0,0,W,H*0.35,0,0,c.width,c.height);
  const w=await getOcrWorker();const o=await w.recognize(ocrPreparar(c,larg));const texto=(o.data.text||'')+'\n'+(textoPagina||'');
  const direta=chavesDoTexto(o.data.text)[0];if(direta)return {chave:direta,correcoes:0};
  for(const l of (o.data.lines||[])){const grupos=(String(l.text).match(/\d{3,5}/g)||[]);if(grupos.length<10)continue;const ini=grupos.length>11?grupos.length-11:0;const r=chaveReconstruir(grupos.slice(ini),texto)||chaveReconstruir(grupos,texto);if(r)return r}
  return null}catch(e){console.warn('Leitura focada da chave falhou:',e);return null}finally{if(bmp.close)bmp.close()}}
// ==== #JS-CHAVE-TEXTO: END ====
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

// Boleto bancário enviado no lugar da nota: linha digitável (47 dígitos em blocos) ou ficha de compensação, sem chave de nota.
const MSG_BOLETO='este arquivo é um boleto bancário, não uma nota fiscal. O boleto não traz chave de acesso nem itens. Importe o XML, o PDF do DANFE ou a foto da nota correspondente; se a compra não teve nota, peça a nota ao fornecedor.';
function ehBoleto(texto){const t=String(texto||'');const linha=/\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d{5}\.\d{6}\s+\d\s+\d{14}/.test(t);const ficha=/Ficha de Compensa[çc][ãa]o|Nosso N[úu]mero|Local de Pagamento|Recibo do Pagador/i.test(t);return (linha||ficha)&&!chavesDoTexto(t).length&&!/DANFE|DOCUMENTO AUXILIAR/i.test(t)}
// DANFE da NFC-e (cupom) em PDF ou foto: "CNPJ: ... NOME", "NFC-e nº 000002625 Série 3 17/09/2026", itens entre o cabeçalho
// "Código Descrição Qtd" e "Qtde. total de itens". Colunas estreitas quebram o código e o valor do item em linhas seguintes
// ("HQ227 ... 1 799,9 799,99" / "7-600- 9 PR" / "11"): o código é remontado, a unidade sai da continuação e o valor unitário
// é conferido pelo total do item.
function nfceDeLinhas(linhas){const T=linhas.join('\n');const o={items:[]};
 const i0=linhas.findIndex(l=>/CNPJ[:\s]*\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/i.test(l));
 if(i0>=0){const m=linhas[i0].match(/CNPJ[:\s]*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\s*(.*)$/i);o.issuerDoc=m[1].replace(/\D/g,'');const partes=[m[2].trim()];
  // o nome vem depois do CNPJ ("CNPJ: ... NOME", como na Linx) ou na linha de cima (cupom comum)
  if(partes[0])for(let k=i0+1;k<Math.min(linhas.length,i0+4);k++){const l=linhas[k].trim();if(!l||/^(AV|AVENIDA|RUA|R\.|ROD|AL|ALAMEDA|TRAV|EST|PRA[ÇC]A|BR)\b/i.test(l)||/Documento Auxiliar|Consumidor|\d{5}-?\d{3}|,\s*\d/i.test(l))break;partes.push(l)}
  else if(i0>0&&/[A-Za-zÀ-ú]{3,}/.test(linhas[i0-1])&&!/Documento Auxiliar|Consumidor|DANFE/i.test(linhas[i0-1]))partes[0]=linhas[i0-1].trim();
  o.issuer=partes.filter(Boolean).join(' ').replace(/\s+/g,' ').trim()}
 if(!o.issuer){const l=linhas.find(x=>/LTDA|EIRELI|S\.?A\.?\b|\bME\b|COMERCIO|COM[ÉE]RCIO/i.test(x));if(l)o.issuer=l.replace(/CNPJ.*$/i,'').trim()}
 const nn=T.match(/NFC-?e\s*n[ºo°.]?\s*(\d+)\s*S[ée]rie[:\s]*(\d+)\s*(\d{2})\/(\d{2})\/(\d{4})/i);if(nn){o.number=String(+nn[1]);o.series=String(+nn[2]);o.date=`${nn[5]}-${nn[4]}-${nn[3]}`}
 if(!o.date){const d=T.match(/Emiss[ãa]o[:\s]*(\d{2})\/(\d{2})\/(\d{4})/i);if(d)o.date=`${d[3]}-${d[2]}-${d[1]}`}
 const din='(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';const tp=T.match(new RegExp('Valor\\s+a\\s+pagar[^\\d\\n]{0,12}\\n?[^\\d\\n]{0,6}'+din,'i'))||T.match(new RegExp('Valor\\s+total\\s*R?\\$?\\s*'+din,'i'));if(tp)o.total=brNumber(tp[1]);
 const ds=T.match(new RegExp('Desconto[s]?\\s*R?\\$?\\s*'+din,'i'));if(ds)o.discount=brNumber(ds[1]);
 // itens
 let a=linhas.findIndex(l=>/C[óo]digo\s+Descri[çc][ãa]o/i.test(l));let b=linhas.findIndex((l,k)=>k>a&&/Qtde?\.?\s*total\s*de\s*itens|Valor\s+(?:total|itens)/i.test(l));if(a<0)a=-1;if(b<0)b=linhas.length;
 const reItem=/^(\S+)\s+(.+?)\s+(\d+(?:,\d{1,4})?)\s+(?:([A-Za-z]{1,4})\s+)?(\d{1,3}(?:\.\d{3})*,\d{1,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/;
 let atual=null;for(let k=a+1;k<b;k++){const l=linhas[k].replace(/\s+/g,' ').trim();if(!l||/^UN\s+Unit/i.test(l))continue;const m=l.match(reItem);
  if(m&&!/^(Vl|Valor|Qtd)/i.test(m[1])){atual={code:m[1],barcode:'',description:m[2].trim(),ncm:'',cfop:'',unit:(m[4]||'UN').toUpperCase(),quantity:brNumber(m[3]),unitPrice:brNumber(m[5]),lineTotal:brNumber(m[6]),discount:0,_un:!!m[4]};o.items.push(atual);continue}
  if(!atual)continue;const tk=l.split(' ');if(!atual._un&&/^[A-Z]{1,4}$/.test(tk[tk.length-1])){atual.unit=tk.pop();atual._un=true}
  if(tk.length&&/[\d-]/.test(tk[0])&&!/^\d+,\d+$/.test(tk[0]))atual.code+=tk.shift()}
 o.items.forEach(it=>{delete it._un;if(/^\d{8,14}$/.test(it.code))it.barcode=it.code;if(it.quantity>0&&Math.abs(it.quantity*it.unitPrice-it.lineTotal)>0.011)it.unitPrice=Math.round(it.lineTotal/it.quantity*10000)/10000});
 return o}
// PDF de NFC-e → nota na conferência editável (como a foto, sem a imagem), com a chave exata e o restante marcado como lido do PDF.
async function notaNfceDoPdf(file,linhas,tipo){const ch=chavesDoTexto(linhas.join('\n'))[0]||'';const n=nfceDeLinhas(linhas);const dk=chaveDecompor(ch);const soma=n.items.reduce((s,i)=>s+i.lineTotal,0);const bate=n.total&&Math.abs(soma-(n.total+(n.discount||0)))<0.05;const conf=n.items.length?(bate?92:70):45;
 const fontes={};['issuer','date','total','discount'].forEach(k=>{if(n[k])fontes[k]={f:'pdf',c:conf};else if(k!=='discount')fontes[k]={f:'vazio'}});
 const inv={id:ch,key:ch,number:dk?.valida?dk.numero:n.number||'',series:dk?.valida?dk.serie:n.series||'',date:n.date||'',operation:'VENDA AO CONSUMIDOR',issuer:n.issuer||'',issuerDoc:dk?.valida?dk.cnpj:n.issuerDoc||'',recipient:'',totalProducts:Math.round(soma*100)/100,discount:n.discount||0,total:n.total||0,source:file.name,format:'PDF/NFC-e',tipo,protocolStatus:'Dados lidos do PDF da NFC-e; autorização não validada na SEFAZ. Confira com o documento.',items:n.items,
  _conferir:true,_fontes:{...fontes,...(dk?.valida?{key:{f:'chave',origem:'PDF'},number:{f:'chave'},series:{f:'chave'},issuerDoc:{f:'chave'}}:{key:{f:ch?'pdf':'vazio',c:conf}})},_conf:conf,_codigos:{url:(linhas.join(' ').match(/https?:\/\/\S*nfce\S*/i)||[])[0]||'',lidos:0},
  _avisos:[`Lido do PDF da NFC-e (confiança ${conf}%). ${n.items.length?(bate?'Os itens somam o valor da nota.':'A soma dos itens não fecha com o total: confira.'):'Nenhum item reconhecido: inclua os itens olhando o PDF.'}`]};
 return inv}
// ---------- Duplicidade pela chave ----------
// Procura a chave em toda a base pelo índice chaves/{chave}, que só confirma a existência (não revela a nota de outros projetos).
async function chaveJaLancada(key){if(!key)return null;const local=state.invoices.find(i=>i.key===key);if(local)return {local};if(state.chaves.some(c=>c.id===key))return {nuvem:true};
 if(nuvemConectada()&&Nuvem.perfil?.papel!=='obra'){try{const d=await window.__fb.get('chaves',key);if(d)return {nuvem:true,notaId:d.notaId}}catch(e){console.warn('Índice de chaves indisponível:',e.message)}}return null}
function duplicadaHtml(key,dup,origem){const nota=dup.local;return `<div class="notice danger">${esc(origem)}: esta nota já foi lançada (chave ${esc(key)}). Nenhuma entrada nova foi criada. ${nota?`<button class="btn sm" data-abrir-nota="${esc(nota.id)}" title="Abre a nota já lançada em Notas fiscais">Abrir a nota existente</button>`:'Ela pertence a projetos aos quais você não tem acesso; fale com quem administra esses projetos.'}</div>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-abrir-nota]');if(!b)return;selectedInvoiceId=b.dataset.abrirNota;invoiceTab='todas';go('invoices');renderInvoices();$('#distPanel')?.scrollIntoView({behavior:'smooth'})});

// ---------- Foto → nota em conferência ----------
// Lê a foto: códigos primeiro (exatos), depois OCR. Devolve o texto em linhas, como o PDF, para o mesmo parser.
async function fotoLer(file,aviso){aviso('Abrindo a foto '+file.name+'…');const img=await imagemCarregar(file);const q=fotoQualidade(img.canvas);
 aviso('Procurando código de barras e QR Code em '+file.name+'…');let cod=codigosResumo(await codigosAltaResolucao(file));if(!cod.chave)cod=codigosResumo(await codigosLer(img.canvas));
 aviso('Lendo o texto de '+file.name+' (OCR em português). Pode levar até um minuto…');const ocr=await ocrCanvas(ocrPreparar(img.canvas));
 if(!cod.chave){const t=chavesDoTexto(ocr.texto)[0];if(t){cod.chave=t;cod.fonte='texto (OCR)'}}
 if(!cod.chave){aviso('Procurando a chave impressa em '+file.name+'…');const f=await chaveDoTextoFocado(file,ocr.texto);if(f){cod.chave=f.chave;cod.fonte=f.correcoes?'texto da chave, com '+f.correcoes+' dígito(s) corrigido(s)':'texto da chave';cod.reconstruida=f.correcoes>0}}
 return {img,q,cod,ocr,linhas:ocr.linhas.map(l=>l.texto)}}
// Confiança do OCR para um valor extraído: a da linha em que ele aparece (0 se não foi achado).
function confiancaDe(lido,valor){const v=norm(valor).replace(/ /g,'');if(!v)return 0;const l=lido.ocr.linhas.find(x=>norm(x.texto).replace(/ /g,'').includes(v.slice(0,24)));return l?Math.round(l.confianca):0}
async function notaDaFoto(file,lido,tipo){const inv=await parsePDF(file,lido.linhas,{chave:lido.cod.chave||'',tolerante:true});inv.tipo=tipo;
 if(chaveDecompor(lido.cod.chave)?.modelo===65||/Consumidor Eletr/i.test(lido.ocr.texto)){const n=nfceDeLinhas(lido.linhas);if(!inv.items.length&&n.items.length)inv.items=n.items;['issuer','date','total'].forEach(k=>{if(!inv[k]&&n[k])inv[k]=n[k]});if(!inv.number&&n.number)inv.number=n.number;if(!inv.series&&n.series)inv.series=n.series}
 if(!inv.items.length){inv.items=itensCupom(lido.linhas);if(inv.items.length)inv.totalProducts=Math.round(inv.items.reduce((s,it)=>s+it.lineTotal,0)*100)/100}
 const cupom=chaveDecompor(lido.cod.chave)?.modelo===65||/Consumidor Eletr/i.test(lido.ocr.texto);if(!inv.issuer&&cupom){const e=emitenteCupom(lido.linhas);if(e&&confiancaDe(lido,e)>=70)inv.issuer=e}
 const fontes={};['number','series','date','issuer','issuerDoc','total'].forEach(k=>{fontes[k]=inv[k]?{f:'ocr',c:confiancaDe(lido,k==='total'?String(inv[k]).replace('.',','):k==='date'?inv[k].split('-').reverse().join('/'):inv[k])}:{f:'vazio'}});
 const dk=chaveDecompor(inv.key);if(dk?.valida){inv.number=dk.numero;inv.series=dk.serie;inv.issuerDoc=dk.cnpj;const rec=lido.cod.reconstruida;['number','series','issuerDoc'].forEach(k=>fontes[k]=rec?{f:'ocr',c:60}:{f:'chave'});fontes.key=rec?{f:'ocr',c:60}:{f:'chave',origem:lido.cod.fonte};
  if(rec)(inv._avisos=inv._avisos||[]).push('A chave foi reconstruída do texto impresso na foto, com '+(lido.cod.fonte.match(/\d+/)||['1'])[0]+' dígito corrigido. Ela fecha os dígitos verificadores, mas confira com a nota antes de confirmar (ou use o botão do portal da NF-e).');
  // DANFE fotografado: a chave dá o mês e o ano da emissão; a primeira data desse mês no texto é a da emissão.
  const mm=String(dk.mes).padStart(2,'0');if(!inv.date){const m=lido.ocr.texto.match(new RegExp('(?<!\\d)(\\d{2})[/.]'+mm+'[/.]'+dk.ano));if(m){inv.date=`${dk.ano}-${mm}-${m[1]}`;fontes.date={f:'ocr',c:Math.min(70,confiancaDe(lido,m[0]))}}}
  // Total: no bloco "Cálculo do imposto", a segunda linha de valores termina no valor total da nota; a primeira, no total dos produtos.
  if(!inv.total&&dk.modelo===55){const L=lido.linhas,i=L.findIndex(l=>/C[AÁ]LCULO\s+DO\s+IMPOSTO/i.test(l));if(i>=0){const vals=L.slice(i+1,i+7).map(l=>l.match(/\d{1,3}(?:\.\d{3})*,\d{1,2}(?!\d)/g)||[]).filter(v=>v.length>=4);
   if(vals.length>=2){inv.total=brNumber(vals[1][vals[1].length-1]);fontes.total={f:'ocr',c:50};if(!inv.totalProducts)inv.totalProducts=brNumber(vals[0][vals[0].length-1])}}}
  if(inv.date&&(+inv.date.slice(0,4)!==dk.ano||+inv.date.slice(5,7)!==dk.mes))(inv._avisos=inv._avisos||[]).push(`A data lida (${inv.date.split('-').reverse().join('/')}) não cai no mês da chave (${String(dk.mes).padStart(2,'0')}/${dk.ano}). Confira a data de emissão.`)}
 else{fontes.key={f:inv.key?'ocr':'vazio'};
  // Sem chave válida: número no formato do DANFE ("Nº 000.020.643"); o CNPJ achado no texto pode ser o do destinatário ou da transportadora.
  const nn=lido.ocr.texto.match(/N[º°o]\.?\s*(\d{3}\.\d{3}\.\d{3})/);if(nn&&!inv.number){inv.number=String(+nn[1].replace(/\D/g,''));fontes.number={f:'ocr',c:confiancaDe(lido,nn[1])}}
  if(inv.issuerDoc)fontes.issuerDoc={f:'ocr',c:40}}
 if(lido.q.pequena)(inv._avisos=inv._avisos||[]).unshift(`Foto pequena (${lido.img.canvas.width} × ${lido.img.canvas.height} pixels), provavelmente reduzida pelo WhatsApp: as letras e o código de barras ficam sem detalhe e a leitura automática não funciona. Peça a foto tirada pelo Notas TCS, ou enviada pelo WhatsApp como documento (ou em HD), ou importe o XML. Até lá, preencha olhando a foto.`);
 else if(lido.ocr.confianca<60&&!lido.cod.chave)(inv._avisos=inv._avisos||[]).unshift(`Não foi possível ler a nota nesta foto (confiança ${Math.round(lido.ocr.confianca)}%). Confira se a nota está inteira, reta e com boa luz; preencha olhando a foto ou importe o XML.`);
 inv._foto={url:lido.img.url,nome:file.name};inv._fontes=fontes;inv._conf=Math.round(lido.ocr.confianca);inv._codigos=lido.cod;inv._avisos=(inv._avisos||[]).concat(lido.cod.avisos);if(lido.q.escura||lido.q.borrada)inv._avisos.push('A foto parece '+(lido.q.escura?'escura':'desfocada')+': a leitura pode ter falhas. Se possível, fotografe de novo em lugar claro, com a nota inteira e o celular firme.');
 if(dk?.valida&&dk.modelo!==55&&dk.modelo!==65)inv._avisos.push(`A chave é de ${dk.modeloNome}, não de nota de materiais. Confira se o documento certo foi enviado.`);
 inv.items=inv.items.map(it=>({...it}));inv.format='Foto/OCR';return inv}

// Cupom da NFC-e (layout de bobina): itens "001 CÓDIGO DESCRIÇÃO 1,000 UN X 18,90 18,90" e o emitente na primeira linha com nome.
function itensCupom(linhas){const re=/^\s*(\d{1,3})\s+(?:(\d{3,14})\s+)?(.+?)\s+(\d+(?:[.,]\d+)?)\s*([A-Za-z][A-Za-z0-9]{0,5})\.?\s*[xX×]\s*(\d{1,3}(?:\.\d{3})*,\d{2,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;const out=[];
 for(const l of linhas){const m=l.match(re);if(!m)continue;const quantity=brNumber(m[4]),unitPrice=brNumber(m[6]),lineTotal=brNumber(m[7]);if(!(quantity>0)||!(lineTotal>0))continue;out.push({code:m[2]||'',barcode:/^\d{8,14}$/.test(m[2]||'')?m[2]:'',description:m[3].trim(),ncm:'',cfop:'',unit:m[5].toUpperCase(),quantity,unitPrice,lineTotal,discount:0})}return out}
function emitenteCupom(linhas){const i=linhas.findIndex(l=>/CNPJ/i.test(l));const antes=(i>0?linhas.slice(0,i):linhas.slice(0,4));return (antes.find(l=>/[A-Za-zÀ-ú]{3,}\s+[A-Za-zÀ-ú]{2,}/.test(l)&&!/DANFE|DOCUMENTO AUXILIAR|CONSUMIDOR/i.test(l))||'').trim()}
// ---------- Conferência com a foto ao lado ----------
const FOTO_CAMPOS=[['key','Chave de acesso (44 dígitos)'],['number','Número'],['series','Série'],['date','Data de emissão'],['issuer','Emitente'],['issuerDoc','CNPJ/CPF do emitente'],['totalProducts','Total dos produtos'],['discount','Descontos'],['total','Total da nota']];
function fonteSelo(inv,k){const f=inv._fontes?.[k];if(!f)return '';if(f.f==='chave')return `<span class="selo-fonte exato" title="Valor exato, tirado da chave de acesso${f.origem?' lida no '+esc(f.origem):''}">exato</span>`;if(f.f==='vazio')return '<span class="selo-fonte falta" title="Não foi possível ler este campo na foto. Preencha olhando a imagem">preencher</span>';if(f.f==='pdf')return `<span class="selo-fonte ${f.c<75?'baixa':'ocr'}" title="Lido do texto do PDF (confiança ${f.c}%). Confira com o documento">PDF ${f.c}%</span>`;if(f.f==='cnpj')return `<span class="selo-fonte exato" title="Razão social do cadastro da Receita Federal, buscada pelo CNPJ da chave (BrasilAPI)${f.fantasia?'. Nome fantasia: '+esc(f.fantasia):''}">Receita</span>`;if(f.f==='editado')return '<span class="selo-fonte editado" title="Valor digitado na conferência">conferido</span>';if(f.f==='consulta')return `<span class="selo-fonte ${f.c<75?'baixa':'consulta'}" title="Lido do conteúdo da consulta (${esc(f.adaptador||'')}, confiança ${f.c}%). Confira com a página">consulta ${f.c}%</span>`;return `<span class="selo-fonte ${f.c<75?'baixa':'ocr'}" title="Lido por OCR${f.c?' (confiança '+f.c+'%)':''}. ${f.c<75?'Confiança baixa: confira com atenção na foto.':'Confira com a foto.'}">OCR${f.c?' '+f.c+'%':''}</span>`}
function previewFoto(inv,ii){const dk=chaveDecompor(inv.key);const c=inv._codigos||{};const tot=inv.items.reduce((s,it)=>s+Number(it.lineTotal||0),0);const desc=Math.max(inv.items.reduce((s,it)=>s+Number(it.discount||0),0),Number(inv.discount||0)); // desconto dos itens, ou o do total da nota (cupom da SEFAZ traz só o do total)
 const campo=(k,l)=>{const v=inv[k]??'';const tipo=k==='date'?'date':['totalProducts','discount','total'].includes(k)?'number':'text';const f=inv._fontes?.[k]?.f;return `<div class="field campo-foto ${f==='vazio'?'vazio':''} ${f==='ocr'&&inv._fontes[k].c<75?'baixa':''}"><label>${l} ${fonteSelo(inv,k)}</label><input data-fh="${k}" data-i="${ii}" type="${tipo}"${tipo==='number'?' step="0.01" min="0"':''} value="${esc(v)}"${k==='key'?' inputmode="numeric" maxlength="54"':''} title="${k==='key'?'Ao corrigir a chave, número, série e CNPJ são preenchidos a partir dela':'Confira com a foto ao lado'}"></div>`};
 const chaveInfo=inv.key?(dk?(dk.valida?`<span class="hint">✓ ${esc(dk.modeloNome)} · ${esc(dk.ufSigla)} · ${String(dk.mes).padStart(2,'0')}/${dk.ano} · série ${esc(dk.serie)} · nº ${esc(dk.numero)}</span>${dk.modelo===55?` <button class="btn sm" data-portal-nfe="${esc(inv.key)}" title="Copia a chave e abre a consulta do Portal Nacional da NF-e em nova aba: cole a chave, resolva o captcha e baixe o XML; depois importe o XML aqui, que traz todos os dados exatos">Copiar chave e abrir o portal da NF-e</button>`:''}`:`<span class="hint erro-txt">${dk.dvOk?'Chave com UF, mês ou modelo impossível':'Dígito verificador não confere: algum número está errado'}</span>`):'<span class="hint erro-txt">A chave precisa ter 44 dígitos.</span>'):'';
 const avisos=(inv._avisos||[]).map(a=>`<div class="notice">${esc(a)}</div>`).join('')+(c.descartes?.length?`<p class="hint">Códigos ignorados: ${esc(c.descartes.join('; '))}.</p>`:'');
 const itens=inv.items.map((it,j)=>`<tr><td><input data-fi="description" data-i="${ii}" data-j="${j}" value="${esc(it.description)}" placeholder="Descrição" style="min-width:200px;width:100%"></td><td><input data-fi="code" data-i="${ii}" data-j="${j}" value="${esc(it.code||'')}" style="width:90px"></td><td><input data-fi="unit" data-i="${ii}" data-j="${j}" value="${esc(it.unit||'UN')}" style="width:56px"></td><td class="num"><input type="number" step="0.0001" min="0" data-fi="quantity" data-i="${ii}" data-j="${j}" value="${it.quantity??''}" style="width:84px"></td><td class="num"><input type="number" step="0.0001" min="0" data-fi="unitPrice" data-i="${ii}" data-j="${j}" value="${it.unitPrice??''}" style="width:96px"></td><td class="num"><span class="calc" title="Fórmula: quantidade × valor unitário = ${num(it.quantity)} × ${money(it.unitPrice)}">${money(it.lineTotal)}</span></td><td class="num"><input type="number" step="0.01" min="0" data-fi="discount" data-i="${ii}" data-j="${j}" value="${it.discount||0}" style="width:80px"></td><td><button class="btn sm" data-f-del="${j}" data-i="${ii}" title="Retira este item da nota">✕</button></td></tr>`).join('');
 const dif=Number(inv.total||0)-(tot-desc);
 return `<div class="prev-foto" style="margin-bottom:24px"><div class="row"><strong>${inv.number?'NF '+esc(inv.number):'Nota sem número'} • ${esc(inv.issuer||'Emitente não identificado')}</strong>${tipoEscolha(inv,ii)}<span class="pill warn" title="${inv._foto?'Dados lidos de uma foto: confira tudo com a imagem':inv.format==='Chave da obra'?'Só a chave de acesso enviada pela obra: número, série e CNPJ vêm dela; o resto se completa pela consulta da nota ou à mão':'Dados lidos da página de consulta: confira com a página'}">${inv._foto?'Foto/OCR':inv.format==='Chave da obra'?'Só a chave':'Consulta'}${inv._conf?' · confiança '+(inv._foto?'média ':'')+inv._conf+'%':''}</span><button class="btn sm" data-f-descartar="${ii}" title="Tira esta foto da conferência sem gravar nada">Descartar</button></div>
 ${avisos}<div class="foto-grid${inv._foto?'':' sem-foto'}">${inv._foto?`<div class="foto-box"><div class="foto-ctl"><button class="btn sm" data-f-zoom="${ii}" data-z="-1" title="Diminui a imagem">−</button><button class="btn sm" data-f-zoom="${ii}" data-z="1" title="Aumenta a imagem; arraste a área para navegar">+</button><a class="btn sm" href="${esc(inv._foto.url)}" target="_blank" rel="noopener" title="Abre a foto em tamanho original numa nova aba">Abrir em nova aba</a>${c.url?consultaBotao(c.url)+`<button class="btn sm" data-usar-consulta="${ii}" title="Leva o link para o painel de consulta, para importar a página salva ou colar o conteúdo; os dados completam esta nota">Aproveitar a consulta</button>`:''}</div><div class="foto-vista" data-f-vista="${ii}"><img src="${esc(inv._foto.url)}" alt="Foto da nota ${esc(inv._foto.nome)}" style="width:${inv._zoom||100}%"></div><p class="hint">${esc(inv._foto.nome)}${c.lidos?' · '+c.lidos+' código(s) lido(s)':' · nenhum código lido'}${c.chave?' · chave pelo '+esc(c.fonte):''}${c.url?' · link: '+esc(consultaOrigem(c.url).rotulo):''}</p></div>`:(c.url?`<div class="row" style="grid-column:1/-1">${consultaBotao(c.url)} <span class="pill">${esc(consultaOrigem(c.url).rotulo)}</span></div>`:'')}
 <div>${filaProjetoHtml(inv,ii)}<div class="grid campos-foto">${FOTO_CAMPOS.map(([k,l])=>campo(k,l)).join('')}</div>${chaveInfo}
 <p class="hint" style="margin:8px 0">Selos: <span class="selo-fonte exato">exato</span> veio da chave · <span class="selo-fonte ocr">OCR</span> lido da foto · <span class="selo-fonte baixa">OCR baixo</span> confira com atenção · <span class="selo-fonte falta">preencher</span> não foi lido${inv._conferir||Object.values(inv._fontes||{}).some(f=>f.f==='consulta')?' · <span class="selo-fonte consulta">consulta</span> veio da página de consulta':''}.</p>
 ${Math.abs(dif)>0.05&&inv.items.length?`<div class="notice"><span class="calc" title="Fórmula: total da nota − (soma dos itens − descontos) = ${money(inv.total)} − (${money(tot)} − ${money(desc)})">Diferença de ${money(dif)}</span> entre o total da nota e os itens. Pode ser frete, seguro ou imposto (ele é rateado entre os itens), ou um item faltando.</div>`:''}</div></div>
 <div class="tablewrap" style="margin-top:12px"><table class="no-sort"><thead><tr><th>Descrição</th><th>Código</th><th>Unid.</th><th class="num">Quantidade</th><th class="num">Valor unit.</th><th class="num">Valor bruto</th><th class="num">Desconto</th><th></th></tr></thead><tbody>${itens||'<tr><td colspan="8" class="muted">'+(inv._foto?'Nenhum item reconhecido na foto. Inclua os itens olhando a imagem.':'Nenhum item ainda. Inclua os itens olhando a nota, ou use a consulta da nota.')+'</td></tr>'}</tbody></table></div>
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
document.addEventListener('click',async e=>{const b=e.target.closest('[data-portal-nfe]');if(!b)return;try{await navigator.clipboard.writeText(b.dataset.portalNfe);b.textContent='Chave copiada: cole no portal'}catch(err){prompt('Copie a chave:',b.dataset.portalNfe)}window.open('https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=','_blank','noopener')});
// Campos de trabalho da conferência que não vão para a base.
const CAMPOS_CONFERENCIA=['_foto','_fontes','_conf','_codigos','_avisos','_faltas','_zoom','_conferir','_captura','_projeto','_fotosExtra'];
// ==== #JS-IMAGEM: END ====
