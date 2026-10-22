// Escritório: capturas só com o código (15-codigo.js antes). A busca automática é simulada gravando 'busca' direto no
// emulador, como o servidor/buscar-nfce.mjs faria: página no padrão de consulta da NFC-e, com itens e total.
// Rodar em index.html?emulador=1 (porta 8767), conta do Escritório com escrita na Obra 1.
(async()=>{try{window.confirm=()=>true;window.alert=m=>console.log('ALERTA',m);const r={};
const espera=(f,ms=30000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},150)});
await espera(()=>window.__fb&&db&&gateAuthVisto);if(Nuvem.user&&Nuvem.user.email!=='esc@x.com'){await window.__fb.logout();await espera(()=>!Nuvem.user)}
if(!Nuvem.user)await window.__fb.loginTeste('esc@x.com');await espera(()=>Nuvem.perfil?.email==='esc@x.com'&&Nuvem.estado==='online'&&Nuvem.reconciliado);
await espera(()=>[...Fila.itens.values()].filter(c=>c.origem==='digitado'||c.origem==='codigo').length>=2);
const ce=[...Fila.itens.values()].find(c=>c.origem==='digitado'),nfe=[...Fila.itens.values()].find(c=>c.origem==='codigo');
go('recebidas');const linha=id=>[...document.querySelectorAll('#filaBody tbody tr')].find(tr=>tr.querySelector(`[data-fila-conferir="${id}"]`))?.innerText.replace(/\s+/g,' ');
r.antes={ce:linha(ce.id),semVerFotos:!document.querySelector(`[data-fila-fotos="${ce.id}"]`)};
const html=`<div class="txtCenter"><div class="txtTopo">MATERIAIS SOL LTDA</div><div class="text">CNPJ: 07.012.345/0001-23</div></div>
<table id="tabResult"><tr><td><span class="txtTit">CIMENTO CP II 50KG</span><span class="RCod">(Código: 789100)</span><br><span class="Rqtd"><strong>Qtde.:</strong>10</span><span class="RUN"><strong>UN: </strong>SC</span><span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;32,50</span></td><td class="txtTit noWrap">Vl. Total<br><span class="valor">325,00</span></td></tr>
<tr><td><span class="txtTit">AREIA MEDIA M3</span><span class="RCod">(Código: 1002)</span><br><span class="Rqtd"><strong>Qtde.:</strong>2</span><span class="RUN"><strong>UN: </strong>M3</span><span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;90,00</span></td><td class="txtTit noWrap">Vl. Total<br><span class="valor">180,00</span></td></tr></table>
<div id="totalNota"><div id="linhaTotal"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">505,00</span></div></div>
<ul><li><strong>Emissão: </strong>20/10/2026 10:15:00</li></ul><span class="chave">${ce.chave.replace(/(\d{4})/g,'$1 ')}</span><script>alert('não roda')</script>`;
const busca={mapValue:{fields:{status:{stringValue:'ok'},em:{stringValue:new Date().toISOString()},fonte:{stringValue:'SEFAZ-CE (pela chave)'},url:{stringValue:''},html:{stringValue:html}}}};
await fetch(`http://127.0.0.1:8089/v1/projects/demo-tcs/databases/(default)/documents/capturas/${ce.id}?updateMask.fieldPaths=busca`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{busca}})});
await espera(()=>Fila.itens.get(ce.id)?.busca?.status==='ok');filaRender();r.depois={ce:linha(ce.id),nfe:linha(nfe.id)};
// conferir com os dados da SEFAZ
await filaConferir(ce.id);await espera(()=>draft.some(d=>d._captura===ce.id));const d=draft.find(x=>x._captura===ce.id);
r.ce={chave:d.key===ce.chave,numero:d.number,emitente:d.issuer,cnpj:d.issuerDoc,data:d.date,total:d.total,itens:d.items.map(i=>`${i.quantity} ${i.unit} ${i.description} ${i.unitPrice} = ${i.lineTotal}`),fonteItens:d._fontes.total?.f,projeto:d._projeto,avisos:d._avisos};
// a captura só com a chave da NF-e, sem busca: abre pela chave, sem itens
await filaConferir(nfe.id);await espera(()=>draft.some(x=>x._captura===nfe.id));const n=draft.find(x=>x._captura===nfe.id);
r.nfe={chave:n.key===nfe.chave,numero:n.number,serie:n.series,cnpj:n.issuerDoc,itens:n.items.length,format:n.format,avisos:n.avisos||n._avisos};
r.selos=[...document.querySelectorAll('#preview .selo-fonte')].slice(0,8).map(s=>s.textContent);
// lança a da SEFAZ (a da NF-e fica incompleta e é tirada da conferência)
draft=draft.filter(x=>x!==n);renderPreview();await postDraft();await espera(()=>Fila.itens.get(ce.id)?.status==='lancada');
const inv=state.invoices.find(i=>i.key===ce.chave);r.lancada={status:Fila.itens.get(ce.id).status,total:inv?.total,itens:inv?.items.length,projetos:inv?.projetos};
return r}catch(e){return 'ERRO '+e.message+'\n'+e.stack}})()
