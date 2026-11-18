# Decisões técnicas — Bancada

Registro curto do que foi decidido, por quê e o que ainda está em aberto. Atualizado em 18/11/2026.

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
| Cliente na abertura da OS | Cada OS cria um cliente novo | Simples no MVP. Reaproveitar um cliente existente entra com a tela de Clientes |
| Autenticação | Modo demonstração: middleware fixa a oficina `demo-workshop` | Aprovado para a demo local; **não é seguro para produção** |
| Estilo | CSS Modules + variáveis CSS em `tokens.css` | Sem dependência extra; a paleta muda em um único arquivo |
| Validação | Zod no front (React Hook Form) e de novo na API | O servidor nunca confia no front |
| Acessibilidade | Rótulos visíveis, erros ligados por `aria-describedby`, status sempre com texto, fonte mínima de 12 px, foco visível | Requisitos da seção 12 da especificação |

## Em aberto

1. **Paleta de cores:** a interface usa tons neutros provisórios. Nenhuma cor foi aprovada.
2. **Autenticação real** e isolamento por usuário.
3. **Repositório GitHub:** falta criar e dar acesso ao professor. Integrantes: Fábio José Moretão de Souza e Guilherme Olimpio Rodrigues.
4. **PostgreSQL:** caminho preparado, ainda não testado.

## Próximas etapas (sequência da especificação)

1. Paleta de cores (aprovação do usuário).
2. Telas de Clientes e Instrumentos.
3. Entrega escolar: PDF, apresentação e publicação no GitHub.

Concluído em 18/11: diagnóstico, orçamento versionado e publicação; decisão do cliente pelo link (com idempotência); transições de andamento (peça, reparo, pronto, entrega); notas internas e atualizações públicas.
