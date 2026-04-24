# Contributing to Gumroad Mobile

## Overall

Use native-sounding English in all communication with no excessive capitalization (e.g HOW IS THIS GOING), multiple question marks (how's this going???), grammatical errors (how's dis going), or typos (thnx fr update).

- ❌ Before: "is this still open ?? I am happy to work on it ??"
- ✅ After: "Is this actively being worked on? I've started work on it here…"

Explain the reasoning behind your changes, not just the change itself. Describe the architectural decision or the specific problem being solved. For bug fixes, identify the root cause. Don't apply a fix without explaining how the invalid state occurred.

## Pull requests

- Include an AI disclosure
- Self-review (comment) on your code
- Break up big 1k+ line PRs into smaller PRs (100 loc)
- **Must**: Include a video for every PR. For user-facing changes, show before/after with light/dark mode and iOS/Android. For non-user-facing changes, record a short walkthrough of the relevant existing functionality to demonstrate understanding and confirm nothing broke.
- Include updates to any tests, especially end-to-end tests!
- After reviews begin, avoid force-pushing to your branch. Force-pushing rewrites history and makes review threads hard to follow. Don't worry about messy commits, we squash everything when merging to main.

### PR description structure

Non-trivial PRs should follow this structure:

- **What** — What this PR does. Concrete changes, not a list of files.
- **Why** — Why this change exists and why this approach was chosen over alternatives.
- **Before/After** — Video is required for all PRs. For user-facing changes, show before/after with iOS and Android, light and dark mode. For non-user-facing changes, include a short video walking through the relevant existing functionality.
- **Test Results** — Screenshot of tests passing locally.

End with an AI disclosure after a `---` separator. Name the specific model (e.g., "Claude Opus 4.6") and list the prompts given to the agent.

## AI models

Use the latest and greatest state-of-the-art models from American AI companies like [Anthropic](https://www.anthropic.com/) and [OpenAI](https://openai.com/). As of this writing, that means Claude Opus 4.6 and GPT-5.4, but always check for the newest releases. Don't settle for last-gen models when better ones are available.

## Development guidelines

### Before pushing

Always run the relevant tests locally and confirm they pass before pushing:

```bash
# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

Do not push code with failing tests. CI is not a substitute for local verification. Fix any issues before committing.

### Testing guidelines

- Don't use "should" in test descriptions
- Write descriptive test names that explain the behavior being tested
- Group related tests together
- Keep tests independent and isolated
- Tests must fail when the fix is reverted. If the test passes without the application code change, it is invalid.
- Use `@example.com` for emails in tests
- Use `example.com`, `example.org`, and `example.net` as custom domains or request hosts in tests.

### Code standards

- Always use the latest version of TypeScript and React Native
- Sentence case headers and buttons and stuff, not title case
- Always write the code
- Don't leave comments in the code
- No explanatory comments please
- Don't apologize for errors, fix them
- Assign raw numbers to named constants (e.g., `MAX_CHARACTER_LIMIT` instead of `500`) to clarify their purpose.
- Avoid abstracting code into shared components if the duplication is coincidental. If two interfaces look similar but serve different purposes, keep them separate to allow independent evolution.

### Code patterns

- Do not use dynamic string interpolation for Tailwind class names (e.g., `` `text-${color}` ``). Tailwind scanners cannot detect these during build. Use full class names or a lookup map.
- Use `buyer` and `seller` when naming variables instead of `customer` and `creator`
- Use `product` instead of `link` in new code (in variable names, comments, etc.)

## Writing issues

Issues for enhancements, features, or refactors use this structure:

### What

What needs to change. Be concrete:

- Describe the current behavior and the desired behavior
- Who is affected (buyers, sellers, internal team)
- Quantify impact with data when possible (error rates, support tickets, revenue)
- Use a checkbox task list for multiple deliverables

### Why

Why this change matters:

- What user or business problem does this solve?
- Link to related issues, support tickets, or prior discussions for context

Keep it short. The title should carry most of the weight, the body adds context the title can't.

## Writing bug reports

A great bug report includes:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Help

- Check existing discussions/issues/PRs before creating new ones
- Any issue with label `help wanted` is open for contributions - [view open issues](https://github.com/antiwork/gumroad-mobile/issues?q=state%3Aopen%20label%3A%22help%20wanted%22)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE.md).
