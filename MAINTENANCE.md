# SAPA-RT Maintenance & Release Procedure

| Field | Value |
|---|---|
| Document | Maintenance and release runbook |
| Applies to | Every SAPA-RT deployment (RT017, RT018, and future RTs) |
| Related documents | `readme.md`, `panduan.md`, `agents.md`, `Apps Script/readme.md`, `BRD-RW06.md` |
| Owner | System owner together with each RT admin |
| Review cycle | Every quarter, or after a major incident |

This document describes how to operate, release, back up, and recover SAPA-RT deployments. It is written for the person who maintains the repository, Google Sheets, Apps Script, and Cloudflare projects.

---

## 1. Operating principles

1. The repository is the source of truth for application code.
2. Each RT spreadsheet is the source of truth for that RT's data.
3. Every RT keeps its own spreadsheet, Apps Script project, admin token, and Drive folder.
4. Generic code is developed on `main`, then merged into each RT branch.
5. An RT branch must never be merged back into `main`.
6. Back up before any schema change or bulk data operation.
7. Never rename or remove the helper `ID` column or rename sheet tabs.
8. Prefer archive and reversal over permanent deletion.
9. Do not store tokens, spreadsheet IDs, or user credentials in the repository.
10. A release is complete only after the live checks pass.

---

## 2. Branch and deployment model

| Deployment | Branch | Production domain | Notes |
|---|---|---|---|
| RT017 | `main` | `sapa-rt017.pages.dev` | Reference deployment |
| RT018 | `rt018` | `sapa-rt018.pages.dev` | First additional RT |
| Future RT | `rtNNN` | `sapa-rtNNN.pages.dev` | Same code, different configuration |

Rules:

- Develop and test generic features on `main`.
- Merge `main` into `rt018` (and other RT branches) for every release.
- Never resolve deployment-specific values by hand if the merge driver can preserve them.
- Keep one Cloudflare Pages project per RT, deployed from that RT's branch.
- Keep one Apps Script project per RT, bound to that RT's spreadsheet.
- Tag important releases, for example `rt018-2026-10-25`.

Recommended merge direction:

```text
main -> rt018 -> rt019 -> ...
```

Never the reverse.

### Protecting per-RT files

`config.js`, `version.json`, and `sw.js` hold values that must differ per RT. A merge driver keeps them intact while still accepting generic changes from `main`.

Enable it once per clone:

```bash
bash tools/setup-git-merge.sh
```

The driver is declared in `.gitattributes` as `merge=keeprt` and implemented by `tools/merge-rt-files.js`:

| File | Merge behavior |
|---|---|
| `config.js` | Generic fields from `main` are merged; RT identity, URLs, and `version` stay on the RT branch. Shared fields that the RT never overrode still inherit `main`. |
| `version.json` | Each build key stays on the RT branch when that RT changed it; new keys from `main` are added. |
| `sw.js` | The shell/asset list from `main` is merged; the RT cache name is preserved. |

Rules for the driver:

- Run the setup command after cloning or when `git config --get merge.keeprt.driver` is empty.
- Run `node tools/check-deployment.js` immediately after every merge. It fails if any RT file or version marker no longer matches the branch identity.
- Version bumps remain manual on the target RT branch. The driver prevents accidental overwrites, not missing releases.
- If a merge reports a conflict in these files, resolve it manually, then run the deployment check again.
- Without the driver, Git reports conflicts instead of silently overwriting RT values.

If `main` adds a new generic key to `config.js`, it is inherited automatically. If a merge is skipped and the key is missing on an RT branch, runtime behavior may degrade; the deployment check cannot verify every key, so review the merged diff before pushing.

---

## 3. Deployment registry

Maintain this registry outside the repository, for example in a password manager or restricted operations document. Do not record plaintext tokens in the repository.

| Item | RT017 | RT018 | RT... |
|---|---|---|---|
| Admin domain | `sapa-rt017.pages.dev` | `sapa-rt018.pages.dev` | |
| Branch | `main` | `rt018` | |
| Spreadsheet ID | | | |
| Apps Script project ID | | | |
| Web App `/exec` URL | | | |
| `LAPOR_FOLDER_ID` | | | |
| `ADMIN_TOKEN` location | | | |
| `ADMIN_EMAIL` | | | |
| Notification subject prefix | | | |
| Access application names | | | |
| Backup folder | | | |
| Last restore drill | | | |

The registry is required for token rotation, access review, and disaster recovery.

---

## 4. Routine maintenance

| Frequency | Task |
|---|---|
| Weekly | Run `node tools/check-deployment.js --live` from the deployed branch |
| Weekly | Back up each RT spreadsheet and verify the copy opens |
| Weekly | Check email failures, Drive capacity, and Apps Script quota warnings |
| Weekly | Review duplicate NIK, duplicate phone numbers, and kas anomalies |
| Monthly | Restore one backup into a test spreadsheet and verify the data |
| Monthly | Review Cloudflare Access users, policies, and bypass paths |
| Monthly | Review archived residents, kas rows, letters, and complaints |
| Quarterly | Rotate `ADMIN_TOKEN` and revoke stale Access sessions |
| Quarterly | Test the public portal, QR, PWA install, email, and photo upload in incognito |
| Quarterly | Review this procedure and update the deployment registry |

Suggested weekly data checks:

- Letters with status `Selesai` must have a unique `No. Surat`.
- Every kas balance must include `saldoAwal`, reversals, and archived rows.
- Complaints marked `Selesai` should have a completion date.
- Residents with the same NIK or phone number should be reviewed, not merged automatically.
- Photo links should point to the correct RT folder.

---

## 5. Version bump matrix

| Change | Required version updates | Additional action |
|---|---|---|
| `config.js` | `RT_CONFIG.version` and `EXPECTED_CONFIG_VERSION` in `index.html` and `public.html` | Push frontend |
| `index.html` or `public.html` | `APP_BUILD` and the matching `version.json` key | Bump service worker cache |
| `sw.js` only | `CACHE` | Push frontend |
| `Apps Script/code.gs` | `CODE_VERSION` and `EXPECTED_BACKEND_VERSION` | Deploy Apps Script **New version** |
| `tools/mock-server.js` | `CODE_VERSION` must match `code.gs` | Run deployment check |
| New Tailwind classes | Rebuild `tailwind.css` | Verify dark-mode classes exist |
| New RT identity | `config.js` and both `EXPECTED_CONFIG_VERSION` values | Create branch, Pages project, and Apps Script |

A mismatch between `CODE_VERSION` and `EXPECTED_BACKEND_VERSION` triggers a visible warning in the admin UI.

`config.js`, `version.json`, and `sw.js` are RT-specific. The merge driver preserves their existing values, but each RT release must still bump its own markers according to this matrix after merging.

---

## 6. Release checklist

1. Announce the release window to the RT admins.
2. Back up the spreadsheet if the release changes schema or stored fields.
3. Create or update the feature on `main`.
4. Run the functional test harness.
5. Enable the merge driver once per clone, then merge `main` into the target RT branch:

```bash
bash tools/setup-git-merge.sh
git merge main
```

6. Confirm the RT files kept their identity, then apply the version bump matrix:

```bash
git diff --stat HEAD~1 -- config.js version.json sw.js
node tools/check-deployment.js
```

7. Run the deployment check again after the version bump:

```bash
node tools/check-deployment.js
```

8. Deploy `Apps Script/code.gs` with **Deploy > Manage deployments > Edit > New version**.
9. Push the frontend branch and wait for Cloudflare Pages to finish.
10. Run the live check:

```bash
node tools/check-deployment.js --live
```

11. Smoke test in a browser:
    - Admin login through Access.
    - Backend version check.
    - Add and edit a resident.
    - Add a kas transaction.
    - Submit a letter request from the public portal.
    - Submit a complaint with a photo.
    - Check the admin email notification.
    - Check public status lookup.
    - Open the QR modal.
12. Confirm the old service worker has been replaced (hard refresh once).
13. Record the release in `agents.md` and update the deployment registry.

Do not skip step 8. Updating `code.gs` without creating a new deployment leaves the old backend running.

---

## 7. Backup procedure

### Spreadsheet

- Use **File > Make a copy** weekly and before any schema change.
- Keep at least eight weekly copies and twelve monthly copies.
- Name copies with the RT and date, for example `Backup SAPA RT018 2026-10-25`.
- Store copies in the RT's shared Drive folder, not a personal folder.
- Google Sheets version history is a first line of defence, not a replacement for copies.

### Code and configuration

- Keep every release in Git.
- Tag important releases.
- Export or document Cloudflare environment variables and Access policies.
- Keep the deployment registry current.

### Photos

- Pin `LAPOR_FOLDER_ID` for each RT.
- Never rely only on the folder name `Lapor`, especially when several RTs share one Google account.
- Export or copy the photo folder periodically.

### Restore drill

1. Restore the copy into a test spreadsheet.
2. Point a test deployment at the copy.
3. Verify residents, kas balance, letters, complaints, and photo links.
4. Only then restore production data row by row.
5. Do not overwrite production with an untested copy.

---

## 8. Security maintenance

- Enforce 2FA on every Google account that owns a deployment.
- Keep recovery codes in a password manager.
- Use a different `ADMIN_TOKEN` for every RT.
- Store tokens only in Script Properties and browser `localStorage`.
- Review Cloudflare Access users monthly.
- Revoke sessions immediately when an admin leaves.
- Rotate `ADMIN_TOKEN` quarterly or after any suspected exposure.
- After token rotation, ask every admin to update the token in the dashboard.
- Verify that `/` and `/index.html` require Access.
- Verify that `/public`, `/public.html`, `/api`, `config.js`, `version.json`, icons, fonts, manifests, `sw.js`, and `qr-public.png` are bypassed.
- Never place a token, spreadsheet ID, or private URL in this repository.

When RTs share one Google account:

- Treat that account as a single point of failure.
- Monitor shared email, Drive, and Apps Script quotas.
- Use distinct notification subject prefixes.
- Pin a separate Drive folder for each RT.
- Keep separate Apps Script projects and tokens even though the owner account is the same.

---

## 9. Incident and rollback

| Severity | Example | First action |
|---|---|---|
| Critical | Data loss, public portal down, admin exposed | Stop writes, restore Access, restore backup |
| High | Backend version mismatch, email or photo upload broken | Roll back backend or frontend |
| Medium | One admin cannot log in, stale cache | Review Access policy, bump cache |
| Low | Cosmetic issue | Schedule a normal release |

Rollback steps:

- **Backend:** deploy the previous Apps Script version.
- **Frontend:** roll back the Cloudflare Pages deployment to the previous commit.
- **Cache:** bump the service worker cache and ask users to reload once.
- **Data:** restore from the latest verified backup or Google Sheets version history.
- **Access:** restore the previous policy and verify admin redirect plus public bypass.
- **Token exposure:** rotate the affected RT token, update admins, and revoke Access sessions.

After recovery, record the incident, cause, and corrective action in `agents.md`.

---

## 10. Adding a new RT

1. Create a new spreadsheet and bound Apps Script project.
2. Paste the current `Apps Script/code.gs` and deploy a Web App.
3. Set `ADMIN_TOKEN`, `ADMIN_EMAIL`, `NOTIF_SENDER_NAME`, `NOTIF_SUBJECT_PREFIX`, and `LAPOR_FOLDER_ID`.
4. Run `authorizeMail` and `authorizeDrive`.
5. Run `readAllSheets` once to create the six sheets.
6. Create a `rtNNN` branch from the latest generic code.
7. Update `config.js`, both `EXPECTED_CONFIG_VERSION` values, the proxy default URL, build labels, `version.json`, and the service worker cache.
8. Create a Cloudflare Pages project from the branch and set `APPS_SCRIPT_URL`.
9. Add the new hostname to the existing **RT Admin** Access application for `/` and `/index.html`.
10. Add the new hostname to the **RT Public Assets** bypass application for every public path.
11. Generate a new `qr-public.png` for the public portal URL.
12. Run `node tools/check-deployment.js --live`.
13. Smoke test admin and public flows.
14. Register the deployment and schedule the first backup.

Do not reuse another RT's token, Apps Script project, Drive folder, or Pages project.

---

## 11. Testing

The repository includes a branch-aware deployment check:

```bash
node tools/check-deployment.js
```

It verifies:

- RT identity matches the branch name when the branch follows `rtNNN`.
- Config versions, build labels, backend versions, and cache names are synchronized.
- The proxy default points to the same Web App as `publicApiUrl`.
- The public portal domain matches the configured RT.

The live variant also verifies the backend, `/api`, `version.json`, the public portal, and Access protection:

```bash
node tools/check-deployment.js --live
```

The full functional test harness is external to the repository and must not hardcode one RT's identity or versions. When adding tests, derive expectations from `config.js`, `version.json`, and the current branch. Moving that harness into a repository `tests/` folder and running it before release is recommended.

---

## 12. Ownership and review

- System owner: maintains the repository, deployments, tokens, backups, and this procedure.
- RT admin: maintains residents, kas, announcements, activities, letters, and complaints.
- RW 06: will use RT data read-only and approve letters after the RW phase is implemented.

Review this document quarterly and after every critical incident.

---

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 25 October 2026 | Initial maintenance and release procedure |
