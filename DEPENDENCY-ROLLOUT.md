# Dependency and Infrastructure Policy Rollout

This pilot uses Renovate for GDQ dependency updates. Successful image builds,
database preparation, and both Terraform plans remain required. Any non-empty
infrastructure or service plan disables automatic merging, including creates,
updates, replacements, deletes, and output-only changes.

## Publication Order

1. Publish the shared `.github` changes first: the repaired Renovate preset,
   deployment workflow, and policy/reporting helpers. Keep the Renovate schedule
   disabled until the GDQ policy is active. Manual Renovate dispatch defaults to
   a GDQ-only full dry run.
2. Make the existing organization Actions secret `RENOVATE_TOKEN` available to
   GDQ. The publisher maps it to the internal `PLAN_IMAGE_TOKEN` environment
   variable; a separate secret is not required. Native GitHub image
   attachments require an OAuth token or PAT with repository write access;
   `GITHUB_TOKEN` and GitHub App installation tokens cannot upload attachments.
   The existing fine-grained user PAT has passed a native upload smoke test.
   Reusing it shares a credential with Renovate; keep its repository access and
   permissions as narrow as both workflows permit, and never commit its value.
3. Publish the GDQ generated deployment and policy wrappers, then reconcile the
   `repos` Terraform generator. Its GDQ-only ruleset adds `Infrastructure review`,
   removes admin bypasses, and disables GitHub native auto-merge. The policy
   workflow must exist before adding the new required check. Other repositories
   retain their current rules.
4. Rerun GDQ validation against the current default branch and shared workflow.
   Confirm all four existing checks and the new policy check are present. Test a
   no-change dependency PR and a deliberately changed Terraform plan. Verify the
   Ponto graph renders inline and no private values appear.
5. Run the GDQ Renovate dry run and review its logs. Confirm the shared preset,
   `app/package.json`, lockfile, Docker images, Actions, and provider updates are
   discovered. Confirm Terraform is available to the permitted post-upgrade
   commands in the Renovate container. Then run with dry run disabled.
6. Once Renovate replacement updates cover the existing security fixes, remove
   `.github/dependabot.yml` and `.github/workflows/autoupdate.yml`, and disable
   Dependabot security-update PRs in repository settings. Keep vulnerability
   alerts enabled. Close old PRs only after linking replacements or recording
   any uncovered security fixes.
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

## Reviewing Changes

The plan comment displays a digest covering both roots and the current head/base
revisions. Submit an **Approve** review on the current revision with this exact
line, substituting the displayed digest:

```text
Approve infrastructure plan <digest>
```

Only users with repository write, maintain, or admin permission can satisfy this
gate. Old revisions, changed plan contents, dismissed approvals, and
changes-requested reviews do not authorize merging. Changed plans must be merged
manually after every required check passes; approval never enables automerge.

Submitting, editing, or dismissing a review triggers reevaluation. A PR comment
or manual dispatch can also request a refresh, and a periodic refresh runs
every 15 minutes. Wait for the policy workflow after review changes; do not
merge using a result that predates a withdrawal. A new PR revision, validation
run, or default-branch update also triggers reevaluation. The reviewer must
see the current plan comment first.

The privileged policy job checks out only the shared policy repository, never
PR code. It requires the generated deployment wrapper to match the base branch
and validation to use the current shared deployment workflow. Wrapper changes
must be published through the generator before this pilot can authorize them.

## Diagnostics and Validation

Existing Dependabot PRs fail because their PostgreSQL secrets are empty. Do not
copy production credentials into Dependabot secrets or execute PR code using
`pull_request_target`. The Renovate migration avoids Dependabot's restricted
secret context; production credentials remain an Actions-level requirement.
Provider/backend access and actual GitHub upload permissions require a live CI
smoke test after publication.

From the workspace root:

```sh
npx --yes --package renovate renovate-config-validator \
  .github/renovate/default.json gdqreminder-by-vincent/renovate.json
node --test .github/tools/*.test.mjs
TEST_PONTO=true node --test .github/tools/render-plan.test.mjs
node repos/tools/render-gdq-workflows.mjs --check
docker build --target test gdqreminder-by-vincent/app
docker build gdqreminder-by-vincent/app
```

Ponto's published image failed the headless export smoke test. The renderer
therefore builds its standard target from pinned source commit
`f015f501ac23d91aa6c09b201bc294157eb9d6a4`. Only value-free, allowlisted plan data
is mounted; rendering has no network or provider credentials. Raw plan JSON,
binary plans, output values, and interactive HTML are never uploaded to PRs.
String instance keys are hashed before publication. Resource and module names
remain visible, as they already are in this public repository's Terraform code.

Native upload failures keep the review gate blocked. `secrets.RENOVATE_TOKEN`
is passed as `PLAN_IMAGE_TOKEN` and is used
only to upload PNGs through a temporary comment; the final marked comment,
required check, and eligible no-change merge use the non-bypass Actions token.