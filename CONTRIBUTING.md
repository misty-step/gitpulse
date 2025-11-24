# Contributing to GitPulse

## Development Workflow

### Making Changes

1. **Create a feature branch:**
   ```bash
   git checkout -b feat/your-feature
   ```

2. **Make your changes** and commit using conventional commit format:
   ```bash
   git commit -m "feat: add dark mode toggle"
   git commit -m "fix: resolve authentication timeout"
   git commit -m "docs: update setup instructions"
   ```

3. **Run quality checks:**
   ```bash
   pnpm typecheck  # TypeScript type checking
   pnpm lint       # ESLint
   pnpm test       # Jest test suite
   ```

### Changesets: Versioning & Changelog

GitPulse uses [Changesets](https://github.com/changesets/changesets) for automated versioning and changelog generation.

#### Creating a Changeset

**Every PR that affects users should include a changeset.** This documents what changed and determines version bumps.

```bash
# Create a changeset interactively
pnpm changeset
```

You'll be prompted:
1. **Type of change:**
   - **patch** (0.1.0 → 0.1.1): Bug fixes, minor improvements
   - **minor** (0.1.0 → 0.2.0): New features, backward-compatible changes
   - **major** (0.1.0 → 1.0.0): Breaking changes

2. **Summary:** Describe the change in user-facing language

Example changeset file (`.changeset/random-name.md`):
```markdown
---
"gitpulse": minor
---

Added copy-to-clipboard interaction for support email in footer
```

**Commit the changeset file** with your code changes:
```bash
git add .changeset/*.md
git commit -m "feat: add footer improvements"
git push origin feat/your-feature
```

#### What Changes Need a Changeset?

**Needs changeset:**
- ✅ New features
- ✅ Bug fixes
- ✅ UI changes
- ✅ API changes
- ✅ Breaking changes

**Doesn't need changeset:**
- ❌ Documentation updates
- ❌ Code refactoring (no user-facing changes)
- ❌ Test additions
- ❌ CI/CD configuration
- ❌ Development tooling

#### Release Process

Releases are **fully automated** via GitHub Actions:

1. **Developer creates PR** with changeset file
2. **PR is reviewed and merged** to master
3. **GitHub Action runs** and creates a "Version Packages" PR
4. **Maintainer reviews** the Version Packages PR:
   - Checks version bump (patch/minor/major)
   - Reviews generated CHANGELOG.md entries
5. **Merge Version Packages PR** → version is released

The automation:
- Bumps `package.json` version
- Updates `CHANGELOG.md`
- Creates git tag
- Commits changes back to master

#### Manual Changeset Commands

```bash
# Create a changeset (interactive)
pnpm changeset

# Update version based on changesets (run by GitHub Action)
pnpm changeset:version

# View pending changesets
cat .changeset/*.md
```

### Conventional Commits

GitPulse follows [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, semicolons)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks
- `ci`: CI/CD configuration

**Examples:**
```bash
feat(footer): add copy-to-clipboard for support email
fix(auth): resolve JWT validation timeout
docs(contributing): add changeset workflow guide
refactor(reports): extract coverage calculation
test(api): add health endpoint integration tests
```

### Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test convex/lib/contentHash.test.ts

# Run with coverage
pnpm test:coverage
```

### Code Quality

Before submitting a PR:

1. ✅ TypeScript types pass: `pnpm typecheck`
2. ✅ Linting passes: `pnpm lint`
3. ✅ Tests pass: `pnpm test`
4. ✅ Code is formatted: `pnpm format`
5. ✅ Changeset created (if applicable): `pnpm changeset`

### Questions?

- **Technical questions:** Open an issue on GitHub
- **General support:** Email hello@mistystep.io
- **Design decisions:** Review `CLAUDE.md` and `DESIGN.md`

---

**Philosophy:** Automation over manual process. Changesets ensure every change is documented and versioned correctly, without manual overhead.
