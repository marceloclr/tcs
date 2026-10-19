(async()=>{await new Promise(x=>setTimeout(x,4000));const conta={};for(const s of STORES)conta[s]=(await all(s)).length;return {usuario:Nuvem.user?.email,estado:Nuvem.estado,localIndexedDB:conta}})()
