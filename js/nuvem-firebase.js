// Módulo Firebase embutido (como no SIPOG). Expõe em window.__fb uma interface pequena usada pelo script principal: onAuth, login, logout, listen e commit.
const cfg=window.TCS_FIREBASE_CONFIG;
if(cfg&&!window.__fb){
 try{
  const V='https://www.gstatic.com/firebasejs/12.15.0/';
  const [{initializeApp},fs,au]=await Promise.all([import(V+'firebase-app.js'),import(V+'firebase-firestore.js'),import(V+'firebase-auth.js')]);
  const app=initializeApp(cfg);
  const db=fs.initializeFirestore(app,{localCache:fs.persistentLocalCache({tabManager:fs.persistentMultipleTabManager()}),ignoreUndefinedProperties:true});
  const auth=au.getAuth(app);
  window.__fb={
   onAuth:cb=>au.onAuthStateChanged(auth,u=>cb(u?{email:u.email,nome:u.displayName||u.email}:null)),
   login:()=>au.signInWithPopup(auth,new au.GoogleAuthProvider()),
   logout:()=>au.signOut(auth),
   listen:(store,onChanges,onError)=>fs.onSnapshot(fs.collection(db,store),{includeMetadataChanges:true},snap=>onChanges(snap.docChanges().map(c=>({type:c.type,id:c.doc.id,data:c.doc.data(),pending:c.doc.metadata.hasPendingWrites})),{fromCache:snap.metadata.fromCache}),onError),
   commit:async ops=>{for(let i=0;i<ops.length;i+=450){const b=fs.writeBatch(db);ops.slice(i,i+450).forEach(o=>o.op==='delete'?b.delete(fs.doc(db,o.store,o.id)):b.set(fs.doc(db,o.store,o.id),o.data));await b.commit()}}
  };
 }catch(e){console.error('Firebase indisponível:',e);window.__fbErro=e.message}
 window.dispatchEvent(new Event('tcs-fb'));
}
