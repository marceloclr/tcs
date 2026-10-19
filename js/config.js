// Projeto Firebase do TCS. A apiKey identifica o projeto e não é segredo: o acesso aos dados é controlado pelas regras do Firestore (firestore.rules), que só liberam os e-mails listados. Sem esta configuração, o sistema funciona só no navegador (modo local).
// authDomain usa o domínio web.app: a rede de trabalho bloqueia *.firebaseapp.com (o login travava no handshake TLS), e o web.app passa.
window.TCS_FIREBASE_CONFIG={apiKey:"AIzaSyDb5XrbCVCwdGfS95_uOPgEJaMemAAvytU",authDomain:"thiago-17d18.web.app",projectId:"thiago-17d18",storageBucket:"thiago-17d18.firebasestorage.app",messagingSenderId:"490027596599",appId:"1:490027596599:web:29310c4ef1f92a03e4f8b2"};
// Implantação inicial: no primeiro login, estas contas viram administradoras (se ainda não tiverem cadastro).
// As regras do Firestore (função implantacao) têm a mesma lista. Depois que os administradores tiverem entrado uma vez,
// esvazie as duas listas ([]) e publique as regras de novo: a partir daí, só um administrador cadastra pessoas.
window.TCS_ADMINS_INICIAIS=['marceloclr@gmail.com','thiagocsampaio@gmail.com'];
