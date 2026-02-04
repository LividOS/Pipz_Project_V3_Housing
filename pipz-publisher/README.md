# Pipz Publisher

Local VS Code extension for Pipz_Project_V3 that publishes a deterministic “context bundle” to GitHub Releases and updates a Drive-synced pointer file.

## What it does

When triggered, it:

- Collects files from the workspace using an allowlist + exclude globs
- Generates:
  - `BUILD_ID.txt` (UTC timestamp)
  - `COMMIT_SHA.txt` (base commit)
  - `MANIFEST.json` (sha256 + size per file)
- Creates a zip bundle (Release Asset model)
- Uploads/replaces the bundle as a GitHub Release asset (tag: `context-latest`)
- Overwrites a local pointer file (Drive-synced) with:
  - `BUNDLE_URL`, `BUILD_ID`, `BASE_COMMIT_SHA`, `WORKTREE_STATE`, `WORKTREE_PATCH_SHA256`, `MANIFEST_SHA256`, counts/sizes
- Writes an audit record to `.ORCH_AUDITLOG/publish/`

## Usage

- Hotkey: **Ctrl + Alt + S**
- Command: `Pipz: Publish Context Bundle`

## Requirements

- Git installed and repository initialized
- GitHub CLI installed and authenticated:
  - `gh --version`
  - `gh auth status`

## Settings

- `pipz.publish.outputDir` (default: `.pipz_publish_out`)
- `pipz.publish.auditDir` (default: `.ORCH_AUDITLOG/publish`)
- `pipz.publish.pointerPath` (default: `Governance/PIPZ_POINTER.txt`)
- `pipz.publish.releaseTag` (default: `context-latest`)
- `pipz.publish.releaseAssetName` (default: `pipz-context-latest.zip`)
- `pipz.publish.allowlist` (glob list)
- `pipz.publish.exclude` (glob list)
- `pipz.publish.requireCleanGit` (default: `false`)

## Notes

This extension is intended for local/governed Pipz workflows. It is not designed as a general-purpose publisher.
