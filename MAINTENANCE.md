# SAPA-RT Maintenance & Release Procedure

| Field | Value |
|---|---|
| Document | Maintenance and release runbook |
| Applies to | Every SAPA-RT deployment (RT017, RT018, and future RTs) |
| Related documents | `readme.md`, `panduan.md`, `agents.md`, `Apps Script/readme.md`, `RW Apps Script/readme.md`, `BRD-RW06.md` |
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

### 6.1 RW 06 schema rollout (backend v38)

Run this once per RT when adopting the RW 06 integration:

1. Back up the spreadsheet (**File > Make a copy**) and note the current Apps Script deployment version.
2. Deploy `code.gs` **publik-v38-2026-10-26** as a **New version**. v38 membatasi `Kembalikan` pada 3 revisi namun tetap menyediakan `Setujui`/`Tolak` sebagai keputusan final dan mengizinkan ajukan ulang setelah pengembalian ketiga; v37 memperbaiki penulisan `Rw Diperbarui` saat eskalasi dan memulihkan nilai `Rw Status` yang tidak dikenal menjadi `Tidak Perlu`. Skema kolom tidak berubah dari v35/v36/v37.
3. In **Project Settings > Script Properties**, set:
   - `RW_TOKEN` — a unique secret per RT, shared only with the RW orchestrator. Never reuse `ADMIN_TOKEN`, and do not give it to RT admins.
   - `RT_ID` — optional, for example `RT018`, written to `Lapor_Tindak_Lanjut`.
4. Open the admin dashboard once or call `action=read`, so `ensureRwSchema()` runs.
5. Verify the migration:
   - `Pengajuan_Surat` has 7 `Rw *` columns before `ID`; `Lapor_Aspirasi` has 4.
   - `Lapor_Tindak_Lanjut` exists with 9 headers.
   - Existing rows show `Rw Status=Tidak Perlu`; nilai rusak (mis. `ADU-...`) otomatis dipulihkan saat dashboard dimuat.
   - `rwCheck` returns `schemaMigrated:true` and `rwTokenConfigured:true`.
6. Smoke test:
   - Submit a new letter → `Rw Status=Menunggu`; `Selesai` is rejected until a `rwSuratDecision` approves it.
   - Send `rwSuratDecision` with `Disetujui`, then set `Selesai` with a No. Surat.
   - Send `Dikembalikan` three times, calling `resubmitSurat` between rounds; confirm `Rw Versi` increments and the third return is accepted.
   - Resubmit after the third return; confirm `Dikembalikan` is rejected (`max_negative`) but `Ditolak` succeeds as the final decision without adding a revision.
   - Confirm `resubmitSurat` after that final `Ditolak` returns `max_negative`.
   - Escalate a complaint with `laporEscalate`; send `rwLaporNote`; confirm the audit row and public/internal visibility.
7. Repeat for RT018 first, then the remaining RTs. Never merge an RT branch back into `main`.

If migration fails, restore the spreadsheet copy. The added columns are additive, so reverting the backend deployment leaves existing data readable.

### 6.2 RW 06 orchestrator setup

Set up the orchestrator once for RW 06. It runs in its own Apps Script project and spreadsheet, never inside an RT project.

1. Create a spreadsheet and a bound Apps Script project for RW 06.
2. Paste `RW Apps Script/code.gs` and deploy it as a Web app (**Execute as: Me**, **Who has access: Anyone**).
3. Set Script Properties:
   - `GATEWAY_SECRET` — random string of at least 32 characters, shared only with the RW gateway.
   - `RW_BOOTSTRAP_ADMIN` — email of the first RW Admin.
   - `RT_TOKEN_RT018`, `RT_TOKEN_RT017`, and so on — must equal the `RW_TOKEN` value of the matching RT.
4. Run `setupOrchestrator()` once to create the tabs and default settings.
5. Run `installTriggers()` once to install outbox retry (every 5 minutes) and retention cleanup (daily at 02:00).
6. Register each RT with `rwRegistrySave` using `https://script.google.com/macros/s/.../exec`; endpoints must be unique.
7. Create RW users with `rwUsersSave`. Use `userEmail` for the target email so it does not collide with the gateway identity field `email`.
8. Verify with `GET ?action=version`, then `POST action=rwSession`, `rwDashboard`, and `rwRtHealth` for every RT.

Full API, schema, and security detail is in `RW Apps Script/readme.md`.

### 6.3 RW 06 portal deployment

The portal lives in `rw/` and is deployed as its own Cloudflare Pages project. RW Admin can decide letters and respond to complaints; RW Viewer remains read-only.

1. Create a Cloudflare Pages project connected to this repository. Set **Root directory** to `rw`, build command empty, and output directory `.`.
2. Set environment variables for Production:
   - `ORCHESTRATOR_URL` — orchestrator Web App URL ending in `/exec`.
   - `GATEWAY_SECRET` — the same value as the orchestrator Script Property, at least 32 random characters.
   - `CF_ACCESS_TEAM_DOMAIN` — for example `rw06.cloudflareaccess.com` (no `https://`).
   - `CF_ACCESS_AUD` — audience tag of the RW Access application. Separate multiple values with commas.
   - Do **not** set `DEV_MODE` in production. Even if set, the gateway rejects it outside `localhost`/`127.0.0.1`.
3. In Cloudflare Access, create an application for the portal domain and allow only RW pengurus emails. Do not bypass `/api`; the gateway must verify every request.
4. Make sure each Access email also exists in the orchestrator `Users` tab with role `RW Admin` or `RW Viewer`.
5. Deploy and smoke test:
   - Open the portal root; Access login succeeds and the dashboard shows both RTs.
   - Open Data Warga, Kas, Pengajuan Surat, and Pengaduan; open a detail drawer and load the complaint timeline.
   - As `RW Admin`, approve a disposable letter and send a complaint response. Confirm the in-app warning modal appears before the write, the RT row/list refreshes, and the toast reports success or queued delivery.
   - Verify negative letter decisions require a note and that public complaint notes appear on the RT public status page while internal notes do not.
   - Sign in as a `RW Viewer`; NIK/HP show only the last four digits, addresses show `[disembunyikan]`, and no write controls are rendered.
   - `GET /api/health` reports `orchestrator`, `gatewaySecret`, and `access` as configured.
6. For local preview only, run `PORT=8010 node rw/tools/mock-server.js` and open `http://localhost:8010`. Demo accounts are `rw@example.com` and `viewer@example.com`.
7. After changing portal files, bump `BUILD` in `rw/app.js` and `rw/version.json` together. No service worker is used by the portal, so no cache version bump is needed.

When an RW operator leaves, remove the Access policy entry, deactivate the orchestrator user, and rotate `GATEWAY_SECRET` if exposure is suspected.

> Deploying new code requires **Manage deployments > Edit > New version**; the URL stays the same.

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
- Use a different `RW_TOKEN` for every RT and keep it separate from `ADMIN_TOKEN`; only the RW orchestrator/portal holds it.
- Store `ADMIN_TOKEN` only in Script Properties and browser `localStorage`. Store `RW_TOKEN` and `GATEWAY_SECRET` only in Script Properties; never in a browser.
- Review Cloudflare Access users monthly.
- Revoke sessions immediately when an admin leaves.
- Rotate `ADMIN_TOKEN` quarterly or after any suspected exposure; rotate `RW_TOKEN` when an RW operator leaves or a spoke is retired.
- After token rotation, ask every admin to update the token in the dashboard.
- Verify that `/` and `/index.html` require Access.
- Verify that `/public`, `/public.html`, `/api`, `config.js`, `version.json`, icons, fonts, manifests, `sw.js`, and `qr-public.png` are bypassed.
- Verify the RW portal domain requires Access and that `/api/*` is **not** bypassed.
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
12. Add the RT's `RW_TOKEN` to the orchestrator as `RT_TOKEN_<RTID>`, then run `rwRegistrySave`.
13. Run `node tools/check-deployment.js --live`.
14. Smoke test admin, public, and RW flows (`rwCheck`, `rwRead`, dashboard, one decision, one complaint response).
15. Register the deployment and schedule the first backup.

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

RW orchestrator tests use a VM harness with mocked RT backends:

```bash
cd /tmp/opencode
node test_rw_orchestrator.js
```

Before releasing the orchestrator, also run `test_rw_phase1.js`, `test_codegs_read.js`, and `test_kas_feature.js` to confirm the RT contract still matches.

---

## 12. Ownership and review

- System owner: maintains the repository, deployments, tokens, backups, and this procedure.
- RT admin: maintains residents, kas, announcements, activities, letters, and complaints.
- RW 06: approves letters and responds to escalated complaints through the RW portal (Phase 4). The orchestrator (Phase 3) and the portal read/write UI are implemented and tested; the RT admin UI for RW status/filter/panel is already available.

Review this document quarterly and after every critical incident.

---

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 25 October 2026 | Initial maintenance and release procedure |
| 1.1 | 25 October 2026 | Added RW 06 schema rollout, `RW_TOKEN` rotation, and pilot verification steps |
| 1.2 | 25 October 2026 | RT backend v36 (`saldoAwal`), RW orchestrator setup, trigger/outbox operations, and orchestrator tests |
| 1.3 | 26 October 2026 | RT backend v37 repairs invalid `Rw Status`, escalation timestamp column, and shows No. Pengaduan in the RT RW panel |
