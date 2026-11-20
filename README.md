# Bancada

SaaS para pequenas oficinas de reparo de instrumentos musicais. A oficina organiza a ordem de serviço (OS) da entrada do instrumento até a entrega: diagnóstico, orçamento com versões e andamento. O cliente acompanha por um **link privado**, sem criar conta.

Repositório: https://github.com/fabiomoretao/bancada-saas · Documento do projeto: [`docs/Bancada_Documento.pdf`](docs/Bancada_Documento.pdf)

## Integrantes

- Fábio José Moretão de Souza
- Guilherme Olimpio Rodrigues

## Problema e público

Pequenas oficinas recebem instrumentos, avaliam defeitos, orçam serviços e peças, pedem aprovação e acompanham o reparo. Quando isso fica espalhado em mensagens, papel e planilhas, é difícil saber qual orçamento está valendo, o que já foi aprovado e em que etapa cada instrumento está.

- **Usuário principal:** responsável ou técnico de uma oficina independente (luthieria).
- **Usuário externo:** cliente da oficina, que acompanha a própria OS e responde ao orçamento pelo link privado.

## Modelo de negócio

Assinatura mensal paga pela oficina; o cliente final não paga nada nem cria conta.

- **Plano Solo:** uma oficina com equipe pequena, com limite de ordens ativas.
- **Plano Equipe:** cobrança por usuário, com mais volume de ordens e recursos de histórico e relatórios.

Preços e limites ainda precisam ser validados com oficinas. O MVP não tem cobrança.

> Projeto acadêmico (FATEC — TG). Cada oficina cria a própria conta; funcionários entram com e-mail e senha e só veem os dados da sua oficina.

## Como rodar (Windows, macOS ou Linux)

Requisito: **Node.js 22 ou 24 (versão LTS)**. Confira com `node -v`.

```powershell
npm install        # instala front, API e pacote compartilhado
npm run setup      # cria apps/api/.env, o banco SQLite e os dados de demonstração
npm run dev        # sobe API (porta 3333) e front (porta 5173) juntos
```

Abra **http://localhost:5173** e entre com uma conta de demonstração (senha `bancada123`):

| E-mail | Função |
|---|---|
| `dono@bancada.demo` | Responsável: tudo, inclusive a equipe |
| `tecnico@bancada.demo` | Técnico: fila, orçamentos, clientes e instrumentos |

Ou clique em **Criar conta da oficina** para começar uma oficina nova, vazia.

**Atualizando de uma versão anterior:** rode `npm run db:reset` uma vez. Ele recria o banco com as tabelas de contas e as contas de demonstração.

O comando `setup` também imprime os links privados de cada OS de exemplo.

| Comando | O que faz |
|---|---|
| `npm run dev` | API + front com recarga automática |
| `npm test` | Testes do domínio e da API |
| `npm run typecheck` | Verificação de tipos em todos os pacotes |
| `npm run build` | Build de produção do front |
| `npm run db:migrate` | Aplica migrações novas sem apagar dados |
| `npm run db:reset` | Apaga o banco local e recria os dados de demonstração |

**Se o `npm install` falhar no Windows** com erro de compilação do `better-sqlite3`, normalmente é uma versão de Node sem binário pronto. Instale a versão LTS do Node e rode `npm install` de novo.

**Não rode `npm audit fix --force`.** O aviso de vulnerabilidade "high" que aparece no `npm install` vem do `picomatch`, usado só pelas ferramentas de desenvolvimento (Vite e Vitest). Ainda não existe versão corrigida e ele não vai para o app. O `--force` "resolve" o aviso rebaixando o Vite e o Vitest para versões antigas, que têm falhas mais graves, e reescreve os `package.json`.

O campo `allowScripts` no `package.json` raiz autoriza os scripts de instalação do `better-sqlite3` (que baixa o binário do SQLite) e do `esbuild`, exigidos pelo npm 11.16 ou mais recente.

## Stack

| Camada | Tecnologia |
|---|---|
| Front | React 19 + TypeScript, Vite, React Router, TanStack Query, React Hook Form + Zod, CSS Modules |
| API | Node.js + Express 5 + TypeScript (executado com `tsx`) |
| Banco | SQLite local via **Kysely** (query builder tipado). Estrutura pronta para PostgreSQL |
| Compartilhado | `packages/shared`: esquemas Zod, máquina de estados, tipos de resposta, dinheiro em centavos |
| Testes | Vitest + Supertest |
| Interface | Inter (texto e preços), Bricolage Grotesque (títulos), ícones Phosphor |

## Estrutura

```
bancada-saas/
├─ packages/shared/src/
│  ├─ status.ts        máquina de estados da OS (única fonte das transições)
│  ├─ schemas.ts       validações Zod usadas no front e na API
│  ├─ money.ts         valores em centavos e formatação BRL
│  └─ types.ts         contratos de resposta da API
├─ apps/api/src/
│  ├─ modules/
│  │  ├─ work-orders/      routes → service → repository (+ mapper)
│  │  ├─ auth/             criar conta, entrar, sair, sessão
│  │  ├─ team/             equipe e papéis
│  │  ├─ customers/        cadastro, busca e aviso de duplicidade
│  │  ├─ instruments/      consulta e histórico
│  │  ├─ estimates/        rascunho e publicação de versões
│  │  └─ public-tracking/  rotas do cliente (só dados públicos)
│  ├─ middleware/      sessão (requireAuth), origem, validação, erros padronizados
│  ├─ lib/             tokens do link privado, IDs, erros de domínio
│  ├─ db/              conexão, esquema, migrações, seed, CLI
│  ├─ app.ts           monta a aplicação (usado também pelos testes)
│  └─ server.ts
├─ apps/web/src/
│  ├─ pages/           Entrar, Criar conta, Fila + detalhe, Nova ordem, Orçamento,
│  │                   Clientes, Instrumentos, Equipe, Link do cliente
│  ├─ components/      status, linha do tempo, orçamento, toasts…
│  ├─ layout/          shell da oficina (navegação lateral)
│  ├─ api/             cliente HTTP e hooks do TanStack Query
│  └─ styles/tokens.css  design tokens (paleta Nogueira)
└─ docs/decisoes.md    decisões técnicas e pendências
```

## Arquitetura em uma frase

Monólito modular em camadas: as rotas só validam e respondem; os serviços aplicam as regras dentro de transações; os repositórios são o único acesso ao banco e sempre filtram por oficina; a máquina de estados é uma função pura compartilhada e testada. Detalhes em [`docs/decisoes.md`](docs/decisoes.md).

## API

| Método e rota | Uso |
|---|---|
| `POST /api/auth/signup` | Criar conta: nova oficina + responsável, já entra |
| `POST /api/auth/login` · `POST /api/auth/logout` | Entrar e sair (cookie de sessão httpOnly) |
| `GET /api/auth/me` · `POST /api/auth/password` | Sessão atual · trocar a própria senha |
| `GET /api/team` · `POST /api/team` · `PATCH /api/team/:id` | Equipe: listar; responsável cadastra, muda função e desativa |
| `GET /api/instruments?query=` · `GET /api/instruments/:id` | Buscar instrumentos; dono e histórico de reparos |
| `GET /api/work-orders?query=&status=` | Buscar e filtrar ordens da oficina |
| `POST /api/work-orders` | Criar OS com cliente existente (`mode: "existing"`) ou novo (`mode: "new"`, exige telefone **ou** e-mail) e instrumento existente ou novo; gera o link privado |
| `GET /api/work-orders/:id` | Detalhe da OS com orçamentos, histórico e link |
| `POST /api/work-orders/:id/transitions` | Mudar status: `start_evaluation`, `register_part_arrival`, `complete_repair`, `deliver` |
| `PUT /api/work-orders/:id/estimates/draft` | Criar ou editar o rascunho do orçamento |
| `DELETE /api/work-orders/:id/estimates/draft` | Descartar o rascunho |
| `POST /api/work-orders/:id/estimates/:version/publish` | Publicar a versão (fica imutável) e aguardar aprovação |
| `POST /api/work-orders/:id/events` | Nota interna ou atualização pública |
| `POST /api/work-orders/:id/public-link` | Gerar link novo e revogar o anterior |
| `GET /api/customers?query=` | Buscar clientes por nome, telefone ou e-mail |
| `GET /api/customers/:id` | Cadastro, instrumentos e ordens anteriores do cliente |
| `POST /api/customers` · `PUT /api/customers/:id` | Cadastrar ou editar cliente (409 `possible_duplicate` se o contato já existir; reenviar com `allowDuplicate: true` para seguir) |
| `GET /api/customers/duplicates?phone=&email=` | Aviso de duplicidade enquanto a pessoa digita |
| `GET /api/public/orders/:token` | Visão pública de uma OS |
| `POST /api/public/orders/:token/decision` | Cliente aprova, pede revisão ou recusa a versão vigente |

Todas as rotas, menos `/api/auth/signup`, `/api/auth/login` e `/api/public/*`, exigem sessão (401 sem login). Erros seguem sempre o formato `{ "error": { "code", "message", "fields"? } }`.

## Segurança e privacidade

- O link do cliente usa um token aleatório de 256 bits. O banco guarda o **hash SHA-256** para localizar a OS e uma cópia **cifrada (AES-256-GCM)** para a oficina copiar o link de novo. O token nunca fica em texto puro. A chave está em `apps/api/.env`, que não vai para o Git.
- A rota pública monta a resposta com uma lista explícita de campos: telefone, e-mail, número de série e eventos internos nunca saem por ela.
- Token malformado, inexistente ou revogado recebem a mesma resposta 404.
- **Contas e sessões:** senha guardada com scrypt (com salt, nunca em texto). A sessão é um token aleatório num cookie `HttpOnly`, `SameSite=Lax` (e `Secure` em produção); o banco guarda só o hash. Sessões expiram em 7 dias, acabam ao sair e são encerradas na hora quando o responsável desativa um acesso ou a pessoa troca a senha.
- **Login:** a mesma mensagem para e-mail inexistente e senha errada, e bloqueio após 10 tentativas em 15 minutos.
- **CSRF:** alterações só são aceitas vindas do próprio front (checagem do cabeçalho `Origin`), além do `SameSite`.
- **Isolamento entre oficinas:** o middleware `requireAuth` define a oficina da sessão; serviços e repositórios filtram toda consulta por ela. Há testes que tentam ler e alterar dados de outra oficina.
- **Papéis:** responsável e técnico. Só o responsável gerencia a equipe, e a oficina sempre mantém pelo menos um responsável ativo.

## Testes

`npm test` roda 92 testes: máquina de estados, validações, dinheiro e a API com banco em memória, incluindo o fluxo completo da entrada à entrega e o cadastro de clientes. Eles cobrem os critérios de aceite 1 a 15 da especificação: contato alternativo, campos obrigatórios, busca e filtro, link correto e sem dados privados, aprovação, revisão com nova versão, recusa, bloqueio de reparo sem aprovação, idempotência da decisão e isolamento entre oficinas. Também cobrem a busca de clientes, o aviso de duplicidade, a abertura de OS com cliente e instrumento já cadastrados, login, sessões, equipe, papéis e instrumentos.

## Fluxo para demonstrar

0. **Entrar** com `dono@bancada.demo`. **Clientes** → busque "caio" e veja os instrumentos e as ordens dele → **Nova OS**: o cliente já vem selecionado; escolha o violão. Para ver o aviso de duplicidade, em **Nova ordem** cadastre um cliente novo com o telefone (11) 98888-1234.
1. **Fila** → abra uma OS em "Recebido" → **Iniciar avaliação**.
2. **Preparar orçamento**: diagnóstico e itens → **Publicar para o cliente**.
3. **Copiar link do cliente** e abra em outra aba (ou no celular).
4. No link: **Pedir revisão** com uma mensagem.
5. Na oficina: a mensagem aparece → **Preparar V. 02** → publicar. A V. 01 fica preservada.
6. No link: **Aprovar orçamento**.
7. Na oficina: **Concluir reparo** (com orientação de retirada) → **Registrar entrega**.
8. O link do cliente mostra cada etapa. As notas internas não aparecem.

## PostgreSQL (futuro)

As migrações usam só tipos portáveis (`text` e `integer`) e a conexão já reconhece `postgres://…` em `DATABASE_URL`. Esse caminho **ainda não foi testado** contra um PostgreSQL real.

## Uso de IA

- **OpenAI Codex:** ideação, fluxo, especificação e protótipo de telas.
- **Claude (Anthropic):** stack e arquitetura, programação (API, banco, telas), testes, solução de problemas de instalação, documentação e propostas de paleta.

A equipe aprovou cada decisão, testou o sistema e revisou o código. Detalhes e exemplos concretos no PDF, seção 8.
