# E2E Cognito Audit - 2026-05-27

## Scope

Targeted end-to-end audit of the Yuzu Cognito path: public Cognito configuration, Hosted UI authorize/callback/logout flow, inline password flow, static export runtime coverage, API Gateway JWT authorizer, Lambda claim/RBAC handling, live AWS drift, and live unauthenticated/invalid-token probes.

## Summary

The core API authorization boundary is healthy: live API Gateway uses the expected Cognito JWT authorizer, protected routes reject missing or malformed tokens before Lambda, Lambda still performs defensive claim and group checks, and static callback/logout pages serve successfully.

One real end-to-end defect was found and has since been resolved: the frontend could generate Hosted UI authorize URLs with the `phone` OAuth scope, but the live Cognito app client allows only `email`, `openid`, and `profile`. Cognito rejected that Hosted UI request with `invalid_scope`, which broke explicit Hosted UI sign-in and challenge recovery paths.

## Resolved Finding: Hosted UI recovery could fail with invalid_scope

- Priority: P2
- Severity: medium functional launch defect, not a validated auth bypass
- Confidence: high
- Affected lines:
  - `src/lib/cognito-auth.ts:90`
  - `.env.example:16`
  - `infra/ycc-phase1-edge.yaml:190`

### Evidence

- Before the fix, the frontend default scopes were `openid`, `email`, `profile`, and `phone` in `src/lib/cognito-auth.ts`.
- Before the fix, `.env.example` also documented `NEXT_PUBLIC_COGNITO_SCOPES=openid email profile phone`.
- The live Cognito app client `2i2nvtt41l94n0mivc4tu4f9ms` currently allows only `email`, `openid`, and `profile`.
- A live public Hosted UI authorize request with `scope=openid email profile phone` returned a `302` to:
  - `https://www.yuzucigarclub.com/auth/callback?error_description=invalid_scope&state=audit-state&error=invalid_request`
- The same request without `phone` returned a normal `302` to the Cognito `/login` page.
- The pre-fix fresh `out/` static bundle contained the fallback scope array with `phone`.

### Impact

Inline `USER_PASSWORD_AUTH` sign-in can still work when Cognito returns a complete token set. The break affects the explicit Hosted UI path and the recovery path shown after challenge states such as SMS MFA or new-password flows. That makes MFA/challenge completion brittle for members, admins, and concierge operators even though the underlying JWT/API enforcement is sound.

### Resolution

Resolved on 2026-05-27 by choosing one consistent scope contract:

- Removed `phone` from `defaultScopes` in `src/lib/cognito-auth.ts`.
- Removed `phone` from `NEXT_PUBLIC_COGNITO_SCOPES` in `.env.example`.
- Added regressions in `tests/cognito-auth.test.ts` that compare the frontend default scopes and documented example scopes against the CloudFormation `AllowedOAuthScopes`.
- Verified a corrected live Hosted UI authorize request with `scope=openid email profile` redirects to the Cognito `/login` page instead of returning `invalid_scope`.

## Controls Verified

- Live AWS identity checked with profile `ycc-mcp`, account `374587466106`.
- Cognito user pool `YCCMembers`:
  - deletion protection active
  - email username and email auto-verification
  - 12-character mixed password policy
  - email verification required before email updates
  - SMS MFA configured, pool MFA mode optional
- Cognito app client:
  - no client secret
  - OAuth code flow enabled
  - token revocation enabled
  - `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_USER_SRP_AUTH`, and refresh-token auth enabled
  - callback/logout URLs limited to production, www, staging, and admin origins; no localhost URL observed live
- API Gateway:
  - JWT authorizer issuer: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_63U9PflAX`
  - audience: `2i2nvtt41l94n0mivc4tu4f9ms`
  - CORS allows only production, www, admin, and staging origins
  - unknown-origin preflight returned no `access-control-allow-origin`
  - protected routes use JWT auth; intended public routes remain unauthenticated
- Lambda/API:
  - missing JWT claims return the local defensive `401` path in tests
  - admin routes require `admin` or `concierge_operator` group in Lambda
  - support send, admin agents, news publishing, humidor live data, and customer portal paths are covered by focused tests
- Static runtime:
  - `/auth/callback/` and `/auth/logout/` returned HTTP `200` from production
  - `npm run e2e:runtime-audit` passed after a fresh static build

## Verification Run

- Pre-fix red regression: `node --import tsx --test tests\cognito-auth.test.ts` failed because default/documented scopes included extra `phone`.
- Focused post-fix regression: `node --import tsx --test tests\cognito-auth.test.ts` - 18 tests passed.
- Boundary subset: `node --import tsx --test tests\cognito-auth.test.ts tests\account-auth-boundary.test.ts tests\api-gateway-contract.test.ts tests\lambda-ycc-api.test.ts` - 124 tests passed.
- Static checks: `npx eslint src\lib\cognito-auth.ts tests\cognito-auth.test.ts` and `npx tsc --noEmit --pretty false` passed.
- Full test suite: `npm test` - 402 tests passed.
- `npm run e2e:runtime-audit` - build passed, 953 static pages generated, 49 routes checked, 23 internal links followed, 78 runtime assets checked, not-found probe returned 404, warnings 0.
- Live corrected Hosted UI authorize probe with `scope=openid email profile` returned HTTP `302` to the Cognito `/login` page, with no `invalid_scope` callback.
- Live `https://api.yuzucigarclub.com/health?deep=1` returned HTTP `200`, `status=ok`, `environment=prod`, `db.proxyReachable=true`, `bedrock=runtime_ready`, and `ses=pending_production_access`.
- Live `GET https://api.yuzucigarclub.com/account/me` without auth returned HTTP `401`.
- Live `GET https://api.yuzucigarclub.com/admin/members` with malformed Bearer token returned HTTP `401` with `invalid_token`.
- Production `/auth/callback/` and `/auth/logout/` returned HTTP `200`.

## Hardening Notes

- API Gateway route-level authorization scopes are not used; authorization is enforced by Lambda group checks. This is working as designed today, but route-level scopes could provide defense in depth later.
- Pool-level MFA is optional. For production admin and concierge operator accounts, consider enforcing MFA through user-pool policy, admin onboarding checks, or a separate high-assurance admin app client.
- Cognito tokens are stored in `localStorage`; this matches the current static app architecture, but the CSP still allows inline scripts. Avoid adding attacker-controlled HTML/script surfaces because XSS would expose bearer tokens.

## Worktree Note

This audit was documentation-only. During verification, a new untracked `.playwright-cli/` directory was observed and left untouched.
