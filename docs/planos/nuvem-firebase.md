# Plano — base do TCS na nuvem (Firebase)

Decisões de 16/10/2026:
- Firestore com um documento por registro.
- Login Google, só para os e-mails liberados nas regras.
- Projeto Firebase novo, separado do SIPOG.

## Arquitetura
- **Carregamento:** o Firebase entra por um `<script type="module">` embutido no `index.html`, como no SIPOG (SDK 12.15.0 do gstatic). Sem `firebaseConfig`, o sistema continua em **modo local**, como hoje.
- **Fonte de dados:** o IndexedDB continua sendo a base de trabalho e a cópia offline. Cada store vira uma coleção do Firestore com o mesmo nome:
  - `products`, `invoices`, `movements`, `clients`, `projects`, `allocations` e `quotes`;
  - o id do documento é o `id` do registro.
- **Envio:** toda gravação passa por `txWrite`, que grava no IndexedDB. Depois que a transação local é confirmada, a mesma operação vai para o Firestore em lote. Sem rede, o próprio Firestore guarda a fila no cache persistente e envia quando a conexão volta.
- **Recebimento:** escutas em tempo real (`onSnapshot`), uma por coleção, aplicam no IndexedDB as alterações feitas por outros usuários, sem reenviá-las, e atualizam a tela.
- **Primeiro acesso:** se houver registros locais que não estão na nuvem, o botão "Enviar base local para a nuvem" sobe esses registros, com confirmação.
- **Conflito:** dois usuários editando o mesmo registro ao mesmo tempo seguem a regra "o último grava". Cada documento leva `_atualizadoEm` e `_atualizadoPor`.
- **Dados e segurança no modo nuvem:**
  - "Apagar base local" limpa só o cache deste navegador; a nuvem não é apagada pela tela.
  - "Restaurar backup" envia os registros do backup para a nuvem, juntando com o que já existe.

## Passos (um commit cada)
1. **N1 — camada de gravação única.** Todas as gravações (`put`, `del`, importação, exemplo e restauração) passam a usar `txWrite`, que registra as operações. O comportamento não muda; o teste de regressão completo é repetido.
2. **N2 — Firebase.**
   - Módulo embutido com `firebaseConfig` configurável.
   - No cabeçalho: botão "Entrar com Google" e um estado da nuvem (modo local, conectado como…, sincronizando ou offline).
   - Envio, recebimento em tempo real e envio da base local.
   - Teste com um Firestore simulado em memória no Edge headless.
3. **N3 — regras e guia.**
   - `firestore.rules`, com a lista de e-mails e as coleções permitidas.
   - `docs/nuvem-firebase.md`, com o passo a passo do console.
   - Ajustes em Dados e segurança.
4. **N4 — ligar ao projeto real** (depende do `firebaseConfig` do usuário). Gravar a config, publicar as regras no console (usuário) e testar com dois navegadores ao mesmo tempo, além de um teste offline.

## O que o usuário faz no console do Firebase
1. Em https://console.firebase.google.com, "Adicionar projeto" (sugestão: `tcs-estoque`). O Google Analytics não é necessário.
2. Em Build › Firestore Database, criar o banco no **modo de produção**, na região `southamerica-east1` (São Paulo).
3. Em Build › Authentication › Sign-in method, ativar o provedor **Google**.
4. Em Authentication › Settings › Authorized domains, adicionar `marceloclr.gitlab.io` (o `localhost` já vem incluído).
5. Em Configurações do projeto › Seus apps, adicionar um app **Web** (ícone `</>`) e copiar o bloco `firebaseConfig`.
6. Informar os e-mails que terão acesso.

A `apiKey` do `firebaseConfig` não é segredo: ela identifica o projeto. Quem protege os dados são as regras do Firestore com a lista de e-mails.
