# EmployeeHub

Employee management system: employees, departments, attendance, leaves, reimbursements (with receipt uploads), payroll and an audit log, with admin, manager and employee roles.

- **Frontend:** React 19 + Vite + Tailwind CSS (this folder)
- **Backend:** Node.js + Express 5 + PostgreSQL in [`server/`](server/README.md)

## Run it locally

You need Node.js 20+ and PostgreSQL 14+ (or Docker).

```bash
# 1. Database
docker compose up -d            # or: createdb ems

# 2. API (http://localhost:5000)
cd server
cp .env.example .env            # set JWT_SECRET; adjust DATABASE_URL if needed
npm install
npm run db:reset                # tables + demo data
npm run dev

# 3. Frontend (http://localhost:5173), in another terminal
cd ..
npm install
npm run dev
```

Vite forwards `/api` to the API, so there is nothing else to configure in development. If the API is on another host in production, build with `VITE_API_URL=https://api.example.com` and set `CORS_ORIGIN` on the server.

## Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@employeehub.com | admin123 |
| Manager (HR) | sneha.joshi@example.com | password123 |
| Manager (Sales) | karan.shah@example.com | password123 |
| Manager (Engineering) | amit.patel@example.com | password123 |
| Employee | priya.mehta@example.com (and the rest) | password123 |

## Scripts

| Where | Command | What it does |
| --- | --- | --- |
| root | `npm run dev` | Frontend dev server |
| root | `npm run build` | Production build in `dist/` |
| root | `npm run lint` | ESLint |
| server | `npm run dev` | API with auto-reload |
| server | `npm test` | API tests (needs an `ems_test` database) |
| server | `npm run db:reset` | Recreate tables and demo data |

See [server/README.md](server/README.md) for the API endpoints, roles, payroll rules and production notes.
