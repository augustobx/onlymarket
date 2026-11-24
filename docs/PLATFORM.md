# NanoLabs platform access

- Platform identities (`PlatformAdmin`) are strictly separate from commerce users (`User`). No impersonation, cross-tenant data browser, or public self-registration.
- Create the initial platform operator via `node scripts/bootstrap-platform.mjs` inside the app container using temporary environment variables `PLATFORM_BOOTSTRAP_EMAIL` and `PLATFORM_BOOTSTRAP_PASSWORD` (min 12 chars; use a long random password). Do not commit credentials or put them in shell history.
- Enable `PLATFORM_ADMIN_ENABLED=true` in the runtime env and recreate only the OnlyMarket app container. HTTPS required. Access `/superadmin/login`. Global and per-account login throttling (`LoginLimit`), 4-hour session, `SameSite=Strict` cookie scoped to `/superadmin`, and audit trail (`PlatformAudit`).
- Implemented capabilities: tenant creation, listing, counts, plan assignment (`PILOT`, `BASIC`, `PRO`, `ENTERPRISE`), inclusive Argentina expiration date (`licenseUntil`), and suspension (`suspended`, blocked while cash shifts are open).
- Not implemented in this release: tenant deletion, automatic subscription billing, module gating by plan, and email-based password reset.
- Hub `GET /api/integrations/nanolabs/tenants?offset=0` implements `nanolabs.saas.tenants.v1`, product `onlymarket`. Runtime `HUB_INTEGRATION_TOKEN` must be a unique random token of at least 32 bytes. Missing/invalid token returns `401`; only `GET` is allowed (`405` otherwise); no user emails or financial records are exposed.
