# SPEC.md
You are a senior full-stack engineer. Tech stack:  
- **Backend**: NestJS + Prisma + PostgreSQL, JWT Auth, class-validator, Swagger.  
- **Frontend**: SvelteKit + TypeScript + Tailwind + Zod + Chart.js + Lucide icons.  
Project: “Orga” — Personal Management System (**Tasks + Finance**).  

Requirements:
- User auth (bcrypt hash, JWT + refresh tokens, roles USER/ADMIN).  
- Tasks: CRUD, status, priority, due date, tags, subtasks, recurrence (simple RRULE), comments.  
- Finance: accounts, categories (tree), transactions (income/expense/transfer), budgets, recurrence, attachments.  
- Dashboards: productivity (tasks done, burndown, avg lead time), finance (balance, expenses by category, monthly evolution).  
- REST APIs with filters/pagination, `/reports` aggregations, `/me` endpoint.  
- Seed data, Docker setup, minimal CI.  
Deliver clean modular code (DTOs, services, repositories, use cases).  
