# Buddy Script — Backend

REST API for the Buddy Script social feed application. Built with Express 5, Drizzle ORM, and PostgreSQL.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express 5 |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Auth | JWT (jsonwebtoken) + bcrypt |
| File Upload | Multer |
| API Docs | Swagger UI (`/api-docs`) |
| Testing | Jest + Supertest |
| Package Manager | pnpm |

---

## Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL 14+ running locally (or a remote connection string)

---

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

`.env` variables:

```env
NODE_ENV=development
PORT=3001

# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/buddy_script

# JWT signing secret — use a long random string in production
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Allowed frontend origin for CORS
CORS_ORIGIN=http://localhost:5173
```

### 3. Run database migrations

```bash
pnpm drizzle:migrate
```

### 4. (Optional) Seed the database

```bash
pnpm db:seed
```

### 5. Start the development server

```bash
pnpm dev
```

The server starts on `http://localhost:3001`.

---

## Available Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start dev server with hot-reload (ts-node-dev) |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run the compiled production build |
| `pnpm test` | Run all tests (Jest + Supertest) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm drizzle:generate` | Generate a new migration from schema changes |
| `pnpm drizzle:migrate` | Apply pending migrations to the database |
| `pnpm drizzle:push` | Push schema directly (dev only, no migration file) |
| `pnpm drizzle:studio` | Open Drizzle Studio GUI in the browser |
| `pnpm db:seed` | Seed the database with sample data |

---

## Project Structure

```
backend/
├── src/
│   ├── app.ts                  # Express app setup (middleware, routes, Swagger)
│   ├── server.ts               # Entry point — connects DB then starts server
│   ├── config/
│   │   ├── db.ts               # PostgreSQL pool + Drizzle instance
│   │   ├── schema.ts           # Aggregated schema export for Drizzle Kit
│   │   └── swagger.ts          # OpenAPI spec + Swagger UI setup
│   ├── modules/
│   │   ├── auth/               # Registration, login, JWT, /me endpoint
│   │   ├── feed/               # Posts, comments, replies
│   │   └── likes/              # Reactions (like/love/haha/wow/sad/angry)
│   └── shared/
│       ├── middlewares/
│       │   ├── authenticate.ts # JWT verification middleware
│       │   ├── errorHandler.ts # Global error handler + AppError class
│       │   ├── rateLimiter.ts  # Global + strict rate limiters
│       │   └── upload.ts       # Multer config for image uploads
│       └── utils/
│           └── asyncHandler.ts # Wraps async route handlers
├── seed/
│   └── seed.ts                 # Sample users, posts, comments, reactions
├── drizzle.config.ts           # Drizzle Kit configuration
└── .env.example                # Environment variable template
```

---

## API Overview

All endpoints are prefixed with `/api`. Protected routes require a `Bearer` token in the `Authorization` header.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | No | Register a new user |
| POST | `/login` | No | Login and receive a JWT |
| GET | `/me` | Yes | Get the authenticated user's profile |

### Posts — `/api/posts`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | Paginated feed (cursor-based, newest first) |
| POST | `/` | Yes | Create a post (text + optional image upload) |
| GET | `/:postId/comments` | Yes | Top-level comments for a post |
| POST | `/:postId/comments` | Yes | Add a comment or reply to a post |
| GET | `/comments/:commentId/replies` | Yes | Direct replies for a comment |

### Likes — `/api/likes`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/toggle` | Yes | Toggle or change a reaction on any post or comment |
| GET | `/:entityType/:entityId/users` | Yes | List users who reacted to a post or comment |

### Other

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server health check |
| GET | `/api-docs` | Swagger UI — interactive API documentation |
| GET | `/uploads/:filename` | Serve uploaded images |

---

## API Request / Response Format

**Request body** (JSON):

```json
{ "email": "user@example.com", "password": "secret123" }
```

**Success response envelope:**

```json
{
  "success": true,
  "data": { ... },
  "meta": { "hasNextPage": false, "nextCursor": null }
}
```

**Error response envelope:**

```json
{
  "success": false,
  "message": "Invalid email or password.",
  "statusCode": 401
}
```

---

## Authentication

After a successful login or registration, the API returns a JWT token:

```json
{ "success": true, "user": { ... }, "token": "eyJ..." }
```

Include this token in all subsequent protected requests:

```
Authorization: Bearer eyJ...
```

---

## Image Uploads

Post images are uploaded via `multipart/form-data` with the field name `image`. Uploaded files are stored in `uploads/` and served at `/uploads/:filename`. The API returns the relative path (e.g. `/uploads/1234-photo.jpg`) in the `imageUrl` field.

---

## Running Tests

```bash
pnpm test
```

Tests use Jest + Supertest against a real test database. Set `DATABASE_URL` to a separate test database before running to avoid affecting development data.
