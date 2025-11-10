# GitPulse

> **GitHub Activity Analytics with RAG** - AI-powered insights from your team's GitHub activity

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Convex](https://img.shields.io/badge/Convex-1.28-orange)](https://www.convex.dev/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Transform raw GitHub events into cited, trustworthy insights. Ask "What did the React team ship last quarter?" and get factual summaries with GitHub URL citations for every claim.

## ✨ Features

- **📊 Repository Analytics** - Track PRs, commits, and reviews with interactive charts
- **🤖 AI-Powered Reports** - Generate activity summaries with Gemini 2.5 Flash
- **🔍 Semantic Search** - Vector similarity search with Convex's native vector index
- **📎 Citation-Backed** - Every claim links to GitHub events (PRs, commits, reviews)
- **⚡ Real-time Updates** - Reactive queries with Convex keep data fresh
- **🔐 Secure Auth** - Clerk authentication with GitHub OAuth integration

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 22.15.0 ([Download](https://nodejs.org/))
- **pnpm** >= 9.0.0 (`npm install -g pnpm`)

### Installation

```bash
# Clone repository
git clone https://github.com/misty-step/gitpulse.git
cd gitpulse

# Install dependencies
pnpm install

# Start development server (runs Next.js + Convex concurrently)
pnpm dev
```

Visit **http://localhost:3000** and sign up with Clerk to get started!

## 📋 Usage

### 1. Add a Repository

Navigate to **Repositories** → Click **"Add Repository"**

- **Single repo**: Enter `facebook/react`, select start date
- **Batch mode**: Enter GitHub username or org to add all their repos

### 2. Watch Ingestion Progress

Real-time progress banner shows:
- Current progress percentage
- Events ingested count
- Estimated time remaining

### 3. View Analytics

Click **"View Details"** on any repo to see:
- Activity charts (PRs, commits, reviews over time)
- KPI cards (total counts, trends)
- Event breakdown table

### 4. Generate AI Reports

Navigate to **Reports** → **"Generate Report"**

1. Enter GitHub usernames (comma-separated)
2. Select date range
3. Optional: Add semantic search query
4. Wait 30-60 seconds for AI generation

Reports include:
- Activity summary with key highlights
- Citation-backed analysis
- GitHub URL references for every claim
- Download as markdown

### 🧪 Regenerate Reports During Development

Need to inspect new prompt changes or re-run a noisy report window? Use the Convex action wrapper:

```bash
# Daily report ending "now" for a GitHub login
pnpm reports:generate -- --ghLogin=octocat --kind=daily

# Weekly retro for a specific range (timestamps are epoch ms)
pnpm reports:generate -- \
  --clerkId=user_123 \
  --kind=weekly \
  --endDate=$(node -e "console.log(Date.parse('2025-11-10T00:00:00Z'))") \
  --startDate=$(node -e "console.log(Date.parse('2025-11-03T00:00:00Z'))")
```

Arguments:
- `--ghLogin` or `--clerkId` (required – pick one)
- `--kind` (`daily` | `weekly`)
- `--endDate` (optional, defaults to now)
- `--startDate` (optional; defaults to 24h or 7d before `endDate`)

The command calls `actions/reports/regenerate` under the hood, persists the new report, and prints the Convex document ID so you can open it immediately in the app UI.

## 🏗️ Architecture

### Tech Stack

**Frontend**:
- Next.js 16 with App Router + React 19
- TypeScript 5.7
- Tailwind CSS 4
- Sonner for toast notifications

**Backend**:
- Convex (serverless functions + database + vector search)
- Clerk (authentication + session management)

**AI/ML**:
- Voyage AI (1024-dim embeddings, $0.10/1M tokens)
- Gemini 2.5 Flash (report generation, $0.15-0.60/1M tokens)
- OpenAI GPT-5 Mini (fallback)

### Directory Structure

```
gitpulse/
├── app/                    # Next.js App Router
│   ├── dashboard/          # Protected dashboard routes
│   ├── sign-in/            # Clerk auth pages
│   └── sign-up/
├── components/             # React components
│   └── ui/                 # ShadCN components
├── convex/                 # Convex backend
│   ├── schema.ts           # Database schema
│   ├── queries/            # Read operations
│   ├── mutations/          # Write operations
│   ├── actions/            # External API calls
│   └── lib/                # Shared utilities
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities
└── public/                 # Static assets
```

## 🔧 Configuration

### Environment Variables

#### Next.js (`.env.local`)

```bash
# Convex (auto-configured by `convex dev`)
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

#### Convex Environment (set via `convex env set`)

```bash
# GitHub API
GITHUB_TOKEN=ghp_...

# AI Providers
GOOGLE_API_KEY=AIza...              # Primary (Gemini)
OPENAI_API_KEY=sk-...               # Fallback (GPT-5)
VOYAGE_API_KEY=pa-...               # Embeddings (recommended)

# Clerk (for JWT validation)
CLERK_JWT_ISSUER_DOMAIN=your-clerk-domain.clerk.accounts.dev
```

### Setting Up Services

#### 1. Convex

```bash
npx convex dev      # Creates deployment, pushes schema
```

#### 2. Clerk

1. Create app at https://clerk.com
2. Enable GitHub OAuth provider
3. Copy keys to `.env.local`
4. Set `CLERK_JWT_ISSUER_DOMAIN` in Convex env

#### 3. API Keys

Get API keys from:
- **Voyage AI**: https://www.voyageai.com/
- **Google AI Studio**: https://ai.google.dev/
- **GitHub**: https://github.com/settings/tokens (needs `repo` scope)

## 🧪 Development

### Run Development Server

```bash
pnpm dev
```

This starts:
- Next.js dev server (http://localhost:3000)
- Convex dev watcher (syncs functions on file changes)

### Type Checking

```bash
pnpm typecheck
```

### Build for Production

```bash
pnpm build
```

### Convex Dashboard

View data, run functions, check logs:

```bash
npx convex dashboard
```

Or visit: https://dashboard.convex.dev/

## 📊 Database Schema

### Tables

- **users** - GitHub user profiles (synced from Clerk)
- **repos** - Repository metadata
- **events** - GitHub activity (PRs, commits, reviews)
- **embeddings** - Vector embeddings (1024-dim, Voyage)
- **reports** - Generated AI reports
- **ingestionJobs** - Background job tracking

### Indexes

- `by_clerkId`, `by_tokenIdentifier` on users
- `by_fullName`, `by_owner` on repos
- `by_type`, `by_actor`, `by_repo`, `by_timestamp` on events
- Native vector index on embeddings (cosine similarity)

See `convex/schema.ts` for full schema.

## 🚀 Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project on [Vercel](https://vercel.com/new)
3. Set environment variables:
   - `CONVEX_DEPLOYMENT`
   - `NEXT_PUBLIC_CONVEX_URL`
   - Clerk keys
4. Deploy

### Deploy Convex

```bash
npx convex deploy
```

This creates a production Convex deployment. Update Vercel env vars with production URLs.

## 🐛 Troubleshooting

### Database Issues

Check Convex dashboard for errors:

```bash
npx convex dashboard
# Navigate to Logs tab
```

### API Rate Limits

GitHub enforces 5000 requests/hour. GitPulse handles this with:
- Exponential backoff (1s → 2s → 4s → 8s)
- Automatic retry on 403/429 errors
- Rate limit header parsing

### Report Generation Fails

1. Verify API keys in Convex dashboard (Settings → Environment Variables)
2. Check Convex logs for LLM errors
3. Ensure you have ingested data for the users/date range

### Build Errors

```bash
# Clear caches
rm -rf .next node_modules
pnpm install
pnpm build
```

## 🤝 Contributing

Contributions welcome! See [TODO.md](TODO.md) for current tasks.

### Development Workflow

1. Fork the repository
2. Create feature branch: `git checkout -b feat/my-feature`
3. Make changes
4. Run checks: `pnpm typecheck && pnpm lint`
5. Commit: `git commit -m "feat: add my feature"`
6. Push and create PR

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation
- `refactor:` code refactoring
- `test:` test changes
- `chore:` maintenance

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) - React framework
- [Convex](https://www.convex.dev/) - Backend platform
- [Clerk](https://clerk.com/) - Authentication
- [Voyage AI](https://www.voyageai.com/) - Embeddings
- [Google Gemini](https://ai.google.dev/) - LLM
- [Tailwind CSS](https://tailwindcss.com/) - Styling

Inspired by John Ousterhout's *A Philosophy of Software Design* - fighting complexity through deep modules and information hiding.

---

**Questions?** Open an issue or discussion on GitHub.

**Status**: Active development - SaaS MVP functional, automated features in progress.
