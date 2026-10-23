// Pedido de material pela tabela do estoque da obra, com o destino de cada item. Pede o 1-admin.js e o 19 (parte esc1) antes.
// window.PARTE (pelo INIT do cdp.mjs):
//  'prep'    (index.html?emulador=1, 8767, administrador): segundo material (tubo) na Obra 1; o saldo da obra vai para saldos_obra/P1
//            sem valores, só com os materiais da tabela;
//  'tabela'  (captura.html?emulador=1, 8768, mestre; largura de celular): tabela da Obra 1, quantidade acima do estoque vira o máximo,
//            busca; termina na tabela (para a captura de tela);
//  'revisao' : só os itens com quantidade, destino obrigatório (Enviar travado), Outro com texto; termina na revisão;
//  'enviar'  : envia; Meus pedidos mostra o destino;
//  'esc'     (8767, administrador): o cartão da requisição mostra o destino; atende 5; saldos_obra/P1 cai para o novo disponível;
//            CSV com a coluna Destino; lista de destinos editada pelo administrador.
(async()=>{try{window.confirm=()=>true;window.alert=m=>{window.__alerta=m;console.log('ALERTA',m)};const r={};
const espera=(f,ms=30000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},150)});
const P=window.PARTE;const CIM='Cimento CP II 50 kg',TUBO='Tubo PVC 100 mm';
const restDoc=async(c,id)=>{const j=await (await fetch(`http://127.0.0.1:8089/v1/projects/demo-tcs/databases/(default)/documents/${c}/${id}`,{headers:{Authorization:'Bearer owner'}})).json();return j.fields};
const saldoP1=async()=>{const f=await restDoc('saldos_obra','P1');return f&&{campos:Object.keys(f).sort(),itens:(f.itens.arrayValue.values||[]).map(v=>{const x=v.mapValue.fields;return `${x.nome.stringValue}: ${x.disponivel.integerValue??x.disponivel.doubleValue} ${x.unidade.stringValue}`})}};
const texto=el=>el?.textContent.replace(/\s+/g,' ').trim();
if(P==='prep'||P==='esc'){await espera(()=>window.__fb&&Nuvem.perfil&&Nuvem.estado==='online'&&Nuvem.reconciliado);await espera(()=>Req.ligada)}
if(P==='prep'){
 const n={id:'23261033333333000133550010000000031000000033',number:'000031',series:'1',date:'2026-10-12',operation:'VENDA',issuer:'HIDRAULICA NORTE',issuerDoc:'33333333000133',recipient:'TCS',totalProducts:12*55,discount:0,total:12*55,source:'teste',format:'XML',tipo:'material',items:[{code:'T100',barcode:'',description:'TUBO PVC ESGOTO 100MM 6M',ncm:'39172300',cfop:'5102',unit:'BR',quantity:12,unitPrice:55,lineTotal:660,discount:0}],postedAt:new Date().toISOString()};n.key=n.id;
 const prod={id:'prod-T100',key:productKey(n.items[0]),code:'T100',barcode:'',name:n.items[0].description,unit:'BR',stock:12,createdAt:new Date().toISOString()};n.items[0].productId=prod.id;
 const ex=escopoNormalizar(structuredClone({products:[prod],invoices:[n],movements:[{id:'ent-t',productId:prod.id,invoiceId:n.id,invoiceKey:n.key,itemIndex:0,date:n.date,type:'ENTRADA',escopo:'aberta',quantity:12,unitCost:55,description:n.items[0].description,createdAt:new Date().toISOString()}]}));
 await txWrite(['products','invoices','movements','chaves'],os=>{for(const k of ['products','invoices','movements','chaves'])for(const it of ex[k]||[])os[k].put(it)});await refresh();
 const inv=state.invoices.find(i=>i.id===n.id);await saveInvoiceAllocations(inv,[makeAlloc(inv,0,'P1',12)]);
 await espera(()=>Nuvem.pendentes===0);
 // antes do vínculo: o tubo não tem material e não vai para o mestre
 await new Promise(x=>setTimeout(x,2500));r.saldoSemVinculo=await saldoP1();
 await materialSalvar({nome:TUBO,unidade:'BR',categoria:'Hidráulica'});await refresh();await espera(()=>state.materiais.some(m=>m.nome===TUBO));
 await materialVincular([prod.id],state.materiais.find(m=>m.nome===TUBO).id);await refresh();await espera(()=>Nuvem.pendentes===0);
 const t0=Date.now();let s;do{await new Promise(x=>setTimeout(x,700));s=await saldoP1()}while(Date.now()-t0<20000&&!(s?.itens.length===2));
 r.saldoDepois=s;r.semValores=!s.campos.some(k=>/custo|valor|pago|preco/i.test(k));
}
const mestre=async()=>{await espera(()=>window.__fb);if(!Cap.user)await window.__fb.loginTeste('mestre@x.com');await espera(()=>Cap.perfil&&Cap.projetos.length);
 $('#pedirMaterial').click();await espera(()=>$('#telaPedir').classList.contains('ativa'));await espera(()=>document.querySelectorAll('#pedirTabela [data-mt-qtd]').length===2)};
const digita=(nome,v)=>{const i=[...document.querySelectorAll('#pedirTabela tbody tr')].find(tr=>tr.textContent.includes(nome)).querySelector('[data-mt-qtd]');i.value=v;i.dispatchEvent(new Event('change',{bubbles:true}));return i};
if(P==='tabela'||P==='revisao'||P==='enviar'){await mestre();
 r.tabela=[...document.querySelectorAll('#pedirTabela tbody tr')].map(texto);r.cabecalho=[...document.querySelectorAll('#pedirTabela th')].map(texto);
 r.revisarAntes=$('#pedirRevisar').disabled;
 const i=digita(CIM,'40');r.acimaDoEstoque=i.value;digita(CIM,'5');digita(TUBO,'2,5');
 r.revisarDepois=$('#pedirRevisar').textContent;
 $('#pedirBusca').value='tubo';$('#pedirBusca').dispatchEvent(new Event('input',{bubbles:true}));r.busca=[...document.querySelectorAll('#pedirTabela tbody tr')].map(texto);
 r.buscaMantemQtd=document.querySelector('#pedirTabela [data-mt-qtd]').value;$('#pedirBusca').value='';$('#pedirBusca').dispatchEvent(new Event('input',{bubbles:true}));
 r.zeroSai=(digita(TUBO,'0'),Mt.qtd.size);digita(TUBO,'2,5');}
if(P==='revisao'||P==='enviar'){
 $('#pedirRevisar').click();await espera(()=>!$('#pedirPasso2').hidden);
 r.revisao=[...document.querySelectorAll('#pedirRevisao tbody tr')].map(texto);r.enviarSemDestino=$('#pedirEnviar').disabled;
 r.opcoes=[...document.querySelector('#pedirRevisao select').options].map(o=>o.textContent);
 const sel=n=>[...document.querySelectorAll('#pedirRevisao tbody tr')].find(tr=>tr.textContent.includes(n)).querySelector('select');
 const s1=sel(CIM);s1.value='Laje';s1.dispatchEvent(new Event('change',{bubbles:true}));r.umDestino=$('#pedirEnviar').disabled;
 const s2=sel(TUBO);s2.value='Outro';s2.dispatchEvent(new Event('change',{bubbles:true}));r.outroCampo=!!document.querySelector('[data-mt-dest-outro]');r.outroVazio=$('#pedirEnviar').disabled;
 const o=document.querySelector('[data-mt-dest-outro]');o.value='Esgoto do térreo';o.dispatchEvent(new Event('input',{bubbles:true}));r.enviarPronto=!$('#pedirEnviar').disabled;
 // voltar à tabela mantém as quantidades e os destinos
 $('#pedirVoltar').click();r.voltouTabela=!$('#pedirPasso1').hidden&&Mt.qtd.size===2;$('#pedirRevisar').click();r.destinosMantidos=[...document.querySelectorAll('#pedirRevisao select')].map(s=>s.value);
 $('#pedirObs').value='preciso até quinta'}
if(P==='enviar'){
 $('#pedirEnviar').click();await espera(()=>/Pedido enviado/.test($('#prontoTexto').innerText));r.pronto=texto($('#prontoTexto'));
 await espera(()=>mtLista().some(x=>x.status==='pendente'&&x.itens.length===2&&!x._pendente));const q=mtLista().find(x=>x.itens.length===2);
 r.gravado=q.itens.map(i=>`${i.nome} ${i.pedida} ${i.unidade} → ${i.destino}`);r.obs=q.obs;r.limpou=Mt.qtd.size===0&&Mt.destino.size===0;
 $('#meusPedidos').click();r.meusPedidos=texto(document.querySelector('.pedido'));}
if(P==='esc'){
 await espera(()=>reqLista().some(x=>x.status==='pendente'&&x.itens.length===2));const q=reqLista().find(x=>x.status==='pendente'&&x.itens.length===2);
 go('requisicoes');Req.aba='pendentes';reqRender();const card=document.querySelector(`[data-req-cartao="${q.id}"]`);
 r.colunas=[...card.querySelectorAll('th')].map(texto);r.linhas=[...card.querySelectorAll('tbody tr')].map(texto);
 const antes=await saldoP1();r.saldoAntes=antes.itens;
 card.querySelectorAll('[data-req-q]').forEach((x,i)=>{x.value=i===0?'5':'2.5'});card.querySelector('[data-req-ok]').click();
 await espera(()=>Req.itens.get(q.id)?.status==='atendida');
 const t0=Date.now();let s;do{await new Promise(x=>setTimeout(x,700));s=await saldoP1()}while(Date.now()-t0<20000&&JSON.stringify(s.itens)===JSON.stringify(antes.itens));r.saldoDepois=s.itens;
 Req.aba='historico';reqRender();r.historico=[...document.querySelector(`[data-req-cartao="${q.id}"]`).querySelectorAll('th')].map(texto);
 let csv='';const orig=window.csvDownload;window.csvDownload=(n,rows)=>{csv=rows.slice(0,3).map(l=>l.join(';')).join(' | ')};document.querySelector('#reqCsv').click();window.csvDownload=orig;r.csv=csv;
 // lista de destinos do administrador
 go('usuarios');Adm.aba='config';renderUsuarios();const ta=document.querySelector('[data-adm-destinos]');r.listaNaTela=!!ta;
 if(ta){ta.value='Laje\nFundação\nHidráulico\nElétrico\nPintura';document.querySelector('[data-adm-destinos-salvar]').click();
  const t1=Date.now();let g;do{await new Promise(x=>setTimeout(x,500));g=await restDoc('config','geral')}while(Date.now()-t1<10000&&!g?.destinos);r.destinosGravados=(g?.destinos?.arrayValue?.values||[]).map(v=>v.stringValue)}
}
return r}catch(e){return 'FALHOU: '+e.message+'\n'+e.stack}})()
