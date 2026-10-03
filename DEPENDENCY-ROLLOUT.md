# Dependency and Infrastructure Policy Rollout

This GDQ-only pilot uses Renovate for dependency updates. Successful `build`,
`prepare-postgres`, `infrastructure-terraform-plan`, and
`service-terraform-plan` jobs remain required on the current PR revision.
`Infrastructure review` is green when trusted validation succeeds, even when
either plan contains changes, so a human can merge after all required checks pass.
There is no digest approval, plan comment, or PR-review authorization gate.

Any non-empty infrastructure or service plan disables automerge, including
creates, updates, replacements, deletes, and output-only changes. Only eligible
same-repository Renovate PRs labelled `automerge` with both plans unchanged can
be merged automatically by the policy tools.

## Publication Order

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
5. Run the GDQ Renovate dry run and inspect its logs. Confirm the shared preset,
   `app/package.json`, lockfile, Docker images, Actions, and provider updates are
   discovered and Terraform is available to permitted post-upgrade commands in
   the runner container. Disable dry run only after this unresolved check passes.
6. Once Renovate replacement updates cover the existing security fixes, remove
   `.github/dependabot.yml` and `.github/workflows/autoupdate.yml`, and disable
   Dependabot security-update PRs in repository settings. Keep vulnerability
   alerts enabled. This migration remains unresolved; close old PRs only after
   linking replacements or recording uncovered fixes.
7. Re-enable the central workflow after validating the pilot:

   ```sh
   gh workflow enable renovate.yml --repo mahn-ke/.github
   gh workflow run renovate.yml --repo mahn-ke/.github \
     -f repositories=mahn-ke/gdqreminder-by-vincent -f dry_run=true
   ```

The central scheduled workflow still discovers `mahn-ke/*`. Re-enabling it is
an organization-wide dependency-runner restoration, not an organization-wide
merge-policy rollout. Monitor its last successful run externally; an inactive
workflow cannot monitor or reactivate itself.

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

Existing Dependabot PRs fail because their PostgreSQL secrets are empty. Do not
copy production credentials into Dependabot secrets or execute PR code using
`pull_request_target`. The Renovate migration avoids Dependabot's restricted
secret context; provider/backend credentials remain an Actions-level requirement.
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