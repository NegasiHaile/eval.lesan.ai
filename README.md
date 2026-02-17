# 🧠 Machine Translation Systems Human Evaluation

Full-stack **Next.js** app for **human evaluation and leaderboard** of machine translation (MT) and automatic speech recognition (ASR) systems. Upload datasets, manage tasks, and rate/rank model outputs. Authentication is **Google Sign-In only** via [Better Auth](https://www.better-auth.com/).

---

## 🛠 Tech Stack

- **Next.js** (App Router), **TypeScript**, **Tailwind CSS**
- **MongoDB** — app data and Better Auth (users, sessions, accounts)
- **Better Auth** — Google OAuth only; no email/password
- **Vercel** — recommended for deployment

---

## 📦 Prerequisites

- **Node.js** v20+
- **MongoDB** (local or [Atlas](https://www.mongodb.com/cloud/atlas))
- **npm**

---

## 🚀 Quick Start (Development)

```bash
git clone https://github.com/lesanai/app-eval.git
cd horneval

npm install
cp .env.example .env.local
# Edit .env.local: MONGODB_URI, BETTER_AUTH_*, GOOGLE_*, etc.

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🔧 Environment Variables

Create `.env` or `.env.local` (see `.env.example`). Next.js loads both; `.env.local` overrides and is gitignored.

| Variable | Required | Description |
|----------|----------|-------------|
| `BETTER_AUTH_SECRET` | Yes | Secret for signing (min 32 chars). Use `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Yes | Full app URL with no trailing slash. Must match the URL in the browser so the session cookie works (e.g. `http://localhost:3000` in dev, `https://your-app.vercel.app` in prod). |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret. |
| `APP_NAME` | Yes | App name (server). |
| `NEXT_PUBLIC_APP_NAME` | Yes | App name (client). |
| `NEXT_PUBLIC_BASE_URL` | Yes | Same as `BETTER_AUTH_URL` in most cases (used by client). |
| `MONGODB_URI` | Yes | MongoDB connection string (e.g. Atlas `mongodb+srv://...` or local `mongodb://localhost:27017/`). |
| `LESAN_API_URL` | Yes | Lesan API base URL. |
| `LESAN_API_KEY` | Yes | Lesan API key. |
| `GEMINI_API_KEY` | Yes | Gemini API key (if used). |
| `APP_VERSION` | No | App version. |
| `APP_DESCRIPTION` | No | Short description. |

Better Auth uses the same MongoDB as the app. The DB name is `development` when `NODE_ENV=development` and `production` when `NODE_ENV=production`. It creates collections: `user`, `session`, `account`. No migrations needed.

---

### Production checklist

- [ ] `BETTER_AUTH_SECRET` set (32+ chars), never committed.
- [ ] `BETTER_AUTH_URL` and `NEXT_PUBLIC_BASE_URL` set to your production URL (https, no trailing slash).
- [ ] Google OAuth client has production origin and redirect URI `https://<your-domain>/api/auth/callback/google`.
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set in production.
- [ ] `MONGODB_URI` points to production MongoDB; app runs with `NODE_ENV=production` so the `production` DB is used.
- [ ] No `.env` / `.env.local` with secrets committed; use the host’s env UI for production.

### First admin user (optional)

Better Auth does not create a “root” or “admin” by default. To make a user an admin:

1. Sign in once with Google so a document is created in the `user` collection.
2. In MongoDB, set that user’s `role` to `"root"` (the app uses these for protected routes and the Users page).

---

## 🧱 Production Build and Deploy

### Build and run locally (production mode)

```bash
npm run build
npm start
```

Runs on port 3000 with `NODE_ENV=production`.

---

## 📁 Project Structure

```
src/
  app/                 # Next.js App Router
    api/               # API routes (auth, batches, user, etc.)
    page.tsx           # Home (MT)
    layout.tsx
    datasets/          # Datasets UI (MT/ASR)
    asr/               # ASR evaluation UI
    leaderboard/       # Leaderboard
    users/             # User management (admin)
    profile/           # User profile
    auth/              # Sign-in page
  components/          # UI (navbar, Signup, tables, etc.)
  context/             # UserContext, PreferencesContext
  helpers/             # Validation, leaderboard logic
  lib/                 # auth, auth-client, mongodb
  scripts/             # Data prep (Python, etc.)
public/                # Static assets
```

---

## 🎓 Learn More

- [Next.js Docs](https://nextjs.org/docs)
- [Better Auth](https://www.better-auth.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vercel Deployment](https://nextjs.org/docs/app/building-your-application/deploying)
