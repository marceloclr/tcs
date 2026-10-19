// Módulo Firebase (carregado como módulo). Expõe em window.__fb uma interface pequena usada pelos scripts comuns:
// onAuth, login, logout, listen (coleção inteira ou filtrada), listenDoc, get, commit e limparCache.
// Filtros: [[campo, operador, valor], ...]; o campo '__id__' é o id do documento.
// Testes: em localhost, ?emulador=1 liga o app aos emuladores locais (Firestore 8089, Auth 9099) do projeto demo-tcs; ver testes/.
const EMULADOR=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&new URLSearchParams(location.search).has('emulador');
const cfg=window.TCS_FIREBASE_CONFIG&&(EMULADOR?{...window.TCS_FIREBASE_CONFIG,projectId:'demo-tcs',authDomain:location.host}:window.TCS_FIREBASE_CONFIG);
if(cfg&&!window.__fb){
 try{
  const V='https://www.gstatic.com/firebasejs/12.15.0/';
  const [{initializeApp},fs,au]=await Promise.all([import(V+'firebase-app.js'),import(V+'firebase-firestore.js'),import(V+'firebase-auth.js')]);
  const app=initializeApp(cfg);
  const db=fs.initializeFirestore(app,{localCache:fs.persistentLocalCache({tabManager:fs.persistentMultipleTabManager()}),ignoreUndefinedProperties:true});
  const auth=au.getAuth(app);
  if(EMULADOR){fs.connectFirestoreEmulator(db,'127.0.0.1',8089);au.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true})}
  const campo=c=>c==='__id__'?fs.documentId():c;
  const consulta=(store,filtros)=>filtros&&filtros.length?fs.query(fs.collection(db,store),...filtros.map(([c,op,v])=>fs.where(campo(c),op,v))):fs.collection(db,store);
  const mudancas=snap=>snap.docChanges().map(c=>({type:c.type,id:c.doc.id,data:c.doc.data(),pending:c.doc.metadata.hasPendingWrites}));
  window.__fb={
   onAuth:cb=>au.onAuthStateChanged(auth,u=>cb(u?{email:(u.email||'').toLowerCase(),nome:u.displayName||u.email,verificado:u.emailVerified}:null)),
   login:()=>au.signInWithPopup(auth,new au.GoogleAuthProvider()),
   logout:()=>au.signOut(auth),
   // listen(store, onChanges, onError) escuta a coleção inteira; listen(store, filtros, onChanges, onError) escuta uma consulta.
   listen:(store,a,b,c)=>{const [filtros,onChanges,onError]=Array.isArray(a)?[a,b,c]:[null,a,b];return fs.onSnapshot(consulta(store,filtros),{includeMetadataChanges:true},snap=>onChanges(mudancas(snap),{fromCache:snap.metadata.fromCache}),onError)},
   listenDoc:(store,id,onDoc,onError)=>fs.onSnapshot(fs.doc(db,store,id),{includeMetadataChanges:true},d=>onDoc(d.exists()?d.data():null,{fromCache:d.metadata.fromCache,pending:d.metadata.hasPendingWrites}),onError),
   get:async(store,id)=>{const d=await fs.getDoc(fs.doc(db,store,id));return d.exists()?d.data():null},
   commit:async ops=>{for(let i=0;i<ops.length;i+=450){const b=fs.writeBatch(db);ops.slice(i,i+450).forEach(o=>o.op==='delete'?b.delete(fs.doc(db,o.store,o.id)):o.op==='update'?b.update(fs.doc(db,o.store,o.id),o.data):b.set(fs.doc(db,o.store,o.id),o.data));await b.commit()}},
   // Apaga o cache local do Firestore (acesso revogado ou usuário desativado). Depois disso a página precisa ser recarregada.
   limparCache:async()=>{try{await fs.terminate(db)}catch(e){}try{await fs.clearIndexedDbPersistence(db)}catch(e){console.error('Falha ao limpar o cache do Firestore:',e)}},
   agora:()=>fs.serverTimestamp()
  };
  // Só no emulador: entra com uma conta Google simulada, sem janela.
  if(EMULADOR)window.__fb.loginTeste=email=>au.signInWithCredential(auth,au.GoogleAuthProvider.credential(JSON.stringify({sub:email,email,email_verified:true,name:email.split('@')[0]})));
 }catch(e){console.error('Firebase indisponível:',e);window.__fbErro=e.message}
 window.dispatchEvent(new Event('tcs-fb'));
}
