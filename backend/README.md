## Cadence API (NestJS)

NestJS + Prisma backend for auth, tasks, finance, and reports.

### Quick start

```
npm install
copy .env.example .env  # update DATABASE_URL and secrets as needed
npm run start:dev
```

Swagger: enabled in non-production at /docs (configurable via env).

### Environment

See `.env.example` for all options. Key variables:
- DATABASE_URL (PostgreSQL)
- JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (required in production)
- ALLOWED_ORIGINS (comma-separated, production only)
- SWAGGER_ENABLED, SWAGGER_PATH
- RATE_LIMIT_* and TRUST_PROXY
- ADMIN_EMAIL, ADMIN_PASSWORD (admin user seeded by `npm run seed`)

### Security
- Helmet and rate limiting enabled by default.
- Tight CORS in production; permissive for localhost dev.
- Refuses to start in production without JWT secrets.

### Admin account
- Seeding creates an admin user for local/dev:
	- Email: `admin@orga.app` (configurable via ADMIN_EMAIL)
	- Password: `admin1234` (configurable via ADMIN_PASSWORD)
	- A demo user is also created: `demo@orga.app` / `demo1234`.

### Admin UI (/admin)
- Optional AdminJS UI is mounted at `/admin` if dependencies are installed:
	- Install: `npm i adminjs @adminjs/express @adminjs/prisma express-session` (optional in dev)
	- Protected with basic email/password (uses ADMIN_EMAIL/ADMIN_PASSWORD) and extra rate limiting.
	- Optional allowlist via `ADMIN_ALLOWLIST` (comma-separated IPs).
