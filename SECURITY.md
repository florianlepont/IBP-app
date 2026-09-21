# Security policy

## Reporting a vulnerability

Please report security issues **privately**, not through a public issue.

Use GitHub's private reporting: go to the
[Security tab](https://github.com/florianlepont/cortege/security/advisories/new)
and open a draft advisory. It is visible only to the maintainer, and it lets us
discuss and fix the issue before anything becomes public.

Expect a first reply within a week. This is a small volunteer project, so
please be patient and, if the issue is being actively exploited, say so
explicitly in the report.

## What is in scope

- The API (`api/`) and the production instance it serves
- The mobile application (`mobile/`)
- The deployment configuration under `infra/`

Out of scope: the third-party services this project depends on. Report those to
their own maintainers — Auth0, the IGN cadastral APIs, GitHub, and the upstream
npm packages.

## What we consider a vulnerability

Anything that lets someone read, modify or destroy data they should not reach:
another observer's surveys, another user's account or personal data, the
contents of object storage. Also: authentication or authorisation bypasses,
injection, and remote code execution.

Denial of service through sheer volume is not treated as a vulnerability — the
API is rate limited and runs on modest hardware, and we know it.

## Handling of survey data

Surveys carry the geographic coordinates of parcels and the name of the person
who recorded them. Treat any accidental disclosure of that data as a
vulnerability, even if the mechanism looks minor.

## No bounty

There is no bug bounty. Credit is given in the advisory unless you prefer to
stay anonymous.
