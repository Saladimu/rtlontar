# Rollout Ticket: RT___

Reusable per-RT rollout ticket. Copy this file to `ROLLOUT-TICKET-RTNNN.md` for each RT
and fill in the blanks. The procedure itself is in `ROLLOUT-RT.md`; this ticket only
tracks progress and sign-off.

| Field | Value |
|---|---|
| Document | Rollout ticket for a single RT |
| Applies to | RT019 and every later RT after RT017 (reference) and RT018 (pilot) |
| Related documents | `ROLLOUT-RT.md`, `MAINTENANCE.md` (2, 5, 6.4, 9, 10), `BRD-RW06.md`, `RW Apps Script/readme.md`, `rw/README.md` |
| Max RTs | 10 total, including RT017 and RT018 |
| Current status | **Parked** on 31 October 2026 (BRD-RW06 15.1). Do not open a new ticket until rollout is resumed |

Never reuse another RT's spreadsheet, Apps Script project, tokens, Drive folder, or
Cloudflare Pages project. Never merge an RT branch back into `main`.

---

## 0. Ticket identity

| Field | Value |
|---|---|
| RT ID | `RT___` |
| Branch | `rt___` |
| RT name / address | |
| Production domain | `sapa-rt___.pages.dev` |
| Public portal URL | `https://sapa-rt___.pages.dev/public` |
| RT admin email | |
| Admin contact (WhatsApp) | |
| Drive folder for photos | `Lapor RT___` |
| Rollout owner | |
| Cutover date | |
| Ticket / issue link | |

Global preconditions:

- [ ] The previous RT passed its pilot gate; rollout is serial, not parallel
- [ ] The RT admin is reachable on the cutover day and can test from a phone
- [ ] Cloudflare Pages and Access credentials are available
- [ ] Editor access to the new RT's Apps Script project is available

---

## Phase A - Preconditions

- [ ] Spreadsheet backup created (**File > Make a copy**) and the copy opens
- [ ] Current Apps Script deployment version and `ADMIN_TOKEN` recorded in the deployment registry
- [ ] Branch will be created from the latest `main`; no unpushed local work
- [ ] Historical letters confirmed marked `Tidak Perlu` (a new spreadsheet already complies)
- [ ] Cutover window agreed; an RW Admin is available to approve one test letter

Sign-off: RT admin __________ / Owner __________

---

## Phase B - Spreadsheet and RT backend

- [ ] New spreadsheet and bound Apps Script project created (never reuse another RT's)
- [ ] Script Properties set:
  - [ ] `ADMIN_TOKEN` (32+ chars, new)
  - [ ] `RW_TOKEN` (32+ chars, new, different from `ADMIN_TOKEN`)
  - [ ] `ADMIN_EMAIL`
  - [ ] `RT_ID` (for example `RT019`)
  - [ ] `LAPOR_FOLDER_ID`
- [ ] `authorizeMail` and `authorizeDrive` run
- [ ] `readAllSheets()` run once (header migration)
- [ ] Web App deployed: *Execute as* Me, *Who has access* Anyone
- [ ] `GET ?action=version` matches `CODE_VERSION` (`publik-v39-2026-10-28`)
- [ ] `rwCheck` returns `schemaMigrated=true` and `rwTokenConfigured=true`
- [ ] `Lapor_Tindak_Lanjut` has 9 headers
- [ ] Spreadsheet backed up again after migration

Recorded `/exec` URL: __________

---

## Phase C - Branch and frontend configuration

- [ ] `git checkout main && git pull origin main && git checkout -b rt___`
- [ ] `bash tools/setup-git-merge.sh` (once per clone)
- [ ] `config.js` changed only in RT-specific fields:

| Field | New value |
|---|---|
| `version` | `'__'` (incremented; required because `config.js` changed) |
| `rt` | `'___'` |
| `alamatrt` | |
| `alamatContoh` | |
| `publicApiUrl` | `.../exec` |
| `publicPortalUrl` | `https://sapa-rt___.pages.dev/public` |

- [ ] `index.html` `EXPECTED_CONFIG_VERSION` matches the new `version`
- [ ] `public.html` `EXPECTED_CONFIG_VERSION` matches the new `version`
- [ ] `index.html` `APP_BUILD` bumped (for example `2026-11-01-01`)
- [ ] `public.html` `APP_BUILD` set to the same value
- [ ] `version.json` `index` and `public` match the two `APP_BUILD` values
- [ ] `sw.js` `CACHE` bumped (for example `sapa-rt-static-v114`)
- [ ] `functions/api/[[path]].js` `DEFAULT_APPS_SCRIPT_URL` set to the new `/exec` URL
- [ ] `qr-public.png` regenerated for the public portal URL (under 20 KB)
- [ ] `node tools/check-deployment.js` passes
- [ ] Harness run: `test_surat_admin`, `test_public_ux`, every `test_rw_*`, `test_lapor_rw_timeline`
- [ ] Commit `chore(rt___): konfigurasi awal RT___` and push `-u origin rt___`

Watch on later merges:

- [ ] `functions/api/[[path]].js` still points to this RT's `/exec` URL (not protected by `keeprt`)
- [ ] `index.html` / `public.html` `APP_BUILD` resolved deliberately and kept in sync with
      `version.json` and `sw.js`

---

## Phase D - Cloudflare Pages and Access

- [ ] Pages project created from branch `rt___`, framework preset **None**, output `.`
- [ ] Environment variable `APPS_SCRIPT_URL` set to the new `/exec` URL
- [ ] Deployed; assigned domain recorded
- [ ] If the domain is not `sapa-rt___.pages.dev`: rename the project **or** update
      `publicPortalUrl` plus the QR code and re-run the checker
- [ ] Application **RT Admin**: hostname `/` and `/index.html` added; policy allows the RT admin email
- [ ] Application **RT Public Assets**: hostname added with bypass paths:
      `/public`, `/public.html`, `/api`, `/config.js`, `/version.json`, `/rt-icon.png`,
      `/icon-192.png`, `/favicon.ico`, `/apple-touch-icon.png`, `/tailwind.css`,
      `/fonts.css`, `/fonts/*`, `/manifest-public.webmanifest`, `/sw.js`, `/qr-public.png`
- [ ] `/` and `/index.html` are **not** bypassed
- [ ] Verified: admin path redirects to Access; public path loads in incognito; icons and fonts render
- [ ] `node tools/check-deployment.js --live` passes

---

## Phase E - Orchestrator registration

- [ ] Script Property `RT_TOKEN_RT___` added with the RT's `RW_TOKEN` value (no redeploy needed)
- [ ] RT registered from the portal as `RW Admin`: RT ID, name, address, unique `/exec` endpoint
- [ ] **Cek** (`rwRtHealth`) reports healthy and the correct backend version
- [ ] RW dashboard shows the RT as `OK` and includes it in the aggregate totals
- [ ] RT totals match the RT admin dashboard for residents, kas, pending letters, and open complaints

If it fails, check `Last Error` in the registry first. The usual causes are a missing
`RT_TOKEN_RT___` property and a `RW_TOKEN` mismatch.

---

## Phase F - Smoke test

RT admin UI:

- [ ] Login succeeds; footer shows the correct RT, build, and config version
- [ ] Add and edit one resident; the row survives a reload
- [ ] Add one kas transaction; the balance includes `saldoAwal`
- [ ] Submit one letter from the public portal; `Rw Status` becomes `Menunggu`
- [ ] `Selesai` is rejected until RW approves
- [ ] RW **Disetujui**, then set `Selesai` with a unique No. Surat
- [ ] **Dikembalikan** three times with `resubmitSurat` between rounds; `Rw Revisi` increments
- [ ] After the third return, `Kembalikan` is rejected with `max_negative` and `Tolak` succeeds
- [ ] Submit one complaint with a photo; the photo lands in the correct Drive folder
- [ ] `laporEscalate` moves the complaint to `Perlu Tindak Lanjut`
- [ ] `rwLaporNote` appears in **Riwayat tanggapan RW** with actor, timestamp, status, and Publik/Internal badge
- [ ] An **Internal** response does not appear on the public status page; a **Publik** response does
- [ ] Letter and complaint notification emails arrive at `ADMIN_EMAIL`
- [ ] Public portal works: announcements, activities, letter status, complaint status, QR modal, PWA install
- [ ] Resident check accepts `0...` and `62...` phone numbers; invalid NIK shows "Harap periksa ulang NIK"

RW portal:

- [ ] Dashboard shows the new RT as `OK`
- [ ] Residents, kas, letters, and complaints lists load for the new RT
- [ ] An approved letter and a returned letter appear with the correct status
- [ ] `RW Viewer` sees only the last four digits of NIK/phone and `[disembunyikan]` for the address,
      and cannot open the administration pages
- [ ] Period filter and print reports (kas, letters, complaints) work for the new RT
- [ ] Digest **Pratinjau** renders and **Kirim sekarang** sends (when `DIGEST_ENABLED` is on)

Audit and outbox:

- [ ] Audit shows login, decision, response, registry, and settings rows with GMT+7 timestamps
- [ ] Outbox has no `Failed` rows; any `Retry` row resolves on the next trigger run

---

## Phase G - Pilot gate (at least one week)

- [ ] No RW-related incident during the pilot week
- [ ] At least one approved letter, one returned letter, and one complaint response completed end to end
- [ ] Outbox clean; no permanently failed entries
- [ ] Audit entries use the correct actor and GMT+7 timestamps
- [ ] RT admin confirms the flow is understood and needs no further training
- [ ] Deployment registry, `agents.md`, and the ticket updated with the RT ID, versions, and date

Sign-off: RW 06 owner __________ / RT admin __________ / live-check runner __________

---

## Phase H - Rollback (only if a gate fails)

- [ ] `rwRegistrySave` with `aktif=false` (RT disappears from the dashboard, data is kept)
- [ ] RT Apps Script reverted to the previous deployment version (**Manage deployments > Edit**)
- [ ] Spreadsheet copy restored if the migration is suspected of corrupting data
- [ ] Additive `Rw *` columns and `Lapor_Tindak_Lanjut` left in place
- [ ] Incident, failing gate, and recovery step recorded in `agents.md`
- [ ] Phases E and F re-run before the RT is enabled again

---

## Rollout tracker

| RT | Branch | Domain | Last passed phase | Pilot status | Sign-off date |
|---|---|---|---|---|---|
| RT017 | `main` | sapa-rt017.pages.dev | Complete (reference) | - | - |
| RT018 | `rt018` | sapa-rt018.pages.dev | Complete (pilot) | - | - |
| RT019 | `rt019` | sapa-rt019.pages.dev | | | |
| RT020 | `rt020` | sapa-rt020.pages.dev | | | |
| RT021 | `rt021` | sapa-rt021.pages.dev | | | |
| RT022 | `rt022` | sapa-rt022.pages.dev | | | |
| RT023 | `rt023` | sapa-rt023.pages.dev | | | |
| RT024 | `rt024` | sapa-rt024.pages.dev | | | |
| RT025 | `rt025` | sapa-rt025.pages.dev | | | |
| RT026 | `rt026` | sapa-rt026.pages.dev | | | |

RT017 and RT018 already occupy 2 of the 10 slots; 8 remain.
