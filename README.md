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

Assinatura paga pela oficina; o cliente final não paga nada nem cria conta. Os dois planos têm todas as funções; muda só o número de acessos (logins).

| Plano | Mensal | Anual | Acessos |
|---|---|---|---|
| **Solo** | R$ 39,90/mês | R$ 399/ano (equivale a R$ 33,25/mês) | 1 |
| **Equipe** | R$ 69,90/mês | R$ 699/ano (equivale a R$ 58,25/mês) | até 3 |

No anual, a oficina paga 10 mensalidades e usa 12 (2 meses grátis). A página pública **/planos** compara os planos; a oficina escolhe o plano ao criar a conta e troca depois em **Equipe**. A API aplica o limite de acessos: não deixa cadastrar nem reativar pessoas além do plano, e só permite descer do Equipe para o Solo quando sobra 1 acesso ativo.

> Projeto acadêmico (FATEC — TG). Cada oficina cria a própria conta; funcionários entram com e-mail e senha e só veem os dados da sua oficina.

## Como rodar (Windows, macOS ou Linux)

Requisito: **Node.js 22 ou 24 (versão LTS)**. Confira com `node -v`.

```powershell
npm install        # instala front, API e pacote compartilhado
npm run setup      # cria apps/api/.env (chave e senha aleatórias), o banco SQLite e a oficina de demonstração
npm run dev        # sobe API (porta 3333) e front (porta 5173) juntos
```

Abra **http://localhost:5173**. A tela de entrar é a de um SaaS em produção: não mostra contas nem senhas.

**Dados de acesso da demonstração:** o `setup` grava o arquivo **`ACESSO-LOCAL.md`** na raiz do projeto, com os e-mails das contas (responsável e técnico), a senha e os links privados de cada OS de exemplo. A senha é aleatória, gerada em cada computador e guardada em `DEMO_PASSWORD` no `apps/api/.env`. O `ACESSO-LOCAL.md` e o `.env` estão no `.gitignore`: nenhuma senha vai para o código ou para o GitHub.

Ou clique em **Criar conta da oficina** para começar uma oficina nova, vazia, escolhendo o plano. Os planos ficam em **http://localhost:5173/planos**. A oficina de demonstração está no plano **Equipe** (2 de 3 acessos em uso).

**Atualizando de uma versão anterior:** rode `npm install` (há dependência nova: `motion`) e `npm run db:reset` uma vez (com o `npm run dev` parado). Ele acrescenta a senha da demonstração ao `.env`, recria o banco com as contas e gera o `ACESSO-LOCAL.md`. Se a tela de entrar recusa o login, é sinal de que o banco é de antes das contas: o `db:reset` resolve.

**Em produção:** configure o `.env` sem `DEMO_PASSWORD`, rode só `npm run db:migrate` e cada oficina cria a própria conta pela tela **Criar conta**.

| Comando | O que faz |
|---|---|
| `npm run dev` | API + front com recarga automática |
| `npm test` | Testes do domínio e da API |
| `npm run typecheck` | Verificação de tipos em todos os pacotes |
| `npm run build` | Build de produção do front |
| `npm run db:migrate` | Aplica migrações novas sem apagar dados |
| `npm run db:reset` | Apaga o banco local, recria a demonstração e atualiza o `ACESSO-LOCAL.md` |

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
| Animações | [React Bits](https://reactbits.dev) (BlurText, CountUp, SpotlightCard) sobre a biblioteca `motion`, e telas de carregamento no formato de cada página |

### Animações e carregamento

- **Telas de carregamento:** abertura com o logo enquanto o sistema confere o login, e esqueletos com o formato de cada tela (fila, detalhe da OS, orçamento, clientes, instrumentos, equipe e link do cliente). Só aparecem se a resposta demorar mais de 150 ms, para não piscar.
- **React Bits**, só onde ajuda a leitura: o título da página de planos e o status no link do cliente surgem com **BlurText** (e o do cliente se repete quando o status muda); os preços dos planos rolam até o novo valor ao trocar mensal/anual e o total do orçamento corre até o novo valor com **CountUp**; os cartões de plano ganham uma luz âmbar que segue o mouse com **SpotlightCard**.
- Telas de trabalho diário (fila, formulários) não têm animação de entrada, para não atrasar quem usa o sistema o dia todo. Com "reduzir movimento" ativado no sistema operacional, as animações são desligadas ou reduzidas.
- Os componentes ficam em `apps/web/src/components/reactbits/`, com a licença do React Bits (MIT + Commons Clause: uso livre dentro de uma aplicação, sem revender os componentes).

## Estrutura

```
bancada-saas/
├─ packages/shared/src/
│  ├─ status.ts        máquina de estados da OS (única fonte das transições)
│  ├─ schemas.ts       validações Zod usadas no front e na API
│  ├─ money.ts         valores em centavos e formatação BRL
│  ├─ plans.ts         planos Solo e Equipe: preços e limite de acessos
│  └─ types.ts         contratos de resposta da API
├─ apps/api/src/
│  ├─ modules/
│  │  ├─ work-orders/      routes → service → repository (+ mapper)
│  │  ├─ auth/             criar conta, entrar, sair, sessão
│  │  ├─ team/             equipe e papéis
│  │  ├─ workshop/         plano da oficina e limite de acessos
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
│  ├─ pages/           Planos, Entrar, Criar conta, Fila + detalhe, Nova ordem, Orçamento,
│  │                   Clientes, Instrumentos, Equipe (com plano), Link do cliente
│  ├─ components/      status, linha do tempo, orçamento, toasts, telas de carregamento…
│  │  └─ reactbits/    animações do React Bits (BlurText, CountUp, SpotlightCard)
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
| `POST /api/auth/signup` | Criar conta: nova oficina + responsável, com `plan` (`solo`/`team`) e `billingCycle` (`monthly`/`yearly`); já entra |
| `POST /api/auth/login` · `POST /api/auth/logout` | Entrar e sair (cookie de sessão httpOnly) |
| `GET /api/auth/me` · `POST /api/auth/password` | Sessão atual · trocar a própria senha |
| `GET /api/team` · `POST /api/team` · `PATCH /api/team/:id` | Equipe: listar; responsável cadastra, muda função e desativa (409 `plan_limit` acima do limite do plano) |
| `GET /api/workshop/plan` · `PUT /api/workshop/plan` | Plano da oficina e acessos em uso; só o responsável troca |
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
- **Sem senhas no repositório:** a senha das contas de demonstração é gerada no `setup` de cada computador (`DEMO_PASSWORD` no `.env`) e aparece só no `ACESSO-LOCAL.md`, também fora do Git. Os testes usam uma senha própria num banco em memória que é apagado ao fim de cada teste.
- A rota pública monta a resposta com uma lista explícita de campos: telefone, e-mail, número de série e eventos internos nunca saem por ela.
- Token malformado, inexistente ou revogado recebem a mesma resposta 404.
- **Contas e sessões:** senha guardada com scrypt (com salt, nunca em texto). A sessão é um token aleatório num cookie `HttpOnly`, `SameSite=Lax` (e `Secure` em produção); o banco guarda só o hash. Sessões expiram em 7 dias, acabam ao sair e são encerradas na hora quando o responsável desativa um acesso ou a pessoa troca a senha.
- **Login:** a mesma mensagem para e-mail inexistente e senha errada, e bloqueio após 10 tentativas em 15 minutos.
- **CSRF:** alterações só são aceitas vindas do próprio front (checagem do cabeçalho `Origin`), além do `SameSite`.
- **Isolamento entre oficinas:** o middleware `requireAuth` define a oficina da sessão; serviços e repositórios filtram toda consulta por ela. Há testes que tentam ler e alterar dados de outra oficina.
- **Papéis:** responsável e técnico. Só o responsável gerencia a equipe e o plano, e a oficina sempre mantém pelo menos um responsável ativo.
- **Limite do plano:** verificado na API, dentro da mesma transação que cria ou reativa o acesso. Esconder o botão no front é só conveniência.

## Testes

`npm test` roda 109 testes: máquina de estados, validações, dinheiro e a API com banco em memória, incluindo o fluxo completo da entrada à entrega e o cadastro de clientes. Eles cobrem os critérios de aceite 1 a 15 da especificação: contato alternativo, campos obrigatórios, busca e filtro, link correto e sem dados privados, aprovação, revisão com nova versão, recusa, bloqueio de reparo sem aprovação, idempotência da decisão e isolamento entre oficinas. Também cobrem a busca de clientes, o aviso de duplicidade, a abertura de OS com cliente e instrumento já cadastrados, login, sessões, equipe, papéis e instrumentos, além dos planos: valores, plano escolhido no cadastro, limite de 1 e 3 acessos, troca de plano, permissão só do responsável e a migração das oficinas que já existiam.

## Fluxo para demonstrar

0. **Entrar** com a conta do responsável que está no `ACESSO-LOCAL.md`. **Clientes** → busque "caio" e veja os instrumentos e as ordens dele → **Nova OS**: o cliente já vem selecionado; escolha o violão. Para ver o aviso de duplicidade, em **Nova ordem** cadastre um cliente novo com o telefone (11) 98888-1234.
1. **Fila** → abra uma OS em "Recebido" → **Iniciar avaliação**.
2. **Preparar orçamento**: diagnóstico e itens → **Publicar para o cliente**.
3. **Copiar link do cliente** e abra em outra aba (ou no celular).
4. No link: **Pedir revisão** com uma mensagem.
5. Na oficina: a mensagem aparece → **Preparar V. 02** → publicar. A V. 01 fica preservada.
6. No link: **Aprovar orçamento**.
7. Na oficina: **Concluir reparo** (com orientação de retirada) → **Registrar entrega**.
8. O link do cliente mostra cada etapa. As notas internas não aparecem.
9. **Planos:** em **Equipe**, veja "Plano Equipe · 2 de 3 acessos". Adicione uma pessoa: o botão trava em 3 de 3. Em **Mudar plano**, o Solo aparece indisponível até sobrar 1 acesso. Saia e abra **/planos** → **Começar com o Solo** para criar uma oficina com 1 acesso.

## PostgreSQL (futuro)

As migrações usam só tipos portáveis (`text` e `integer`) e a conexão já reconhece `postgres://…` em `DATABASE_URL`. Esse caminho **ainda não foi testado** contra um PostgreSQL real.

## Uso de IA

- **OpenAI Codex:** ideação, fluxo, especificação e protótipo de telas.
- **Claude (Anthropic):** stack e arquitetura, programação (API, banco, telas), testes, solução de problemas de instalação, documentação e propostas de paleta.

A equipe testou o sistema e revisou o código, inclusive as partes geradas com IA. Detalhes e exemplos concretos no PDF, seção 8.
