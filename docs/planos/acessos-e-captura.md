# Plano: acessos por projeto e captura de notas pelo celular

Pedido de 19/10/2026 (Etapas 0–6). Diagnóstico da Etapa 0 aprovado com estas decisões:

- **Sem Cloud Storage** (plano Spark): fotos comprimidas no Firestore, fatiadas em partes de até 700 KB.
- **Administradores iniciais:** `marceloclr@gmail.com` e `thiagocsampaio@gmail.com`.
- **Projetos** podem ser criados por administradores e pelo Escritório com escrita no cliente.
- **Push a cada entrega**; commits pequenos por passo.
- O `index.html` deixou de ser arquivo único: estilos em `css/` e scripts em `js/`, para a `captura.html` reaproveitar o código e o service worker guardar cada parte.

## Modelo de dados (Firestore)

| Coleção | Quem lê | Quem grava |
|---|---|---|
| `usuarios/{email}` | o próprio e os administradores | administradores |
| `solicitacoes/{email}` | administradores | o próprio (cria) |
| `auditoria/{id}` | administradores | administradores (só cria) |
| `config/admins` | usuários ativos | administradores |
| `clients`, `projects` | quem tem acesso ao cliente/projeto (Obra: só projetos concedidos) | escrita no cliente/projeto |
| `allocations`, `movements` (SAIDA), `quotes` | pelo `clientId`/`projectId` | escrita no projeto |
| `invoices`, `movements` (ENTRADA) | administradores; Escritório com escrita em algum projeto (notas a vincular); quem tem acesso a todos os projetos ou clientes da nota | escrita em algum projeto |
| `notas_projeto/{notaId__projetoId}` | quem tem acesso ao projeto | escrita no projeto |
| `chaves/{chave}` | Escritório ativo, só `get` (nunca listar) | criação única, junto com a nota |
| `products` | Escritório ativo | escrita em algum projeto |
| `capturas`, `capturas_fotos` | Escritório com escrita no projeto; a Obra, as próprias | Obra cria; Escritório atualiza |

`acessos` no documento do usuário: `{"c:<clienteId>": {nivel: "L"|"E", validade}, "p:<projetoId>": {...}}`.

## Etapas
1. **1A** modelo e migração (backup, migração, conferência de totais, reversão). **1B** regras, login por cadastro, aba Usuários e acessos, auditoria. **1C** app filtrado por escopo (escutas por consulta, reconciliação com escopo, nota parcial).
2. Importador de imagens, códigos de barras e QR, chave validada por módulo 11, duplicidade por `chaves`.
3. Links de consulta: classificação, "Abrir consulta", PDF salvo e texto colado com adaptadores (genérico e NFC-e/CE).
4. `captura.html` (PWA, offline, Share Target).
5. Fila "Notas recebidas da obra".
6. Validação final e `ACESSOS-E-CAPTURA.md`.

## Riscos conhecidos
- Notas com projetos concedidos parte por cliente, parte por projeto: o usuário vê só as projeções.
- Fornecedores são derivados das notas visíveis.
- `stock` global do produto continua visível ao Escritório.
- Cota de 1 GiB do Firestore com as fotos.
