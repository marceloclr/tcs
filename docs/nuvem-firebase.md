# Base na nuvem (Firebase)

O TCS guarda os dados no navegador (IndexedDB) e, para quem entra com uma conta Google liberada, sincroniza tudo com o Firestore do projeto **`thiago-17d18`**.

## Como funciona
- **Coleções:** cada store vira uma coleção (`products`, `invoices`, `movements`, `clients`, `projects`, `allocations` e `quotes`), e cada registro é um documento com o mesmo `id`. O log de atividades fica na coleção `atividades`, que só existe na nuvem (ver `js/atividades.js`).
- **Envio:** toda gravação confirmada no navegador vai para a nuvem, com `_atualizadoEm` e `_atualizadoPor`. Sem internet, a fila fica guardada e é enviada quando a conexão volta.
- **Recebimento:** o que outros usuários alteram chega em tempo real.
- **Conflito:** se duas pessoas editam o mesmo registro ao mesmo tempo, vale a última gravação.
- **Primeiro acesso:** em Dados e segurança › Nuvem, o botão **Enviar base local para a nuvem** sobe os registros que só existem neste navegador.
- **Apagar base, quando conectado:** limpa só a cópia deste navegador e encerra a sessão. A nuvem não é apagada pela tela.
- **Restaurar backup, quando conectado:** envia os registros do backup e os junta aos que já estão na nuvem.
- **Modo local:** sem login, ou se o Firebase não carregar (sem internet), o sistema continua funcionando só no navegador.

## Configuração no console (uma vez)
Acesse https://console.firebase.google.com › projeto **thiago-17d18**.

1. **Firestore Database** › **Criar banco de dados**.
   - Edição Standard.
   - Local `southamerica-east1 (São Paulo)`; essa escolha não muda depois.
   - **Modo de produção**.
2. **Firestore Database** › aba **Regras** › colar o conteúdo de [`firestore.rules`](../firestore.rules) › **Publicar**.
3. **Authentication** › **Vamos começar** › **Método de login** › **Google** › Ativar › escolher o e-mail de suporte › Salvar.
4. **Authentication** › **Configurações** › **Domínios autorizados** › **Adicionar domínio** › `marceloclr.gitlab.io`.

O plano gratuito (Spark) basta.

## Quem tem acesso
O acesso é por pessoa, cliente e projeto, administrado na aba **Usuários e acessos** (só administradores). Detalhes em [`ACESSOS-E-CAPTURA.md`](../ACESSOS-E-CAPTURA.md) e no plano [`planos/acessos-e-captura.md`](planos/acessos-e-captura.md).

- **Papéis:** Administrador (tudo), Escritório (lê ou altera os clientes e projetos concedidos) e Obra (só envia fotos de notas).
- **Concessões:** por cliente (vale para todos os projetos dele, inclusive os futuros) ou por projeto, com nível Leitura ou Leitura e escrita e validade opcional.
- **Quem protege os dados são as regras** em [`firestore.rules`](../firestore.rules): elas leem o cadastro `usuarios/{email}` a cada leitura e gravação. A interface só esconde o que a pessoa não pode usar.
- **Implantação:** as contas em `TCS_ADMINS_INICIAIS` (`js/config.js`) e na função `implantacao()` das regras viram administradoras no primeiro login. Depois que entrarem, esvazie as duas listas e publique as regras de novo.
- **Publicar as regras:** console do Firebase › Firestore Database › Regras › colar o arquivo › Publicar (ou `firebase deploy --only firestore:rules --project thiago-17d18`, na raiz).
- **Testes das regras:** ver [`testes/LEIA-ME.md`](../testes/LEIA-ME.md).

## Sobre a `apiKey`
O bloco `TCS_FIREBASE_CONFIG` do `index.html` identifica o projeto e não é segredo: qualquer site com Firebase o expõe. Quem protege os dados são as regras, que só liberam as contas cadastradas, conforme o papel e os acessos de cada uma.

## Limitações
- O login com Google não funciona com o `index.html` aberto direto do disco (`file://`). Use o site publicado ou um servidor local (`localhost`).
- Um registro excluído na nuvem enquanto este navegador estava fechado volta a aparecer como "só neste navegador". Ele só vai para a nuvem se alguém clicar em **Enviar base local para a nuvem**.
- As regras que impedem distribuir mais unidades do que a nota tem, ou consumir mais do que o saldo, são verificadas no navegador de quem grava. Dois usuários distribuindo a mesma nota no mesmo instante podem, em tese, ultrapassar o total. Para uma equipe pequena, o risco é baixo.
