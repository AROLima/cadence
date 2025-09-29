# Backend Architecture

A high-level view of modules and their dependencies. Render the Mermaid diagram in a Markdown viewer that supports it.

```mermaid
flowchart LR
  subgraph Core
    App[AppModule]
    Common[Common (decorators, guards, interceptors, pipes, swagger)]
    Prisma[PrismaService]
  end

  subgraph Features
    Auth[Auth]
    Users[Users]
    Me[Me]
    Tasks[Tasks]
    Finance[Finance]
    Reports[Reports]
    Audit[Audit]
    Admin[Admin]
  end

  App --> Common
  App --> Prisma
  App --> Auth
  App --> Users
  App --> Me
  App --> Tasks
  App --> Finance
  App --> Reports
  App --> Audit
  App --> Admin

  Auth --> Prisma
  Users --> Prisma
  Me --> Prisma
  Tasks --> Prisma
  Finance --> Prisma
  Reports --> Prisma
  Audit --> Prisma
  Admin --> Prisma

  %% Cross-cutting
  Common --> Audit
  Common --> Auth

  %% External
  subgraph External
    DB[(PostgreSQL)]
    AdminJS[(AdminJS)]
  end

  Prisma --> DB
  Admin --> AdminJS
```

## Notes
- All feature modules depend on `PrismaService` for data access.
- Global interceptors live in `Common` and are wired in `AppModule`.
- AdminJS is mounted best-effort and secured with auth + rate limiting + optional IP allowlist.
