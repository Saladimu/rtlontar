# Rollout Runbook: Enabling the Next RT

| Field | Value |
|---|---|
| Document | Step-by-step rollout runbook for one new RT |
| Applies to | RT019 and every later RT after RT017 (reference) and RT018 (pilot) |
| Related documents | `ROLLOUT-TICKET.md` (progress tracker per RT), `MAINTENANCE.md` (sections 2, 5, 6, 6.4, 9, 10), `BRD-RW06.md`, `readme.md`, `Apps Script/readme.md`, `RW Apps Script/readme.md`, `rw/README.md` |
| Owner | System owner, together with the RT admin |
| Expected effort | 2-4 hours hands-on, then a 1-week pilot gate |
| Current status | **Parked** on 31 October 2026 (BRD-RW06 15.1). RT017 and RT018 are live; RT019-RT026 are deferred. Use this runbook only when rollout is resumed |

This runbook turns the phase checklist in `MAINTENANCE.md` section 6.4 into concrete,
copy-pasteable steps. Replace `RTNNN` with the real RT ID (for example `RT019`) and
`rtNNN` with the branch name (for example `rt019`) throughout.

Never reuse another RT's spreadsheet, Apps Script project, tokens, Drive folder, or
Cloudflare Pages project. Never merge an RT branch back into `main`.

Copy `ROLLOUT-TICKET.md` to `ROLLOUT-TICKET-RTNNN.md` for each RT and tick it as you go;
its rollout tracker records which RTs have passed which phase.

---

## 1. Before you start

Collect these values first. Missing values are the most common cause of a failed
cutover, so fill the table before touching any code.

| Value | Example | Where it comes from |
|---|---|---|
| RT ID | `RT019` | RT administration |
| Branch name | `rt019` | Derived from the RT ID |
| RT name | `RT 019 / RW 06` | RT administration |
| RT address | `Lontar Tengah` | RT administration |
| Production domain | `sapa-rt019.pages.dev` | Cloudflare Pages project name |
| Public portal URL | `https://sapa-rt019.pages.dev/public` | Domain plus `/public` |
| RT admin email | `admin.rt019@gmail.com` | RT administration |
| Admin contact | name, WhatsApp | RT administration |
| `ADMIN_TOKEN` | random 32+ chars | Generate new; never reuse |
| `RW_TOKEN` | random 32+ chars | Generate new; never reuse |
| Drive folder for complaint photos | `Lapor RT019` | Google Drive |
| Cutover window | outside peak citizen hours | Agreed with the RT admin |

Confirm two conditions before starting:

1. The RT is registered in the rollout plan with an owner and a target date.
2. The RT admin is reachable on the cutover day and can test from a phone.

---

## 2. Phase A - Preconditions

- [ ] Spreadsheet backup created (**File > Make a copy**) and the copy opens correctly.
- [ ] Current Apps Script deployment version and `ADMIN_TOKEN` recorded in the deployment registry.
- [ ] RT branch will be created from the latest `main`; no local-only work exists there.
- [ ] Historical letters confirmed: existing rows are marked `Tidak Perlu`, so only new
      submissions enter the RW queue. A brand-new spreadsheet already satisfies this.
- [ ] Cutover window agreed and RW admins available to approve a test letter.

Sign-off: RT admin, system owner.

---

## 3. Phase B - Spreadsheet and RT backend

### 3.1 Create the spreadsheet and Apps Script project

1. Create a new Google Sheets file named `SAPA RT019`.
2. Open **Extensions > Apps Script**. The project is bound to this spreadsheet; a
   standalone project will not work because the code calls
   `SpreadsheetApp.getActiveSpreadsheet()`.
3. Paste the current `Apps Script/code.gs` from the `main` branch.
4. Save the project.

All six tabs and their headers are created automatically on first read, so there is
no need to build the sheets by hand.

### 3.2 Set Script Properties

In **Project Settings > Script Properties**, add:

| Property | Value | Required |
|---|---|---|
| `ADMIN_TOKEN` | new random 32+ char secret | Yes |
| `ADMIN_EMAIL` | `admin.rt019@gmail.com` | Yes |
| `RW_TOKEN` | new random 32+ char secret, different from `ADMIN_TOKEN` | Yes |
| `RT_ID` | `RT019` | Yes |
| `NOTIF_SENDER_NAME` | e.g. `Pengajuan surat RT019` | Recommended |
| `NOTIF_SUBJECT_PREFIX` | e.g. `[SAPA-RT019]` | Recommended |
| `LAPOR_FOLDER_ID` | Drive folder ID, optional | Optional |
| `SALDO_AWAL` | opening kas balance, e.g. `1500000` | Optional |
| `PUBLIC_PORTAL_ENABLED` | `true` | Optional, defaults to on |
| `SURAT_ENABLED` | `true` | Optional, defaults to on |
| `LAPOR_ENABLED` | `true` | Optional, defaults to on |

Never give `RW_TOKEN` to an RT admin. It belongs only to the RW orchestrator.

### 3.3 Authorize and initialize

1. Run `authorizeMail` once (**Run > Review permissions > Allow**).
2. Run `authorizeDrive` once to create and share the `Lapor` folder.
3. Run `readAllSheets` once. It calls `ensureRwSchema()`, creates all six tabs with
   their headers, and adds the `Rw *` columns and `Lapor_Tindak_Lanjut`.

### 3.4 Deploy the Web App

1. **Deploy > New deployment > Web app**.
2. Execute as **Me**; who has access **Anyone**.
3. Copy the `/exec` URL into the deployment registry.
4. Each later change to `code.gs` needs **Manage deployments > Edit > New version**;
   saving the file alone does not update the live Web App.
5. Verify the migration:

```bash
curl -s "https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=version"
```

Expected: `version` equals `CODE_VERSION` in `Apps Script/code.gs`
(`publik-v39-2026-10-28` at the time of writing; always read the current value from
the file rather than copying this line).

Then check the RW handshake (replace the token):

```bash
curl -s -X POST "https://script.google.com/macros/s/DEPLOYMENT_ID/exec" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"rwCheck","token":"RW_TOKEN_VALUE"}'
```

Expected: `schemaMigrated:true` and `rwTokenConfigured:true`.

### 3.5 Verify the schema

- `Pengajuan_Surat` has 7 `Rw *` columns before `ID`.
- `Lapor_Aspirasi` has 4 `Rw *` columns.
- `Lapor_Tindak_Lanjut` exists with 9 headers: `ID, Lapor ID, RT ID, Aktor, Peran,
  Catatan, Status, Visibilitas, Waktu`.
- Existing rows show `Rw Status=Tidak Perlu`. A brand-new sheet has no rows, which is
  expected and does not indicate a failed migration.
- `action=read` returns a `Lapor_Tindak_Lanjut` array (empty is fine).
- `RW_SCHEMA_MIGRATED` is `true` in Script Properties.

If migration fails, restore the spreadsheet copy. The new columns are additive, so
reverting the deployment keeps existing data readable.

---

## 4. Phase C - Branch and frontend configuration

### 4.1 Create the branch

```bash
# Do not reuse another RT's branch; confirm rt019 does not exist yet
git checkout main
git pull origin main
git checkout -b rt019

# Enable the merge driver once per clone
bash tools/setup-git-merge.sh
```

### 4.2 Update `config.js`

Change only the RT-specific values:

| Field | New value |
|---|---|
| `version` | next integer, e.g. `'13'` (required: `config.js` changed) |
| `rt` | `'019'` |
| `alamatrt` | e.g. `'Lontar Tengah'` |
| `alamatContoh` | e.g. `'Jl. Lontar Tengah'` |
| `publicApiUrl` | the new `/exec` URL |
| `apiBase` | `/api` (unchanged) |
| `publicPortalUrl` | `https://sapa-rt019.pages.dev/public` |

Leave the shared lists (`jenisSurat`, `statusSurat`, `jenisPengaduan`,
`statusPengaduan`), `appName`, `rw`, `kelurahan`, `kecamatan`, `kota`, and `provinsi`
as they are unless the RT differs.

### 4.3 Update the version markers

Any `config.js` change requires a `version` bump, and a `version` bump must be
mirrored in both HTML files. Do the full set in one commit so the first deploy is
clean and identifiable (this is what RT018 did at creation):

| File | Marker | Action |
|---|---|---|
| `index.html` | `EXPECTED_CONFIG_VERSION` | match the new `version` |
| `public.html` | `EXPECTED_CONFIG_VERSION` | match the new `version` |
| `index.html` | `APP_BUILD` | bump, e.g. `2026-11-01-01` |
| `public.html` | `APP_BUILD` | bump to the same value |
| `version.json` | `index`, `public` | match the two `APP_BUILD` values |
| `sw.js` | `CACHE` | bump, e.g. `sapa-rt-static-v114` |
| `functions/api/[[path]].js` | `DEFAULT_APPS_SCRIPT_URL` | new `/exec` URL |

The checker fails when `EXPECTED_CONFIG_VERSION` does not equal `RT_CONFIG.version`,
when either `APP_BUILD` does not equal its `version.json` key, or when the service
worker cache does not match `sapa-rt-static-vNNN`.

The proxy default is only a fallback; set `APPS_SCRIPT_URL` in Cloudflare Pages as
well so the deployment does not depend on the file value.

### 4.4 Files the merge driver does not protect

`keeprt` only covers `config.js`, `version.json`, and `sw.js`. Two other files need
manual care on every later `git merge main`:

- **`functions/api/[[path]].js`** — if `main` changes it, the merge conflicts. Resolve
  by keeping this RT's `DEFAULT_APPS_SCRIPT_URL`. Even when the merge succeeds without
  a conflict, confirm the URL is still this RT's `/exec` value: a silently kept `main`
  URL would route public traffic to another RT.
- **`index.html` / `public.html`** — because this branch bumped `APP_BUILD`, a `main`
  release that also bumps it will conflict on those two lines. Take this RT's value,
  which already matches the `version.json` the driver preserved. Adopting `main`'s
  build is also valid, but then you must also update `version.json` (the driver keeps
  the RT value there) and bump `sw.js` `CACHE` so the new shell is picked up.

The checker fails if either file still contains conflict markers or if the build
markers disagree, so run it after every merge.

### 4.5 Regenerate the QR code

`qr-public.png` must encode `https://sapa-rt019.pages.dev/public`. Replace the file
and keep it small (under 20 KB where possible). No `?v=` bump is needed for the QR,
but bump the icon `?v=` only if the icon files themselves change.

### 4.6 Run the local checks

```bash
node tools/check-deployment.js
```

All checks must pass. The checker derives expected values from the branch name, so a
failure usually means one of these is wrong: `rt` in `config.js`, the `pages.dev`
host in `publicPortalUrl`, or a marker that was not bumped. It also fails if leftover
merge conflict markers exist in any tracked deployment file.

Also run the functional tests from the shared harness before pushing.

```bash
cd /tmp/opencode
node test_surat_admin.js
node test_public_ux.js
node test_rw_orchestrator.js
node test_rw_phase1.js
node test_rw_portal.js
node test_rw_gateway.js
node test_lapor_rw_timeline.js
```

The harness lives outside the repository. Run the subset that matches the features you
touched; at minimum run every `test_rw_*` file plus `test_surat_admin.js` and
`test_public_ux.js`, since the RW flow changes header layouts and shared rendering.

### 4.7 Push the branch

```bash
git add -A
git commit -m "chore(rt019): konfigurasi awal RT019"
git push -u origin rt019
```

---

## 5. Phase D - Cloudflare Pages and Access

### 5.1 Create the Pages project

1. Create a new Cloudflare Pages project from this repository.
2. Framework preset **None**. Build command empty; build output directory `.`
   (the app is served from the repository root). The `rw/` portal is a separate
   Pages project and is not part of this step.
3. Set the production environment variable:

| Variable | Value |
|---|---|
| `APPS_SCRIPT_URL` | the new `/exec` URL |

4. Deploy the `rt019` branch and note the assigned domain.
5. If the domain is not `sapa-rt019.pages.dev`, either rename the project or update
   `publicPortalUrl` and the QR code, then re-run `node tools/check-deployment.js`.

### 5.2 Add the hostname to Access

Access applications are shared across RTs; add the new hostname instead of creating
new applications.

**Application `RT Admin`** (protects the admin UI):

- Add public hostname `sapa-rt019.pages.dev`, path `/`.
- Add public hostname `sapa-rt019.pages.dev`, path `/index.html`.
- Policy: allow the RT admin email (and any RW admin who needs access).

**Application `RT Public Assets`** (bypass for public paths):

- Add public hostname `sapa-rt019.pages.dev` with paths `/public`, `/public.html`,
  `/api`, `/config.js`, `/version.json`, `/rt-icon.png`, `/icon-192.png`,
  `/favicon.ico`, `/apple-touch-icon.png`, `/tailwind.css`, `/fonts.css`, `/fonts/*`,
  `/manifest-public.webmanifest`, `/sw.js`, `/qr-public.png`.
- Policy: bypass, everyone.

Cloudflare Pages redirects `/public.html` to `/public` with HTTP 308, so `/public`
must be bypassed explicitly. Never bypass `/` or `/index.html`.

Verify: the admin path redirects to Access, the public path loads in incognito, and
the icons and fonts render in a fresh browser profile.

### 5.3 Run the live check

```bash
node tools/check-deployment.js --live
```

This verifies the backend version, the `/api` proxy, `version.json`, the public
portal, and that the admin path is protected by Access.

---

## 6. Phase E - Orchestrator registration

The orchestrator is shared by all RTs and is not redeployed for a new RT unless its
code changed.

1. In the orchestrator Apps Script project, add the Script Property
   `RT_TOKEN_RT019` with the same value as the RT's `RW_TOKEN`. Save the project;
   no redeploy is needed because Script Properties are read at runtime.
2. Register the RT from the RW portal: sign in as `RW Admin`, open
   **Administrasi > Registry RT**, and save `RT ID`, `Nama`, `Alamat`, and the
   `/exec` endpoint. The endpoint must be unique and end in `/exec`. Do this from
   the portal rather than by hand: `rwRegistrySave` requires the gateway-verified
   `email`, so a raw request needs `GATEWAY_SECRET`.
3. Press **Cek** (or call `rwRtHealth`) and confirm the RT reports a healthy
   backend version.
4. Open the RW dashboard and confirm the new RT is `OK` and included in the
   aggregate totals.
5. Confirm the RT totals match the RT admin dashboard for residents, kas, pending
   letters, and open complaints.

If the RT does not appear, check `Last Error` in the registry first; the usual causes
are a missing `RT_TOKEN_RT019` property and a `RW_TOKEN` mismatch.

---

## 7. Phase F - Smoke test

Run this with the RT admin watching. Every line must pass before the pilot gate.

**RT admin UI**

- [ ] Access login succeeds; the footer shows the correct RT, build, and config version.
- [ ] Add and edit one resident; the row survives a reload.
- [ ] Add one kas transaction; the balance includes `saldoAwal`.
- [ ] Submit one letter from the public portal; `Rw Status` becomes `Menunggu`.
- [ ] `Selesai` is rejected until RW approves.
- [ ] `rwSuratDecision` **Disetujui**, then set `Selesai` with a unique No. Surat.
- [ ] **Dikembalikan** three times with `resubmitSurat` between rounds; `Rw Revisi`
      increments and the third return is accepted.
- [ ] After the third return, `Kembalikan` is rejected with `max_negative`, while
      `Tolak` succeeds as the final decision.
- [ ] Submit one complaint with a photo; the photo lands in the correct Drive folder.
- [ ] `laporEscalate` moves the complaint to `Perlu Tindak Lanjut`.
- [ ] `rwLaporNote` appears in the RT panel **Riwayat tanggapan RW** with actor,
      timestamp, status, and a Publik/Internal badge.
- [ ] An **Internal** response does not appear on the public status page; a **Publik**
      response does.
- [ ] The complaint and letter notification emails arrive at `ADMIN_EMAIL`.
- [ ] Public portal works: announcements, activities, letter status check, complaint
      status check, QR modal, and PWA install prompt.
- [ ] Resident check accepts both `0...` and `62...` phone numbers, and shows
      "Harap periksa ulang NIK" for an invalid NIK.

**RW portal**

- [ ] Dashboard shows the new RT as `OK`.
- [ ] Lists for residents, kas, letters, and complaints load for the new RT.
- [ ] An approved letter and a returned letter both appear with the correct status.
- [ ] `RW Viewer` sees only the last four digits of NIK/phone and `[disembunyikan]`
      for the address, and cannot open the administration pages.

**Audit and outbox**

- [ ] Audit shows login, decision, response, registry, and settings rows for the new
      RT with GMT+7 timestamps.
- [ ] Outbox has no `Failed` rows; any `Retry` row resolves after the next trigger run.

---

## 8. Phase G - Pilot gate

Keep the RT in pilot for at least one week before starting the next one.

- [ ] No RW-related incident during the pilot week.
- [ ] At least one approved letter, one returned letter, and one complaint response
      completed end to end.
- [ ] Outbox is clean; no permanently failed entries.
- [ ] Audit entries use the correct actor and GMT+7 timestamps.
- [ ] RT admin confirms the flow is understood and needs no further training.
- [ ] Deployment registry, `agents.md`, and the rollout ticket updated with the RT ID,
      versions, and date.

Sign-off: RW 06 owner, RT admin, and the person who ran the live check.

---

## 9. Phase H - Rollback

Run only if a gate fails and cannot be fixed the same day.

1. Deactivate the RT: `rwRegistrySave` with `aktif=false`. It disappears from the
   dashboard but keeps its data.
2. Revert the RT Apps Script to the previous deployment version
   (**Manage deployments > Edit > previous version**). The URL stays the same.
3. Restore the spreadsheet copy if the schema migration is suspected of corrupting
   data.
4. Keep the additive `Rw *` columns and `Lapor_Tindak_Lanjut`; they are safe while
   unused.
5. Record the incident, the failing gate, and the recovery step in `agents.md`.
6. Re-run phases E to F before enabling the RT again.

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Admin page loads without login | Path `/` not added to `RT Admin` | Add the hostname and paths, then retest in incognito |
| Public portal asks for login | `/public` (not just `/public.html`) not bypassed | Add `/public` to `RT Public Assets` |
| Icons and fonts missing on public page | `fonts.css` or `/fonts/*` not bypassed | Add both to the bypass application |
| `Gagal cek versi backend` in admin | `APPS_SCRIPT_URL` wrong, or backend version mismatch | Check the env var and `EXPECTED_BACKEND_VERSION` |
| Checker fails on RT identity | `rt` in `config.js` does not match the branch | Fix `rt` and re-run the checker |
| Checker fails on domain | `publicPortalUrl` host is not `sapa-rtNNN.pages.dev` | Rename the Pages project or fix the URL |
| `rwCheck` returns `rw_unauthorized` | `RW_TOKEN` missing or wrong | Set it in Script Properties and retry |
| Registry shows `Last Error` after **Cek** | `RT_TOKEN_RTNNN` missing or mismatched | Add the property with the RT's `RW_TOKEN` |
| `duplicate_endpoint` on `rwRegistrySave` | Another RT already uses that `/exec` URL | Each RT must have its own Apps Script deployment and `/exec` URL |
| Letter cannot be marked `Selesai` | `Rw Status` is not `Disetujui` | Approve through the RW portal first |
| Complaint response missing on public page | Response saved as `Internal` | Send again with `Publik` visibility |
| Photos fail to upload | Drive scope not granted | Run `authorizeDrive`, redeploy, retry |

---

## 11. Copy-paste checklist

```text
Phase A - Preconditions
[ ] Spreadsheet backup verified
[ ] Deployment registry updated with the current version
[ ] Cutover window agreed

Phase B - RT backend
[ ] Spreadsheet and bound Apps Script project created
[ ] ADMIN_TOKEN, ADMIN_EMAIL, RW_TOKEN, RT_ID set
[ ] authorizeMail and authorizeDrive run
[ ] readAllSheets run once
[ ] New deployment created and /exec URL recorded
[ ] action=version matches CODE_VERSION
[ ] rwCheck returns schemaMigrated and rwTokenConfigured true
[ ] Lapor_Tindak_Lanjut has 9 headers

Phase C - Frontend
[ ] Branch rtNNN created from main
[ ] config.js: version, rt, alamatrt, alamatContoh, publicApiUrl, publicPortalUrl
[ ] EXPECTED_CONFIG_VERSION updated in index.html and public.html
[ ] APP_BUILD updated in index.html and public.html (same value)
[ ] version.json index and public updated
[ ] sw.js CACHE bumped
[ ] proxy DEFAULT_APPS_SCRIPT_URL updated
[ ] qr-public.png regenerated
[ ] node tools/check-deployment.js passes
[ ] Branch pushed

Phase D - Cloudflare
[ ] Pages project created with APPS_SCRIPT_URL
[ ] Hostname and paths added to RT Admin
[ ] Public paths added to RT Public Assets
[ ] node tools/check-deployment.js --live passes

Phase E - Orchestrator
[ ] RT_TOKEN_RTNNN added
[ ] rwRegistrySave done with unique /exec endpoint
[ ] rwRtHealth healthy
[ ] Dashboard shows the RT as OK

Phase F - Smoke test
[ ] All RT admin checks pass
[ ] All RW portal checks pass
[ ] Audit and outbox checks pass

Phase G - Pilot
[ ] One week without incident
[ ] One approved, one returned letter, one complaint response
[ ] Outbox clean, audit timestamps correct
[ ] Registry and agents.md updated

Phase H - Rollback (only if needed)
[ ] rwRegistrySave aktif=false
[ ] Previous Apps Script version restored
[ ] Spreadsheet copy restored
[ ] Incident recorded in agents.md
```
