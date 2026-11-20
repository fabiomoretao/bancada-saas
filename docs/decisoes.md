# Decisões técnicas — Bancada

Registro curto do que foi decidido, por quê e o que ainda está em aberto. Atualizado em 20/11/2026.

## Decididas

| Tema | Decisão | Motivo |
|---|---|---|
| Organização | Um repositório com npm workspaces: `packages/shared`, `apps/api`, `apps/web` | Front e API usam os mesmos esquemas, tipos e máquina de estados sem publicar pacotes |
| Arquitetura | Monólito modular em camadas (routes → service → repository) | Simples de explicar e de testar; sem microserviços no MVP |
| Acesso a banco | **Kysely** + better-sqlite3 (SQLite) | Query builder tipado; migrações em código, portáveis para PostgreSQL. O Prisma foi descartado porque a versão atual baixa binários de um servidor bloqueado no ambiente de desenvolvimento usado, o que impedia testar antes de entregar |
| Convenções de dados | IDs UUID em texto, datas ISO 8601 em UTC, booleanos 0/1, dinheiro em centavos inteiros | Funciona igual em SQLite e PostgreSQL; evita erro de arredondamento |
| Numeração de OS | `OS-0001` por oficina, reservada atomicamente em `workshops.next_order_number` | Código único por oficina mesmo com criações simultâneas |
| Máquina de estados | Função pura `nextStatus()` em `packages/shared/src/status.ts` | Única fonte das transições; o servidor decide, o front só usa para exibir ações |
| Mudança de escopo | Publicar uma nova versão a partir de `Aguardando peça` ou `Em reparo` volta a OS para `Aguardando aprovação` | Regra da especificação: o escopo alterado exige nova aprovação |
| Decisão do cliente | Só vale para a versão publicada mais recente; repetir a mesma decisão não cria evento novo; responder a uma versão substituída retorna 409 | Critérios da seção 5.3 |
| Status de orçamento | `draft`, `published`, `approved`, `revision_requested`, `rejected`, `superseded` | Acrescentado `revision_requested` para distinguir pedido de revisão de recusa |
| Link privado | Token de 256 bits; hash SHA-256 para busca e cópia cifrada AES-256-GCM | A especificação pede hash, e a oficina precisa copiar o link de novo. O token nunca fica em texto puro |
| Cadastro de clientes | A OS aponta para um cadastro: buscado e selecionado na abertura, ou criado na hora. O instrumento pode ser um já cadastrado para aquele cliente | Histórico por cliente e por instrumento; menos retrabalho no balcão |
| Duplicidade | Telefone e e-mail **não** são únicos. Contato repetido (só dígitos no telefone, sem +55; e-mail em minúsculas) gera aviso com os cadastros parecidos; a oficina usa o existente ou confirma que é outra pessoa (`allowDuplicate`). A API também confere no envio | Contatos podem ser compartilhados (família, empresa) ou mudar |
| Privacidade do cliente | Rotas `/api/customers` só existem na área da oficina e filtram por oficina; o link público continua sem nome, contato ou outros instrumentos | Dados do cliente restritos à oficina |
| Autenticação | Conta por oficina: criar conta gera a oficina e o responsável; responsável cadastra técnicos com senha inicial. Senha com scrypt; sessão em cookie httpOnly/SameSite=Lax com token aleatório (hash no banco), 7 dias; checagem de Origin contra CSRF; limite de 10 tentativas de login em 15 min | Isolamento real entre oficinas (SaaS) sem dependências extras |
| Papéis | Responsável (gerencia equipe) e Técnico (operação). E-mail de login único no sistema; a oficina sempre mantém um responsável ativo | Simples e suficiente para oficinas pequenas |
| Autor dos eventos | Cada evento da OS guarda o usuário que fez a ação; aparece só no histórico interno | Auditoria (“quem fez o quê”) sem expor a equipe ao cliente |
| Planos | **Solo** R$ 39,90/mês ou R$ 399/ano, 1 acesso; **Equipe** R$ 69,90/mês ou R$ 699/ano, até 3 acessos. Mesmas funções nos dois. Valores em `packages/shared/src/plans.ts` | Definido em 20/11. A única diferença é o número de logins, fácil de explicar e de aplicar |
| Limite de acessos | Conta só usuários ativos. A API recusa (409 `plan_limit`) cadastrar ou reativar além do plano, e descer de plano quando há mais acessos ativos que o novo limite. Oficinas antigas com mais de um acesso migram para o Equipe | O limite vale mesmo se alguém chamar a API direto, sem o front |
| Contas de demonstração | Nenhuma senha no código nem na tela de entrar. O `setup` gera `DEMO_PASSWORD` aleatória no `.env` e grava e-mails, senha e links em `ACESSO-LOCAL.md` (no `.gitignore`). Em produção, sem `DEMO_PASSWORD` e sem seed | Pedido em 20/11: o site deve se comportar como um SaaS em produção, e a disciplina proíbe senhas no repositório |
| Cobrança | Não há pagamento: o plano escolhido é registrado e a troca vale na hora. As telas avisam que é um projeto acadêmico | Fora do escopo da disciplina; um gateway de pagamento entraria depois |
| Paleta | **A · Nogueira** (madeira escura e âmbar), aprovada em 18/11 | Contraste verificado; âmbar só decorativo |
| Estilo | CSS Modules + variáveis CSS em `tokens.css` | Sem dependência extra; a paleta muda em um único arquivo |
| Validação | Zod no front (React Hook Form) e de novo na API | O servidor nunca confia no front |
| Acessibilidade | Rótulos visíveis, erros ligados por `aria-describedby`, status sempre com texto, fonte mínima de 12 px, foco visível | Requisitos da seção 12 da especificação |

## Em aberto

1. Recuperação de senha esquecida: ainda não existe (a pessoa só troca a senha estando logada).
2. **Cobrança real** dos planos (gateway de pagamento, período de teste, inadimplência): fora do MVP.
3. **Repositório GitHub:** falta criar e dar acesso ao professor. Integrantes: Fábio José Moretão de Souza e Guilherme Olimpio Rodrigues.
4. **PostgreSQL:** caminho preparado, ainda não testado.

## Próximas etapas (sequência da especificação)

1. Entrega escolar: PDF, apresentação e publicação no GitHub.

Concluído em 20/11: revisão de todos os fluxos (ponta a ponta no navegador), planos Solo e Equipe com página /planos, escolha no cadastro, troca em Equipe e limite de acessos na API. Correções da revisão: confirmações nativas do navegador trocadas pelo diálogo do sistema (link novo, descartar rascunho, desativar acesso); "Visível para o cliente" volta a desmarcado depois de cada nota; cadastro simultâneo com o mesmo e-mail responde 409 em vez de erro 500; lista da equipe sem rolagem lateral no celular. Depois: tela de entrar sem dados de demonstração, senha da demonstração gerada no `setup` e `ACESSO-LOCAL.md` local; arquivos temporários do SQLite no `.gitignore`.

Concluído em 18/11 (noite): contas da oficina com login e equipe, tela de Instrumentos, paleta Nogueira, cadastro de clientes, busca na abertura da OS e aviso de duplicidade.

Concluído em 18/11: diagnóstico, orçamento versionado e publicação; decisão do cliente pelo link (com idempotência); transições de andamento (peça, reparo, pronto, entrega); notas internas e atualizações públicas.
