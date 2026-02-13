# Contributing to Gumroad

Please see the main [Antiwork Contributing Guidelines](https://github.com/antiwork/.github/blob/main/CONTRIBUTING.md) for development guidelines.

Generally: Include an AI disclosure, self-review (comment) on your code, break up big 1k+ line PRs into smaller PRs (100 loc), and include video of before/after with light/dark mode represented. And include e2e tests!

## Testing Guidelines

- Don't use "should" in test descriptions
- Write descriptive test names that explain the behavior being tested
- Group related tests together
- Keep tests independent and isolated
- Tests must fail when the fix is reverted. If the test passes without the application code change, it is invalid.

## Pull Request

1. Update documentation if you're changing behavior
2. Add or update tests for your changes
3. Provide before & after screenshots/videos for UI changes
4. Include screenshots of your test suite passing locally
5. Don't comment on the parent issue when opening a PR; instead, link to the issue in your PR description.
6. Use native-sounding English in all communication with no excessive capitalization (e.g HOW IS THIS GOING), multiple question marks (how's this going???), grammatical errors (how's dis going), or typos (thnx fr update).
   - ❌ Before: "is this still open ?? I am happy to work on it ??"
   - ✅ After: "Is this actively being worked on? I've started work on it here…"
7. Explain the reasoning behind your change, not just the change itself. Describe the architectural decision or the specific problem being solved.
8. For bug fixes, identify the root cause. Don't apply a fix without explaining how the invalid state occurred.
9. Make sure all tests pass
10. Request a review from maintainers
11. After reviews begin, avoid force-pushing to your branch
    - Force-pushing rewrites history and makes review threads hard to follow
    - Don't worry about messy commits - we squash everything when merging to main
12. The PR will be merged once you have the sign-off of at least one other developer

## Style Guide

- Follow the existing code patterns
- Use clear, descriptive variable names

## Development Guidelines

### Code Standards

- Sentence case headers and buttons and stuff, not title case
- Always write the code
- Don't leave comments in the code
- No explanatory comments please
- Don't apologize for errors, fix them
- Assign raw numbers to named constants (e.g., `MAX_CHARACTER_LIMIT` instead of `500`) to clarify their purpose.
- Avoid abstracting code into shared components if the duplication is coincidental. If two interfaces look similar but serve different purposes (e.g., Checkout vs. Settings), keep them separate to allow independent evolution.

### Code Patterns and Conventions

- Do not use dynamic string interpolation for Tailwind class names (e.g., `` `text-${color}` ``). Tailwind scanners cannot detect these during build. Use full class names or a lookup map.
- Use `buyer` and `seller` when naming variables instead of `customer` and `creator`

### Testing Standards

- Use `@example.com` for emails in tests
- Use `example.com`, `example.org`, and `example.net` as custom domains or request hosts in tests.

## Writing Bug Reports

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
- Start a discussion for questions or ideas
- Open an [issue](https://github.com/antiwork/gumroad-mobile/issues) for bugs or problems
- Any issue with label `help wanted` is open for contributions - [view open issues](https://github.com/antiwork/gumroad-mobile/issues?q=state%3Aopen%20label%3A%22help%20wanted%22)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE.md).
