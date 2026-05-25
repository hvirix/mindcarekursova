# MindCare Platform

A mental health platform connecting patients with psychologists. Features specialist discovery, appointment scheduling, article publishing, and an admin moderation panel.

## Project Structure

```
MindCare-Platform/
  backend/          Node.js microservices + API gateway
  frontend/         React + Vite + Chakra UI
```

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | React 18, Vite, Chakra UI               |
| Backend  | Node.js, Express 5, Prisma, PostgreSQL  |
| Auth     | JWT (7-day tokens)                      |
| Email    | Nodemailer                              |
| Uploads  | Multer                                  |

---

## Backend — Microservice Architecture

The backend consists of an **API gateway** and **6 independent services**, each running on its own port.

```
backend/
  gateway/                   API gateway — port 5000
  services/
    auth/                    Authentication & user management — port 5001
    psychologist/            Psychologist profiles — port 5002
    article/                 Articles — port 5003
    appointment/             Appointments & scheduling — port 5004
    admin/                   Admin panel — port 5005
    comment/                 Reviews & ratings — port 5006
  shared/
    db.js                    Prisma client (shared)
    middleware/
      auth.js                JWT authentication middleware
      optionalAuth.js        Optional JWT middleware
      upload.js              Multer file upload middleware
      formatDate.js          Date formatting middleware
    utils/
      email.js               Nodemailer email utilities
      markdown.js            Markdown <-> HTML conversion
  prisma/
    schema.prisma            Database schema
```

### Service Port Map

| Service      | Port | Handles                                      |
|--------------|------|----------------------------------------------|
| Gateway      | 5000 | Route proxying, static `/uploads` files      |
| auth         | 5001 | Register, login, /me, photo/doc uploads      |
| psychologist | 5002 | List psychologists, view profile, edit       |
| article      | 5003 | Article CRUD, image upload, moderation flow  |
| appointment  | 5004 | Book slots, view patient/psychologist agenda |
| admin        | 5005 | Stats, moderation, user management           |
| comment      | 5006 | Post and view psychologist reviews           |

All requests from the frontend go to **port 5000**. The gateway strips the route prefix and proxies to the correct service (e.g. `/api/auth/login` → auth service at `/login`).

### Running the Backend

```bash
cd backend

# Development (with hot reload)
npm run dev

# Production
npm start
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mindcare
JWT_SECRET=your_jwt_secret

# Optional — email notifications
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=user@example.com
EMAIL_PASS=password
EMAIL_FROM=noreply@example.com
FRONTEND_URL=http://localhost:3000

# Optional — custom service ports
PORT=5000
AUTH_PORT=5001
PSYCHOLOGIST_PORT=5002
ARTICLE_PORT=5003
APPOINTMENT_PORT=5004
ADMIN_PORT=5005
COMMENT_PORT=5006
```

### Database

```bash
cd backend

# Apply migrations
npm run prisma:migrate

# Deploy migrations (production)
npm run prisma:migrate:deploy

# Open Prisma Studio
npm run prisma:studio
```

---

## Frontend

```bash
cd frontend
npm install
npm run dev     # http://localhost:3000
```

The frontend calls all APIs through `http://localhost:5000` (the gateway). No frontend changes are needed when scaling individual services.

### Pages

| Route                          | Description                          |
|--------------------------------|--------------------------------------|
| `/`                            | Home page                            |
| `/psychologists`               | Browse psychologists                 |
| `/psychologists/:id`           | Psychologist profile & booking       |
| `/login`, `/register`          | Authentication                       |
| `/profile`                     | User profile & settings              |
| `/my-appointments`             | Patient appointment history          |
| `/psychologist/appointments`   | Psychologist schedule                |
| `/article/:id`                 | Article detail                       |
| `/my-articles`                 | Psychologist's own articles          |
| `/admin`                       | Admin panel (admin only)             |

---

## User Roles

| Role          | Capabilities                                                  |
|---------------|---------------------------------------------------------------|
| patient       | Browse psychologists, book appointments, leave reviews        |
| psychologist  | Manage profile, write articles, view own appointments         |
| admin         | Approve/reject psychologists & articles, manage all content   |

Psychologist accounts require admin approval before becoming visible.

---

## Admin CLI Scripts

Utility scripts in `backend/scripts/`:

```bash
cd backend
node scripts/createAdmin.js          # Create an admin account
node scripts/resetPassword.js        # Reset a user's password
node scripts/getUserDetails.js       # Look up a user by ID
node scripts/findUserByHash.js       # Find user by password hash
node scripts/updatePsychologistRoles.js  # Fix psychologist role assignments
```
