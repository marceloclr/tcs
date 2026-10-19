// Etapa 4: tela de captura (captura.html?emulador=1) com a conta da obra. Pede que o 1-admin.js tenha rodado antes.
// Usa "console.log('__cdp_offline__')" para o cdp.mjs derrubar a rede da página e "__cdp_online__" para religar.
(async()=>{try{window.confirm=()=>true;window.alert=m=>console.log('ALERTA',m);const r={};
const espera=(f,ms=25000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},150)});
const ativa=()=>[...document.querySelectorAll('.tela.ativa')].map(x=>x.id).join(',');
await espera(()=>window.__fb);if(Cap.user&&Cap.user.email!=='mestre@x.com'){await window.__fb.logout();await espera(()=>!Cap.user)}
if(!Cap.user)await window.__fb.loginTeste('mestre@x.com');
await espera(()=>Cap.perfil&&Cap.projetos.length&&ativa()==='telaFoto');r.inicio={tela:ativa(),obras:Cap.projetos.map(p=>p.name)};
// foto sintética: nota com código de barras da chave
await loadScriptFrom('https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js');
const b='2326101234567800019555001000012399112345678',chave=b+chaveDV(b);
const foto=async(escura)=>{const c=document.createElement('canvas');c.width=1200;c.height=1600;const x=c.getContext('2d');x.fillStyle=escura?'#151515':'#fff';x.fillRect(0,0,1200,1600);x.fillStyle=escura?'#262626':'#000';x.font='34px Arial';['MATERIAIS DE CONSTRUCAO SOL LTDA','DANFE','CIMENTO CP II 50KG 10 SC'].forEach((l,i)=>x.fillText(l,60,500+i*60));if(!escura){const bc=document.createElement('canvas');JsBarcode(bc,chave,{format:'CODE128C',width:2,height:110,displayValue:false,margin:10});x.drawImage(bc,60,60)}return new File([await new Promise(res=>c.toBlob(res,'image/jpeg',0.9))],escura?'escura.jpg':'nota.jpg',{type:'image/jpeg'})};
// 1) com internet
await fotosReceber([await foto(false)],'camera');await espera(()=>ativa()==='telaConferir');
r.conferir={obraAutomatica:Cap.obra==='P1',enviarLiberado:!$('#enviar').disabled,chaveLida:Cap.fotos[0].chave===chave,tamanhoKB:Math.round(Cap.fotos[0].blob.size/1024),dimensao:Cap.fotos[0].largura+'x'+Cap.fotos[0].altura};
$('#faltou').click();await enviar();await espera(()=>/enviada/.test($('#prontoTexto').innerText));r.online=$('#prontoTexto').innerText.replace(/\s+/g,' ');
// 2) foto escura: alerta e "Usar assim mesmo"
$('#outra').click();await fotosReceber([await foto(true)],'camera');r.escura={alerta:!!$('.alerta-foto'),enviarTravado:$('#enviar').disabled};$('[data-usar="0"]').click();r.escura.liberouDepois=!$('#enviar').disabled;
// 3) sem internet: fica na fila e sai sozinha quando a rede volta
console.log('__cdp_offline__');await espera(()=>!navigator.onLine,8000);await enviar();await espera(()=>/guardada/.test($('#prontoTexto').innerText));r.offline={tela:$('#prontoTexto').innerText.replace(/\s+/g,' ').slice(0,60),faixa:$('#fila').innerText,naFila:(await filaTodos()).length};
console.log('__cdp_online__');await espera(()=>navigator.onLine,8000);await espera(()=>!Cap.enviando&&$('#fila').hidden,40000);r.depoisDeVoltar={naFila:(await filaTodos()).length,faixaEscondida:$('#fila').hidden};
// o que chegou na nuvem, lido direto do emulador (a simulação de rede derruba a escuta da página)
const j=await (await fetch('http://127.0.0.1:8089/v1/projects/demo-tcs/databases/(default)/documents/capturas?pageSize=50',{headers:{Authorization:'Bearer owner'}})).json();
r.nuvem=(j.documents||[]).map(d=>{const f=d.fields;return {obra:f.projetoNome?.stringValue,status:f.status?.stringValue,obs:(f.observacoes?.arrayValue?.values||[]).map(v=>v.stringValue),chave:f.chave?.stringValue===chave?'lida':f.chave?.stringValue?'outra':'',fotos:(f.fotos?.arrayValue?.values||[]).length}});
return r}catch(e){return 'ERRO '+e.message+'\n'+e.stack}})()
