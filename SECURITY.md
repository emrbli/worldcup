# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability, please report it **privately** — do not open a
public issue.

- Preferred: use GitHub's **private security advisory** feature
  ("Security" tab → "Report a vulnerability").
- Alternatively, contact the maintainer directly through the email listed on the
  repository owner's GitHub profile.

Please include a clear description, reproduction steps, and the potential impact. We aim
to acknowledge reports promptly and will keep you informed as we investigate.

## Secrets & tokens

**Never commit `.env` or any API tokens.**

- `.env` is gitignored — only `.env.example` (with placeholder values) is tracked.
- API tokens (e.g. `FOOTBALL_DATA_TOKEN`) must always remain placeholders in
  committed files (e.g. `your_token_here`).
- **If a token is ever leaked or accidentally committed, rotate/revoke it immediately
  at the provider**, then scrub it from history.

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| older   | :x:                |

Only the latest released version receives security updates.
