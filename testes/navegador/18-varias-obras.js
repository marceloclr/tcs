// Várias obras para a mesma nota. Parte 1 (window.PARTE='obra', em captura.html?emulador=1, porta 8768): o mestre marca
// Obra 1 e Obra 2 e envia só a chave. Parte 2 (PARTE='escritorio', index.html?emulador=1, porta 8767, administrador): selo de
// produtos importados, troca da Obra 2 pela Obra 3, separação por produto, excesso recusado e lançamento conforme a separação.
// Pede o 1-admin.js antes; a parte 1 dá à conta da obra acesso também à Obra 2.
(async()=>{try{window.confirm=()=>true;window.alert=m=>{window.__alerta=m};const r={};
const espera=(f,ms=30000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},150)});
const rest=(c,id,campos,mask)=>fetch(`http://127.0.0.1:8089/v1/projects/demo-tcs/databases/(default)/documents/${c}/${encodeURIComponent(id)}${mask?'?'+mask.map(m=>'updateMask.fieldPaths='+m).join('&'):''}`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:campos})});
const CE='23261007012345000123650010000012341000012346';
if(window.PARTE==='obra'){
 await rest('usuarios','mestre@x.com',{acessos:{mapValue:{fields:{'p:P1':{mapValue:{fields:{n:{stringValue:'L'}}}},'p:P2':{mapValue:{fields:{n:{stringValue:'L'}}}}}}}},['acessos']);
 await espera(()=>window.__fb);if(!Cap.user)await window.__fb.loginTeste('mestre@x.com');await capOp('fila','readwrite',s=>s.clear());
 await espera(()=>Cap.perfil&&Cap.projetos.length>=2);codigoAceitar({chave:CE,url:'',origem:'digitado'});
 r.antes={obras:Cap.projetos.map(p=>p.name),marcadas:Cap.obras.length,enviar:!$('#enviar').disabled,dica:!$('#obrasDica').hidden};
 Cap.obras=[];conferirRender();document.querySelector('[data-obra="P1"]').click();document.querySelector('[data-obra="P2"]').click();
 r.marcadas={obras:Cap.obras,enviar:!$('#enviar').disabled,dica:$('#obrasDica').hidden?'':$('#obrasDica').textContent,pressionados:[...document.querySelectorAll('[data-obra][aria-pressed="true"]')].map(b=>b.textContent)};
 await enviar();await espera(()=>/enviada/.test($('#prontoTexto').innerText));
 const j=await (await fetch('http://127.0.0.1:8089/v1/projects/demo-tcs/databases/(default)/documents/capturas?pageSize=50',{headers:{Authorization:'Bearer owner'}})).json();
 const d=(j.documents||[]).map(x=>x.fields).find(f=>f.chave?.stringValue===CE);r.nuvem={principal:d?.projectId?.stringValue,obras:(d?.obras?.arrayValue?.values||[]).map(v=>v.mapValue.fields.nome.stringValue)};return r}
// ---- escritório (administrador) ----
await espera(()=>window.__fb&&db&&gateAuthVisto);if(Nuvem.user&&Nuvem.user.email!=='marceloclr@gmail.com'){await window.__fb.logout();await espera(()=>!Nuvem.user)}if(!Nuvem.user)await window.__fb.loginTeste('marceloclr@gmail.com');await espera(()=>Nuvem.perfil?.papel==='admin'&&Nuvem.estado==='online'&&Nuvem.reconciliado);
const c=await espera(()=>[...Fila.itens.values()].find(x=>x.chave===CE&&x.status==='pendente'));
const html=`<div class="txtTopo">MATERIAIS SOL LTDA</div><div class="text">CNPJ: 07.012.345/0001-23</div><table id="tabResult"><tr><td><span class="txtTit">CIMENTO CP II 50KG</span><span class="RCod">(Código: 789100)</span><br><span class="Rqtd"><strong>Qtde.:</strong>10</span><span class="RUN"><strong>UN: </strong>SC</span><span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;32,50</span></td><td>Vl. Total<br><span class="valor">325,00</span></td></tr><tr><td><span class="txtTit">AREIA MEDIA M3</span><span class="RCod">(Código: 1002)</span><br><span class="Rqtd"><strong>Qtde.:</strong>2</span><span class="RUN"><strong>UN: </strong>M3</span><span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;90,00</span></td><td>Vl. Total<br><span class="valor">180,00</span></td></tr></table><div id="totalNota"><label>Valor a pagar R$:</label><span>505,00</span></div><ul><li><strong>Emissão: </strong>20/10/2026 10:15:00</li></ul><span class="chave">${CE.replace(/(\d{4})/g,'$1 ')}</span>`;
await rest('capturas',c.id,{busca:{mapValue:{fields:{status:{stringValue:'ok'},em:{stringValue:new Date().toISOString()},fonte:{stringValue:'SEFAZ-CE (pela chave)'},url:{stringValue:''},html:{stringValue:html}}}}},['busca']);
await espera(()=>Fila.itens.get(c.id)?.busca?.status==='ok');go('recebidas');filaRender();
const linha=[...document.querySelectorAll('#filaBody tbody tr')].find(tr=>tr.querySelector(`[data-fila-conferir="${c.id}"]`));r.linha=linha.innerText.replace(/\s+/g,' ');r.seloVerde=!!linha.querySelector('.selo-importado');
await filaConferir(c.id);await espera(()=>draft.some(d=>d._captura===c.id));const inv=draft.find(d=>d._captura===c.id),ii=draft.indexOf(inv);
r.conferencia={obras:[...inv._obras],quadro:!!document.querySelector('.fila-dist'),aviso:inv._avisos.find(a=>/obras para esta nota/.test(a))||''};
// troca a Obra 2 pela Obra 3
document.querySelector(`[data-fila-obra-tirar="${ii}"][data-p="P2"]`).click();r.depoisDeTirar={obras:[...inv._obras],quadro:!!document.querySelector('.fila-dist')};
const sel=document.querySelector(`[data-fila-obra-add="${ii}"]`);sel.value='P3';sel.dispatchEvent(new Event('change',{bubbles:true}));r.depoisDeAdicionar=[...inv._obras];
const pon=(j,p,v)=>{const el=document.querySelector(`[data-fila-dist="${ii}"][data-j="${j}"][data-p="${p}"]`);el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}))};
pon(0,'P1',11);r.excesso={erro:filaDistErro(inv),livre:document.querySelector('.fila-dist tbody tr td:last-child').textContent};
window.__alerta='';await postDraft();r.bloqueouLancamento={alerta:window.__alerta,aindaNaConferencia:draft.includes(inv)};
pon(0,'P1',6);pon(0,'P3',4);document.querySelector(`[data-fila-dist="${ii}"][data-j="1"][data-p="P3"]`);pon(1,'P1',0);pon(1,'P3',2);
r.quadro=[...document.querySelectorAll('.fila-dist tbody tr, .fila-dist tfoot tr')].map(tr=>[...tr.cells].map(td=>td.querySelector('input')?td.querySelector('input').value||'0':td.innerText.trim()).join(' | '));
await postDraft();await espera(()=>Fila.itens.get(c.id)?.status==='lancada');const n=state.invoices.find(i=>i.key===CE);
r.lancada={situacao:invoiceStatus(n),projetos:n.projetos,rateios:state.allocations.filter(a=>a.invoiceId===n.id).map(a=>`${n.items[a.itemIndex].description} → ${projectById(a.projectId).name}: ${a.quantity}`).sort(),itensSemCampoTemporario:n.items.every(it=>!('_obras' in it))};
return r}catch(e){return 'ERRO '+e.message+'\n'+e.stack}})()
