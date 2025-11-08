## Alfatonics Client Delivery Portal

Next.js App Router project that powers the Alfatonics delivery dashboard for admins, staff, and clients. The app uses Prisma with a Neon Postgres database, NextAuth credential authentication, and Cloudflare R2 for file storage.

---

## 1. Requirements

- Node.js 20.x (or the current Vercel default)
- npm (ships with Node)
- Access credentials for:
  - Neon Postgres
  - Cloudflare R2 bucket (S3-compatible)
- Optional: `psql` or Prisma CLI for DB migrations

---

## 2. Environment Variables

Copy `env.local.example` to `.env.local` for local development and fill in the values:

```
cp env.local.example .env.local
```

| Variable                                    | Description                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | Postgres connection string, include `sslmode=require` for Neon                            |
| `NEXTAUTH_URL`                              | Base URL for NextAuth (e.g. `http://localhost:3000` locally, production domain on Vercel) |
| `NEXTAUTH_SECRET`                           | Random 32+ character string (generate via `openssl rand -base64 32`)                      |
| `R2_ACCOUNT_ID`                             | Cloudflare account ID                                                                     |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API keys with S3 permissions                                                           |
| `R2_BUCKET`                                 | Bucket name                                                                               |
| `R2_PUBLIC_BASE_URL`                        | Public CDN URL if applicable                                                              |

> ⚠️ `.env`, `.env.local`, and other secrets are gitignored. Never commit secrets to GitHub.

For production on Vercel, add the same keys in the Vercel dashboard under **Project → Settings → Environment Variables**. Configure separate values for Production and Preview as needed. Vercel sets `NEXTAUTH_URL` automatically for each environment if you leave it blank, but you may override if you use a custom domain.

---

## 3. Local Development

Install dependencies:

```
npm install
```

Run database migrations against your local/Neon database:

```
npx prisma migrate deploy    # Production-style migration
# or
npx prisma migrate dev       # Dev with history tracking
```

Start the dev server:

```
npm run dev
```

Visit `http://localhost:3000` and sign in with the seeded admin credentials (`admin@alfatonics.com / Admin123!`) or create your own via Prisma/seed scripts.

---

## 4. Prisma & Database

- Schema lives in `prisma/schema.prisma`.
- Migration history is under `prisma/migrations`.
- To inspect the DB: `npx prisma studio`.
- Seed script: `npm run prisma:seed` (requires a clean DB state that matches the schema).

Neon uses connection pooling. When deploying to Vercel, ensure that:

- `DATABASE_URL` points to the Neon pooled connection string.
- Neon project allows connections from Vercel (usually handled automatically).

---

## 5. Production Build Check

```
npm run build
```

If the build fails due to fonts fetching (`next/font` attempts to download Geist), ensure your network allows outbound HTTPS during the build step. Vercel’s build environment has access by default.

---

## 6. Prepare GitHub Repository

1. Initialize git (skip if already done):
   ```
   git init
   ```
2. Verify `.gitignore` excludes `.env*` and generated Prisma client (already configured).
3. Commit the current code:
   ```
   git add .
   git commit -m "chore: bootstrap client delivery portal"
   ```
4. Create a new GitHub repository (via GitHub UI).
5. Add the remote and push:
   ```
   git branch -M main
   git remote add origin git@github.com:<your-org>/<repo>.git
   git push -u origin main
   ```

---

## 7. Deploy to Vercel

1. Go to [https://vercel.com/new](https://vercel.com/new) and import the GitHub repository.
2. In **Project Settings → Environment Variables**, add:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (optional if you use custom domain)
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET`
   - `R2_PUBLIC_BASE_URL`
3. Trigger the first deploy (Vercel installs dependencies, runs `next build`, and outputs static/serverless artifacts).
4. After deployment, run database migrations against production:
   ```
   npx prisma migrate deploy
   ```
   Execute this locally with the production `DATABASE_URL` or via a CI step. Neon also supports branching for safety.
5. (Optional) Run `npm run prisma:seed` against production if you need initial data (use caution—seeding may not be idempotent).

---

## 8. Operations & Maintenance

- **Auth secrets**: rotate `NEXTAUTH_SECRET` periodically and update Vercel env.
- **Prisma migrations**: keep migrations in version control; use `prisma migrate dev` during development and `prisma migrate deploy` in production.
- **R2 credentials**: store them securely (Vercel, 1Password, etc.).
- **Monitoring**: Vercel Analytics or external tools can be connected for production insight.

---

## 9. Useful Scripts

| Script          | Command                   | Purpose                                                                 |
| --------------- | ------------------------- | ----------------------------------------------------------------------- |
| Dev server      | `npm run dev`             | Run Next.js in development mode                                         |
| Build           | `npm run build`           | Production build                                                        |
| Start           | `npm run start`           | Run compiled app locally                                                |
| Lint            | `npm run lint`            | ESLint                                                                  |
| Prisma generate | `npm run prisma:generate` | Regenerate Prisma client                                                |
| Prisma migrate  | `npm run prisma:migrate`  | Apply migrations in dev                                                 |
| Prisma deploy   | `npm run prisma:deploy`   | Apply migrations in prod                                                |
| Seed            | `npm run prisma:seed`     | Populate sample data                                                    |
| Verify env      | `npm run verify:env`      | Validates required environment variables and Cloudflare R2 connectivity |

---

## 10. Troubleshooting

- **`prisma.user.findUnique` connection errors**: confirm `DATABASE_URL` is set and reachable; check Neon status.
- **`next/font` download timeouts**: ensure build environment has outbound internet or switch to self-hosted fonts.
- **R2 timeouts**: run `npm run verify:env` to test connectivity and check firewall rules.

For additional guidance, review the Next.js and Prisma docs linked above.
