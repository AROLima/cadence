# Tour do Código do Backend (NestJS + Prisma)

Este documento oferece um passeio didático pelo backend. Ele aponta os principais arquivos, o que cada um faz, e destaca linhas importantes para estudo.

> Stack: NestJS 11, Prisma 6, Autenticação JWT, Swagger, Helmet, express-rate-limit

---

## Ponto de entrada e amarração

- `src/main.ts`
  - Cria a aplicação Nest e configura pipes globais (`ValidationPipe` com whitelist/transform).
  - Adiciona Helmet e rate limiting global; aplica um limitador mais rígido para rotas de `/auth`.
  - Configura CORS:
    - Em produção, lê origens permitidas de `ALLOWED_ORIGINS`.
    - Em desenvolvimento, libera portas comuns do Vite.
  - Swagger habilitado por `SWAGGER_ENABLED=true` ou automaticamente em desenvolvimento.
  - Configura o desligamento do Prisma (graceful shutdown) e inicia o servidor em `HOST`/`PORT`.
  - Tenta montar o AdminJS (`/admin`) se os pacotes estiverem instalados.

- `src/app.module.ts`
  - Módulo raiz que conecta todos os módulos de funcionalidades.
  - Registra dois interceptors globais:
    - `ApiResponseInterceptor` (normaliza o envelope `{ success, data }`).
    - `AuditInterceptor` (registra requisições mutáveis em `AuditLog`).

## Assuntos transversais (cross-cutting)

- `src/common/`
  - `decorators/` inclui `@CurrentUser()`, `@Public()`, `@Roles()`.
  - `guards/` implementa autenticação JWT e checagem de papéis (roles).
  - `interceptors/api-response.interceptor.ts` padroniza as respostas num formato único.
  - `pipes/pagination.pipe.ts` interpreta/valida parâmetros de paginação.
  - `swagger/swagger.config.ts` centraliza metadados do OpenAPI.

- `src/prisma/prisma.service.ts`
  - Estende `PrismaClient` e fornece hooks de ciclo de vida.
  - `enableShutdownHooks` garante desligamento limpo em SIGINT/SIGTERM.
  - Inclui um accessor tipado para `appSetting` para manter o ESLint satisfeito ao usar acesso dinâmico a propriedades.

- `prisma/schema.prisma`
  - Define os modelos de domínio: `User`, tarefas, entidades de finanças, `AuditLog`, e `UserSetting`/`AppSetting`.
  - `UserSetting` usa uma chave única composta `[userId, key]` para armazenar blobs JSON por usuário (ex.: `key = "preferences"`).

## Autenticação (Auth)

- `src/auth/auth.controller.ts`
  - `POST /auth/register` → cria uma conta e retorna tokens.
  - `POST /auth/login` → retorna tokens de acesso/atualização (access/refresh).
  - `POST /auth/refresh` → troca um refresh token válido por novos tokens.
  - `POST /auth/logout` → revoga refresh tokens ativos.

- `src/auth/auth.service.ts`
  - Cuida do hashing via `bcrypt`, criação de tokens (`@nestjs/jwt`) e persistência do refresh token.

## Me (usuário atual)

- `src/me/me.controller.ts`
  - `GET /me` → perfil do usuário autenticado.
  - `PATCH /me` → atualizar nome/senha (exige senha atual para alterar a senha).
  - `GET /me/settings` → obtém configurações mescladas (default + persistidas).
  - `PATCH /me/settings` → atualiza configurações; mescla rasa + mescla profunda para `notifications`.

- `src/me/me.service.ts`
  - `getProfile`/`updateProfile` → busca/atualiza o usuário atual; valida alteração de senha com `bcrypt.compare`.
  - `getMySettings`
    - Carrega `UserSetting` usando a chave composta `{ userId, key: 'preferences' }`.
    - Linha importante:
      ```ts
      const userSetting = (this.prisma as any)['userSetting'];
      const row = await userSetting.findUnique({
        where: { userId_key: { userId, key: 'preferences' } },
      });
      ```
      Isso evita “ruído” do TypeScript com delegates do Prisma quando o ESLint está estrito.
    - Faz merge com `DEFAULT_MY_SETTINGS` para sempre retornar um objeto completo.
  - `updateMySettings`
    - Lê o JSON atual, mescla níveis superiores e o objeto aninhado `notifications`.
    - Usa `upsert` com a mesma chave composta para criar/atualizar de forma atômica.

- `src/me/dto/update-my-settings.dto.ts`
  - DTOs com validação para tema, locale, timezone, início da semana, notificações e `currency`.
  - `DEFAULT_MY_SETTINGS` define os padrões usados na mesclagem.

## Usuários (admin)

- `src/users/users.controller.ts` + `src/users/users.service.ts`
  - CRUD apenas para administradores, com paginação e busca.
  - Trata erros do Prisma (ex.: violação de unicidade) e mapeia para `UserView`.

## Finanças (Finance)

- `src/finance/finance.controller.ts` + `src/finance/finance.service.ts`
  - Contas: CRUD e saldos calculados via somas agrupadas de transações.
  - Categorias: CRUD e construção de árvore.
  - Transações: listagem com filtros, criação (inclui transferências e parcelas), atualização com regras (ex.: transferências apenas metadados), exclusão (lógica em cascata para grupos de transferência).
  - Orçamentos (Budgets): CRUD e agregação mensal a partir de transações.
  - Padrões-chave:
    - `this.prisma.$transaction` para escritas atômicas de múltiplas linhas (transferências, parcelas).
    - `groupBy` e `aggregate` para resumos eficientes.

## Tarefas (Tasks)

- `src/tasks/*`
  - Gerenciamento simples de tarefas com subtarefas (relação `TaskSubtasks`), tags e comentários.
  - `task-recurrence.service.ts` pode gerenciar agendamentos no estilo RRULE.

## Relatórios (Reports)

- `src/reports/*`
  - Endpoints de exemplo de relatórios; pode expandir com agregações de finanças/tarefas.

## Auditoria (Audit)

- `src/audit/audit.interceptor.ts`
  - Intercepta métodos HTTP mutáveis e envia um snapshot sanitizado para o serviço de auditoria.

- `src/audit/audit.service.ts`
  - Persiste entradas em `AuditLog` (trunca payloads muito grandes para evitar crescimento excessivo do banco).

## Admin

- `src/admin/admin.module.ts`
  - Importa AdminJS/express/prisma sob demanda; monta `/admin` apenas se os módulos estiverem disponíveis.
  - Adiciona rate limiting e lista de IPs permitidos (allowlist) opcional na UI administrativa.

- `src/admin/admin.controller.ts`
  - Ferramentas de exemplo: revogar refresh tokens, reatribuir transações em massa, recalcular saldos.

---

## Dicas de estudo

- Comece por `main.ts` → `app.module.ts` para ver como os módulos se conectam.
- Para cada funcionalidade, olhe `*.controller.ts` (rotas) e depois `*.service.ts` (regra de negócio).
- Padrões do Prisma para aprender:
  - Chaves compostas (`@@unique([userId, key])`) e como consultá-las (`where: { userId_key: { ... } }`).
  - `$transaction` para escritas em múltiplas etapas e `groupBy/aggregate` para relatórios.
- Segurança:
  - Guards JWT protegem as rotas; `RolesGuard` para rotas apenas de admin.
  - Helmet, CORS e rate limiting estão centralizados em `main.ts`.
- Swagger é uma ótima forma de explorar endpoints durante o estudo.

---

## Extensões (onde plugar melhorias)

- Validações adicionais
  - DTOs: adicione regras no próprio DTO (class-validator) e transforme/coerça com class-transformer.
  - Services: regras de negócio mais complexas (ex.: limites, invariantes) nos services (ex.: `FinanceService.createTransaction`).

- Segurança
  - Novos guards (ex.: escopos, ownership avançado): `src/common/guards/*` e decorators em `src/common/decorators/*`.
  - Rate limiting por rota: em `main.ts` (global) ou por módulos específicos (veja `AdminModule` para `/admin`).
  - CORS: ajuste listas em `main.ts` via variáveis de ambiente.

- Observabilidade
  - Logs de auditoria: `AuditInterceptor`/`AuditService` — é simples criar campos extras (motivo, correlação).
  - Métricas/Tracing: adicionar bibliotecas (ex.: OpenTelemetry) nos providers globais.

- Infra/Config
  - Config central: `@nestjs/config` já está global. Adicione schemas/validações para variáveis de ambiente.
  - Admin: adicionar recursos no AdminJS (AdminModule) mapeando novos models do Prisma.
