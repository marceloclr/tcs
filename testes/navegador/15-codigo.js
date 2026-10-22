// Tela da obra: ler o código da nota (câmera ao vivo) ou digitar os 44 números, e enviar sem foto.
// Rodar em captura.html?emulador=1 (porta 8768), depois do 1-admin.js. O Chromium sem janela precisa de
// --use-fake-device-for-media-stream --use-fake-ui-for-media-stream para a câmera abrir.
(async()=>{try{window.confirm=()=>true;window.alert=m=>console.log('ALERTA',m);const r={};
const espera=(f,ms=25000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},150)});
await capOp('fila','readwrite',s=>s.clear()); // sobra de rodada anterior não trava a fila
const ativa=()=>[...document.querySelectorAll('.tela.ativa')].map(x=>x.id).join(',');
await espera(()=>window.__fb);if(Cap.user&&Cap.user.email!=='mestre@x.com'){await window.__fb.logout();await espera(()=>!Cap.user)}
if(!Cap.user)await window.__fb.loginTeste('mestre@x.com');
await espera(()=>Cap.perfil&&Cap.projetos.length&&ativa()==='telaFoto');
const comDV=b=>b+chaveDV(b);const CE=comDV('2326100701234500012365001000001234100001234'),NFE=comDV('2326101234567800019555001000012399112345678');
// 1) câmera ao vivo: um código de barras desenhado num canvas vira o vídeo da câmera (captureStream)
await loadScriptFrom('https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js');
$('#lerCodigo').click();await espera(()=>ativa()==='telaCodigo');await espera(()=>/Procurando/.test($('#codigoStatus').textContent));r.camera={tela:ativa(),status:$('#codigoStatus').textContent,aberta:!!Visor.stream};
const cv=document.createElement('canvas');cv.width=1280;cv.height=720;const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,1280,720);const bc=document.createElement('canvas');JsBarcode(bc,NFE,{format:'CODE128C',width:2,height:160,displayValue:false,margin:20});x.drawImage(bc,(1280-bc.width)/2,280);
// o Chromium sem janela nem sempre entrega quadros de um captureStream ao vídeo; aí o mesmo leitor recebe o canvas direto
const st=cv.captureStream(10);visorParar();Visor.stream=st;const v=$('#visor');v.srcObject=st;await Promise.race([v.play(),new Promise(res=>setTimeout(res,3000))]);
let lidos={},fonte='vídeo';for(let t=0;t<12&&!lidos.chave;t++){lidos=codigosResumo(await quadroLer(v.readyState>=2?v:(fonte='canvas',cv)));if(!lidos.chave)await new Promise(res=>setTimeout(res,250))}r.quadro={chave:lidos.chave===NFE,motor:Visor.det?'BarcodeDetector':'ZXing',fonte};
if(!lidos.chave)throw new Error('o leitor não achou o código de barras');
codigoAceitar({chave:lidos.chave,url:lidos.url,origem:'codigo'});await espera(()=>ativa()==='telaConferir');
r.lido={caixa:$('#codigoLido').innerText.replace(/\s+/g,' '),enviarLiberado:!$('#enviar').disabled,fotoOpcional:$('#maisFotoTexto').textContent,cameraParada:!Visor.stream};
await enviar();await espera(()=>/enviada/.test($('#prontoTexto').innerText));r.enviada1=$('#prontoTexto').innerText.replace(/\s+/g,' ');
// 2) digitar: número a menos, número errado e certo (NFC-e do Ceará)
$('#outra').click();$('#lerCodigo').click();await espera(()=>ativa()==='telaCodigo');$('#digitarAbrir').click();r.digitarAberto=!$('#digitarCaixa').hidden&&!Visor.stream;
const dig=t=>{$('#digitar').value=t;$('#digitar').dispatchEvent(new Event('input'));$('#digitarOk').click();return $('#digitarErro').textContent};
r.digitar={curto:dig(CE.slice(0,40)),errado:dig(CE.slice(0,43)+((+CE[43]+1)%10)),contador:$('#digitarConta').textContent};
dig(CE.replace(/(\d{4})/g,'$1 '));await espera(()=>ativa()==='telaConferir');r.digitar.aceito=$('#codigoLido').innerText.replace(/\s+/g,' ');
$('#avariado').click();await enviar();await espera(()=>/enviada/.test($('#prontoTexto').innerText));
// 3) cancelar sem enviar volta à tela inicial
$('#outra').click();$('#lerCodigo').click();await espera(()=>ativa()==='telaCodigo');$('#codigoVoltar').click();r.voltar={tela:ativa(),cameraParada:!Visor.stream};
// o que chegou na nuvem
const j=await (await fetch('http://127.0.0.1:8089/v1/projects/demo-tcs/databases/(default)/documents/capturas?pageSize=50',{headers:{Authorization:'Bearer owner'}})).json();
r.nuvem=(j.documents||[]).map(d=>{const f=d.fields;return {chave:f.chave?.stringValue===CE?'CE digitada':f.chave?.stringValue===NFE?'NF-e lida':f.chave?.stringValue?'outra':'',origem:f.origem?.stringValue,fotos:(f.fotos?.arrayValue?.values||[]).length,obs:(f.observacoes?.arrayValue?.values||[]).map(v=>v.stringValue)}}).filter(c=>c.origem==='codigo'||c.origem==='digitado');
return r}catch(e){return 'ERRO '+e.message+'\n'+e.stack}})()
