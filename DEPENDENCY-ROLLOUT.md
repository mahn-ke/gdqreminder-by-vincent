# Dependency and Infrastructure Policy Rollout

This GDQ-only pilot uses Renovate for dependency updates. Successful `build`,
`prepare-postgres`, `infrastructure-terraform-plan`, and
`service-terraform-plan` jobs remain required on the current PR revision.
`Infrastructure review` is green when trusted validation succeeds, even when
either plan contains changes, so a human can merge after all required checks pass.
There is no digest approval, plan comment, or PR-review authorization gate.

Any non-empty infrastructure or service plan disables automerge, including
creates, updates, replacements, deletes, and output-only changes. Only eligible
same-repository Renovate PRs authored by the `RENOVATE_TOKEN` account (`ViMaSter`),
labelled `automerge`, with both plans unchanged can be merged automatically by
the policy tools. The generic automerge workflow remains excluded for GDQ so it
cannot bypass the Terraform-plan policy.

## Dependabot Snapshot (2026-10-03)

Captured before disabling Dependabot. All eight PRs were open and reported
`CLEAN` after rebasing onto current `main`.

| PR | Dependency update | Branch | Status |
| --- | --- | --- | --- |
| [#367](https://github.com/mahn-ke/gdqreminder-by-vincent/pull/367) | `@fastify/busboy` 3.0.0 to 3.2.2 | `dependabot/npm_and_yarn/app/fastify/busboy-3.2.2` | CLEAN |
| [#366](https://github.com/mahn-ke/gdqreminder-by-vincent/pull/366) | `@grpc/grpc-js` 1.14.4 to 1.14.5 | `dependabot/npm_and_yarn/app/grpc/grpc-js-1.14.5` | CLEAN |
| [#365](https://github.com/mahn-ke/gdqreminder-by-vincent/pull/365) | `brace-expansion` update | `dependabot/npm_and_yarn/app/multi-05c505ab13` | CLEAN |
| [#364](https://github.com/mahn-ke/gdqreminder-by-vincent/pull/364) | `moment` 2.30.1 to 2.31.0 | `dependabot/npm_and_yarn/app/moment-2.31.0` | CLEAN |
| [#363](https://github.com/mahn-ke/gdqreminder-by-vincent/pull/363) | `js-yaml` 3.14.2 to 3.15.2 | `dependabot/npm_and_yarn/app/js-yaml-3.15.2` | CLEAN |
| [#362](https://github.com/mahn-ke/gdqreminder-by-vincent/pull/362) | `got` 15.1.0 to 16.0.0 | `dependabot/npm_and_yarn/got-16.0.0` | CLEAN |
| [#361](https://github.com/mahn-ke/gdqreminder-by-vincent/pull/361) | `qs` 6.15.2 to 6.16.0 | `dependabot/npm_and_yarn/app/qs-6.16.0` | CLEAN |
| [#360](https://github.com/mahn-ke/gdqreminder-by-vincent/pull/360) | `browserslist` 4.25.0 to 4.28.8 | `dependabot/npm_and_yarn/app/browserslist-4.28.8` | CLEAN |

## Publication Order

Status for the dependency-bot handoff as of 2026-10-03: steps 5 and 6 are
complete. The central workflow is already active; GDQ was tested using an
explicit repository filter.

1. Publish the shared `.github` changes first: the repaired Renovate preset,
   deployment workflow, and policy/image helpers in `.github/tools`. Keep the
   Renovate schedule disabled until the GDQ policy is active. Manual Renovate
   dispatch defaults to a GDQ-only full dry run. The existing organization
   `RENOVATE_TOKEN` remains for the dependency bot only; plan reporting needs
   neither `PLAN_IMAGE_TOKEN` nor a user upload token.
2. Publish the owning generator in `repos/infrastructure/modules/general` and
   regenerate GDQ deployment and infrastructure-review wrappers with
   `repos/tools/render-gdq-workflows.mjs`. Reconcile the GDQ-only ruleset to
   require `Infrastructure review`, remove admin bypasses, and disable GitHub
   native auto-merge. Publish the policy workflow before requiring its check.
   Other repositories retain their current rules.
3. Configure the GDQ `production` environment with `ViMaSter` as a required
   reviewer. Both Terraform apply jobs use this environment, so approval gates
   apply on main. PR runs must never deploy or apply.
4. Run real GDQ validation against the current main branch and shared workflow.
   Confirm all four required jobs and the policy check succeed. Test both a
   no-change dependency PR and a changed plan: changes must allow human merge
   but never automerge. Inspect the sanitized PNG artifacts, then verify on a
   controlled main run that apply waits for `ViMaSter` approval. These live
   checks remain pending until the main agent executes and inspects them.
5. **Complete.** Shared PR #59 installed pinned Terraform `1.16.5` inside the
   Renovate container and restricted policy automerge to the verified
   `ViMaSter` author. Shared PR #60 runs Terraform post-upgrade tasks once per
   branch. Shared PR #61 adds `-lock-timeout=5m` to infrastructure and service
   plans. The scoped GDQ dry run and live run both succeeded; the latter created
   the replacement PRs below. Terraform state locking briefly failed when seven
   plans ran concurrently; isolated retries passed after the lock timeout was
   published.
6. **Complete.** PR #370 removed `.github/dependabot.yml` and the legacy
   `autoupdate` workflow after recording the eight-PR snapshot above. Dependabot
   automated security-fix PRs are disabled; GitHub vulnerability alerts remain
   enabled. All eight snapshot updates are now represented on `main`:

   | Dependabot PR | Replacement on `main` |
   | --- | --- |
   | #367 `@fastify/busboy` | 3.2.2 via lock-file maintenance |
   | #366 `@grpc/grpc-js` | 1.14.5 via lock-file maintenance |
   | #365 `brace-expansion` | 5.0.12 via lock-file maintenance |
   | #364 `moment` | 2.31.0 in the lockfile; the existing `^2.30.1` manifest range already admits it |
   | #363 `js-yaml` | 3.15.2 via lock-file maintenance |
   | #362 `got` | 16.0.0 in `package.json` and lockfile |
   | #361 `qs` | 6.16.0 via lock-file maintenance |
   | #360 `browserslist` | 4.29.3 via lock-file maintenance |

   The redundant Dependabot PRs were closed after the corresponding versions
   merged. Renovate also merged Firebase Admin 14.5.0, Jest 30.5.2, and Node
   22.23.3. A Node 24 major PR remains open for separate review because it
   conflicts with the selected Node 22 `.nvmrc` update.
7. **Central workflow active.** The entry point is `mahn-ke/.github`'s
   `Dependency updates` workflow; there is no `mahn-ke/renovate` repository.
   Manual validation was scoped to GDQ with:

   ```sh
   gh workflow run 'Dependency updates' --repo mahn-ke/.github --ref main \
     --field repositories=mahn-ke/gdqreminder-by-vincent --field dry_run=true
   ```

   Scheduled runs still autodiscover `mahn-ke/*`; the manual repository filter
   does not narrow the scheduled run. The Renovate token currently cannot read
   GitHub vulnerability alerts (Renovate logs `Cannot access vulnerability
   alerts`). GitHub alerts remain on, but grant the token Dependabot-alert read
   permission if Renovate should also create vulnerability-fix PRs.

## Merge and Apply Gates

Changed plans can be merged manually after successful PR validation; production
approval is separate from merge permission. On main, both apply jobs require the
`production` environment's `ViMaSter` approval. Existing architecture runs
infrastructure planning and any approved infrastructure apply before deployment;
service planning currently follows deployment on main, then service apply is
gated separately. Do not assume both plans complete before any main apply.

The privileged policy job checks out only the shared policy repository, never
PR code. It requires the generated deployment wrapper to match the base branch
and validation to use the current shared deployment workflow. Wrapper changes
must be published through the generator before this pilot can authorize them.

## Plan Images and Apply Artifacts

GDQ opts in through the shared workflow's `infrastructure_review` input. Each
plan job renders a sanitized Ponto PNG only for Terraform exit code `2`.
Images are Actions artifacts on both PR and main validation runs, never comments:

- `terraform-plan-image-infrastructure`: only `infrastructure.png`, retention 7 days.
- `terraform-plan-image-service`: only `service.png`, retention 7 days.

Exit code `0` produces no reporting artifact. No metadata JSON, raw plan JSON,
output values, or interactive HTML are uploaded as reporting artifacts. Only
value-free, allowlisted plan data reaches the renderer; string instance keys are
hashed. Resource and module names remain visible, as in the public Terraform code.

Ponto is built from the same pinned source commit
`f015f501ac23d91aa6c09b201bc294157eb9d6a4`; rendering has no network or provider
credentials. No native image attachment or user upload token is needed.

Separately, changed main plans still upload binary `tfplan-infrastructure` and
`tfplan-service` artifacts for the apply jobs. These are necessary apply inputs
and can contain secrets. The PNG-only reporting rule does not remove or sanitize
these binary artifacts; PR runs do not upload them.

## Diagnostics and Validation

Earlier Dependabot PR runs failed because their PostgreSQL secrets were empty.
Do not copy production credentials into Dependabot secrets or execute PR code
using `pull_request_target`. The Renovate migration avoids Dependabot's
restricted secret context; provider/backend credentials remain an Actions-level
requirement.
Local helper checks do not prove live CI behavior. Provider/backend access,
artifact contents, merge behavior, and environment approvals require the real
PR and main workflow smoke tests after publication.

From the workspace root:

```sh
npx --yes --package renovate renovate-config-validator \
  .github/renovate/default.json gdqreminder-by-vincent/renovate.json
node --test .github/tools/*.test.mjs
TEST_PONTO=true node --test .github/tools/render-plan.test.mjs
actionlint .github/.github/workflows/template-deploy.yml \
   repos/infrastructure/modules/general/src/.github/workflows/infrastructure-review.yml
node repos/tools/render-gdq-workflows.mjs --check
docker build --target test gdqreminder-by-vincent/app
docker build gdqreminder-by-vincent/app
gh run list --repo mahn-ke/gdqreminder-by-vincent \
   --workflow autogenerated-deploy.yml --event pull_request
gh run list --repo mahn-ke/gdqreminder-by-vincent \
   --workflow autogenerated-deploy.yml --event push --branch main
gh run view <run-id> --repo mahn-ke/gdqreminder-by-vincent --log
```

Use actual PR and main runs of `autogenerated-deploy.yml` for the smoke test,
inspect their artifacts and production approval state, and record the results
before declaring the rollout successful. Listing runs alone is not validation.