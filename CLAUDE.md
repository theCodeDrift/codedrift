# Agent instructions

## Working in git worktrees

1. Worktrees go under `worktrees/` in the main checkout, never inside other worktrees. Git ignores that directory (`git check-ignore -q worktrees/` succeeds from the main checkout).
2. A new worktree starts from the latest `main`, unless the work was asked to start from a particular branch or commit: fetch, then rebase onto whichever of local `main` and `origin/main` is ahead.
3. Run `pnpm install` in the worktree before running any of its scripts. Package managers hoist dependencies inconsistently, so what is installed in the main checkout may not resolve from a worktree.
4. Copy `.dev.vars` from the main checkout into the worktree before running `pnpm dev`. It is gitignored, so a new worktree doesn't have it, and the app needs it to reach Sanity.
5. Do all the work in the worktree, never in the main checkout.
