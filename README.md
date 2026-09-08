# Points Plaza

A complete starter implementation of the Points Plaza rewards platform.

## Stack

- Node.js + Express
- SQLite via better-sqlite3
- JWT authentication
- bcrypt password hashing
- Multer screenshot uploads
- Helmet security headers
- Rate limiting
- Responsive vanilla HTML/CSS/JS frontend

## Run

1. Install Node.js 18+.
2. Run:

```bash
npm install
npm start
```

3. Open `http://localhost:3000`.

The first administrator is seeded automatically:

- Email: `azeemolajuwon25@gmail.com`
- Password: `ChangeMe123!`

**Change this password immediately after first login.**

## Production notes

Before production deployment, use HTTPS, a managed PostgreSQL database, object storage for uploads, a proper secret in an environment variable, backups, email delivery for password reset, and a reverse proxy. The included implementation keeps all balance-changing operations server-side and uses database transactions for critical operations.
