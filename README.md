# Cadence Monorepo

This repository hosts a NestJS backend (backend/) and a SvelteKit frontend (frontend/) side by side, along with Docker services for PostgreSQL and pgAdmin.

## Prerequisites

- Node.js 18+
- npm 9+
- Docker Desktop (for running the database stack)

## Project Structure

- backend/  NestJS REST API scaffolded with the Nest CLI
- frontend/  SvelteKit application scaffolded with the sv CLI
- docker-compose.yml  PostgreSQL 17 and pgAdmin services

## Getting Started

### Backend

`
cd backend
npm install
npm run start:dev
`

The API will be available on http://localhost:3000 by default.

### Frontend

`
cd frontend
npm install
npm run dev -- --open
`

The app will start on the next available port (typically http://localhost:5173).

## Database Stack

Bring up PostgreSQL 16 and pgAdmin using Docker Compose:

`
docker-compose up -d
`

Services:

- db exposes PostgreSQL on localhost:5432 with database/user/password orga
- pgadmin exposes the pgAdmin web UI on http://localhost:5050

Default pgAdmin credentials:

- Email: admin@orga.local
- Password: orga

### Connecting pgAdmin to PostgreSQL

1. Open http://localhost:5050 and sign in with the credentials above.
2. Create a new server connection pointing to host db, port 5432, maintenance database orga, username orga, and password orga.

When finished, shut everything down with:

`
docker-compose down
`

