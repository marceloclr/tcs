// Etapa 2: fotos sintéticas (desenhadas aqui com o gerador do ZXing) passam pelo importador real, em modo local.
(async()=>{try{window.alert=m=>console.log('ALERTA',m);window.confirm=()=>true;gateOffline=true;gateRender();
for(const s of STORES)await clearStore(s,{local:true});await refresh();draft=[];
const Z=await loadLibrary(...LIB_ZXING);const r={};
const fazChave=(uf,aamm,cnpj,mod,serie,num)=>{const b=String(uf)+aamm+cnpj+String(mod).padStart(2,'0')+String(serie).padStart(3,'0')+String(num).padStart(9,'0')+'1'+'12345678';return b+chaveDV(b)};
r.demoValida=chaveValida('35260936131747000126550010000206431026037942');
const k55=fazChave(23,'2610','12345678000195',55,1,12345),k65=fazChave(23,'2610','98765432000110',65,2,777),k55b=fazChave(23,'2610','12345678000195',55,1,12346);
const boleto='23793381286000000012345678901234567890123456';r.boletoValidaComoChave=chaveValida(boleto);r.pixInterpretado=codigoInterpretar({formato:'qrcode',texto:'00020101021226870014br.gov.bcb.pix2565pix.exemplo.com'}).tipo;r.itfInterpretado=codigoInterpretar({formato:'itf',texto:boleto}).tipo;
await loadScriptFrom('https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js');
const pinta=(ctx,texto,fmt,x,y,w,h)=>{if(fmt===Z.BarcodeFormat.CODE_128){const b=document.createElement('canvas');JsBarcode(b,texto,{format:/^\d+$/.test(texto)&&texto.length%2===0?'CODE128C':'CODE128',width:2,height:h,displayValue:false,margin:10});ctx.drawImage(b,x,y);return}const m=new Z.MultiFormatWriter().encode(texto,fmt,w,h,new Map());const mw=m.getWidth(),mh=m.getHeight();ctx.fillStyle='#000';for(let yy=0;yy<mh;yy++)for(let xx=0;xx<mw;xx++)if(m.get(xx,yy))ctx.fillRect(x+xx,y+yy,1,1)};
const folha=(linhas,codigos)=>{const c=document.createElement('canvas');c.width=1240;c.height=1754;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#000';x.font='26px Arial';linhas.forEach((l,i)=>x.fillText(l,60,90+i*44));codigos.forEach(([t,f,px,py,w,h])=>pinta(x,t,f,px,py,w,h));return new Promise(res=>c.toBlob(b=>res(b),'image/png'))};
const grupos=k=>k.match(/.{4}/g).join(' ');
const danfe=await folha(['IDENTIFICAÇÃO DO EMITENTE','MATERIAIS DE CONSTRUCAO SOL LTDA','RUA DAS FLORES 100 FORTALEZA CE','DANFE','CHAVE DE ACESSO',grupos(k55),'N° 000.012.345 SÉRIE 1','NATUREZA DE OPERAÇÃO','VENDA DE MERCADORIA','DATA DA EMISSÃO 15/10/2026','DADOS DOS PRODUTOS','7891234567895 CIMENTO CPII 50KG 25232910 000 5102 SC 10,0000 32,5000 325,00 0,00','7890000000017 AREIA MEDIA 25059000 000 5102 M3 2,0000 90,0000 180,00 0,00','VALOR TOTAL DOS PRODUTOS','505,00 0,00 505,00','VALOR TOTAL DA NOTA','505,00'],[[k55,Z.BarcodeFormat.CODE_128,640,30,560,110]]);
await loadFiles([new File([danfe],'danfe-foto.png',{type:'image/png'})],'material');
const d0=draft[0];r.danfe=d0?{chave:d0.key===k55,fonteChave:d0._codigos?.fonte,numero:d0.number,serie:d0.series,cnpj:d0.issuerDoc,emitente:d0.issuer,data:d0.date,total:d0.total,itens:d0.items.map(i=>i.description+' '+i.quantity+'x'+i.unitPrice),fontes:Object.fromEntries(Object.entries(d0._fontes).map(([k,v])=>[k,v.f+(v.c?':'+v.c:'')])),avisos:d0._avisos,conf:d0._conf}:$('#importMessage').innerText;
const nfce=await folha(['SUPERMERCADO BOM PRECO LTDA','CNPJ 98.765.432/0001-10','DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRONICA','001 PREGO 17X27 1,000 KG X 18,90 18,90','VALOR TOTAL R$ 18,90','Emissão: 16/10/2026 10:21:33','Consulte pela Chave de Acesso em','www.sefaz.ce.gov.br/nfce/consulta','PAGUE COM PIX'],[['https://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p='+k65+'|2|1|1|ABCDEF',Z.BarcodeFormat.QR_CODE,80,520,360,360],['00020101021226870014br.gov.bcb.pix2565pix.exemplo.com/qr/v2/abc5204000053039865802BR5913LOJA6009FORTALEZA62070503***6304ABCD',Z.BarcodeFormat.QR_CODE,700,520,360,360],[boleto,Z.BarcodeFormat.CODE_128,60,1000,1100,120]]);
await loadFiles([new File([nfce],'nfce-foto.png',{type:'image/png'})],'material');
const d1=draft[1];r.nfce=d1?{emitente:d1.issuer,itens:d1.items.map(i=>i.description+' '+i.quantity+i.unit+'x'+i.unitPrice),chave:d1.key===k65,fonte:d1._codigos?.fonte,url:d1._codigos?.url,descartes:d1._codigos?.descartes,numero:d1.number,total:d1.total,data:d1.date,faltas:d1._faltas}:$('#importMessage').innerText;
const div=await folha(['IDENTIFICAÇÃO DO EMITENTE','MATERIAIS DE CONSTRUCAO SOL LTDA','DATA DA EMISSÃO 15/10/2026'],[[k55b,Z.BarcodeFormat.CODE_128,640,30,560,110],['https://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p='+k65+'|2|1|1|X',Z.BarcodeFormat.QR_CODE,80,520,300,300]]);
await loadFiles([new File([div],'divergente.png',{type:'image/png'})],'material');
r.divergencia=(draft[2]?._avisos||[]).filter(a=>/diferente/.test(a)).length;
// confirma a primeira nota e tenta importar a mesma foto de novo
draft.splice(1);go('import');renderPreview();await postDraft();r.gravadas=state.invoices.length;
await loadFiles([new File([danfe],'danfe-de-novo.png',{type:'image/png'})],'material');
r.duplicada={naConferencia:draft.length,mensagem:$('#importMessage').innerText.slice(0,120),botao:!!$('[data-abrir-nota]')};
return r}catch(e){return 'ERRO '+e.message+'\n'+e.stack}})()
