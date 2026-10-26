# BRD-RW06: RW 06 Oversight and Approval System

| Field | Value |
|---|---|
| Document ID | BRD-RW06 |
| Title | RW 06 Oversight and Approval System |
| Version | 0.7 |
| Status | Phase 1, Phase 2 status/filter/panel, Phase 3 orchestrator, and Phase 4 read-only portal milestone implemented |
| Date | 26 October 2026 |
| Related system | SAPA-RT (RT administration and public service portal) |
| Related documents | `readme.md`, `panduan.md`, `agents.md`, `RW Apps Script/readme.md`, `rw/README.md` |
| Owner | RW 06 |
| Approver | TBD |

This document captures the discussion about extending SAPA-RT from a single-RT system to an RW 06 system. It separates confirmed inputs from recommended solutions. The Phase 0 decisions in Section 18 are resolved and binding for implementation; any new open item must be recorded there before it affects Phase 1.

---

## 1. Executive summary

RW 06 oversees a maximum of 10 RTs. Each RT will continue to use the current SAPA-RT application with its own RT identity, deployment, Google Sheet, and Apps Script backend. RW 06 needs a separate portal to:

- Read resident data (`Data_Warga`) across RTs, read-only.
- Read cash and dues data (`Iuran_Kas`) across RTs, read-only.
- Review and approve letter requests (`Pengajuan_Surat`).
- Read complaints (`Lapor_Aspirasi`) and respond when escalation is needed.

The recommended approach is a hub-and-spoke architecture. Each RT remains the system of record. A new RW 06 orchestrator and portal provide consolidated views and write only the RW-specific workflow fields back to the relevant RT. RT spreadsheets are not merged.

---

## 2. Background and current state

The current application is a static web app backed by Google Sheets and Google Apps Script. Each deployment represents one RT.

Current characteristics:

- RT identity and labels come from `config.js` (`rt`, `rw`, kelurahan, and so on).
- Admin and public pages share the same deployment.
- The backend in `Apps Script/code.gs` reads and writes sheets such as `Data_Warga`, `Iuran_Kas`, `Pengumuman`, `Kegiatan_Warga`, `Pengajuan_Surat`, and `Lapor_Aspirasi`.
- Admin writes are protected by a shared `ADMIN_TOKEN` stored in Script Properties.
- The public portal has tokenless endpoints for public announcements and status checks.
- Cloudflare Access currently protects admin HTML routes, while `/api` is bypassed so the public portal can read data.
- Each RT can have its own Google account, spreadsheet, Apps Script deployment, and Cloudflare Pages project.

The existing design works for one RT. RW 06 needs cross-RT visibility and controlled RW actions without turning one RT's spreadsheet into a shared database for all RTs.

---

## 3. Objectives

### 3.1 Business objectives

1. Give RW 06 a consolidated view of residents and RT cash across up to 10 RTs.
2. Make RW approval part of the letter-request workflow.
3. Allow RW 06 to read and respond to complaints that need RW involvement.
4. Preserve RT autonomy and keep each RT's data in its own spreadsheet.
5. Provide an auditable record of RW decisions and responses.

### 3.2 Success measures

| Measure | Target |
|---|---|
| Letter requests requiring RW approval pass through the RW workflow | 100% |
| RW decisions visible in the originating RT | Within the next sync or immediately after write-back |
| Cross-RT data isolation | No RT can read or modify another RT's data through its own portal |
| RW dashboard freshness | Within the agreed cache window, with visible last-sync time |
| Manual recap effort | Reduced by consolidated views and exports |
| Audit coverage | Every RW approval and response records actor, time, and target |

---

## 4. Scope

### 4.1 In scope

- RW 06 portal for authorized RW users.
- RT registry for up to 10 RTs.
- Read-only consolidated and per-RT views of:
  - `Data_Warga`
  - `Iuran_Kas`
- Letter approval workflow:
  - RW reviews submitted letter requests.
  - RW approves, returns for revision, or rejects with a note.
  - RT sees the RW decision.
- Complaint handling:
  - RW reads complaints.
  - RT or RW marks a complaint as needing RW attention.
  - RW adds a response and updates RW status.
  - RT and the public portal see the appropriate response.
- Audit log for RW actions.
- Access control for RW users.
- Deployment and migration of the same SAPA-RT code to each RT.

### 4.2 Out of scope for this phase

- Merging all RT data into one spreadsheet.
- Replacing Google Sheets with a relational database.
- RW-level cash ledger, unless separately approved.
- RW public portal for residents.
- Real-time chat or messaging.
- Full document management or digital signature.
- Changing RT-level resident, kas, announcement, or activity CRUD.
- Native mobile applications.
- Migration of historical data beyond the minimum needed for the new fields.

---

## 5. Stakeholders and roles

| Role | Responsibilities |
|---|---|
| RW admin | Read all RT data, approve letters, respond to complaints, view reports |
| RW viewer (optional) | Read-only access without approval rights |
| RT admin | Manage RT data, submit letters for RW approval, see RW decisions, escalate complaints |
| Warga | Submit letters and complaints, check status through the RT public portal |
| System owner | Maintain deployments, tokens, backups, and access policies |

Permission model:

| Capability | RT admin | RW viewer | RW admin |
|---|---|---|---|
| Manage own RT data | Yes | No | No |
| Read own RT data | Yes | Yes, all RTs | Yes, all RTs |
| Read other RT data | No | Yes | Yes |
| Approve letters | No | No | Yes |
| Respond to complaints | Own RT only | No | Yes |
| Manage RW users and registry | No | No | Yes |

---

## 6. Confirmed business requirements

| ID | Requirement | Priority |
|---|---|---|
| BR-01 | RW 06 supports a maximum of 10 RTs. | Must |
| BR-02 | Each RT continues to use the current SAPA-RT application. | Must |
| BR-03 | Each RT identity is configurable through `config.js`, including RT number and RW number. | Must |
| BR-04 | RW can read `Data_Warga` from every RT, read-only. | Must |
| BR-05 | RW can read `Iuran_Kas` from every RT, read-only. | Must |
| BR-06 | RW must approve letter requests before they are treated as approved. | Must |
| BR-07 | RW can read complaints and respond when escalation is needed. | Must |
| BR-08 | RW actions are attributable to a named user and recorded in an audit log. | Must |
| BR-09 | RT data remains owned by the RT and is not merged into a central master sheet. | Must |
| BR-10 | RW dashboards show data freshness and tolerate an RT being temporarily offline. | Should |
| BR-11 | RW can filter and summarize data per RT. | Must |
| BR-12 | RT admins can see RW decisions and responses in their own app. | Must |

---

## 7. Functional requirements

### 7.1 RW dashboard and reporting

| ID | Requirement | Priority |
|---|---|---|
| FR-RW-01 | Show per-RT cards with resident count, kas balance, pending letter approvals, and open complaints. | Must |
| FR-RW-02 | Show aggregate totals across RTs with a clear "sum of RTs" label. | Must |
| FR-RW-03 | Show last successful sync time and stale/error state per RT. | Must |
| FR-RW-04 | Allow filtering by RT and period where applicable. | Must |
| FR-RW-05 | Provide export or print for RW reports. | Should |
| FR-RW-06 | Link from a summary item to the RT-level detail. | Should |

### 7.2 Resident data

| ID | Requirement | Priority |
|---|---|---|
| FR-WRG-01 | List residents per RT with search and archive filtering. | Must |
| FR-WRG-02 | Show resident detail fields needed by RW. | Must |
| FR-WRG-03 | Do not provide create, edit, delete, or archive actions for RW. | Must |
| FR-WRG-04 | Show full NIK, phone, and address to RW admin; mask them for RW viewer. | Must |
| FR-WRG-05 | Handle duplicate NIKs across RTs without merging records automatically. | Must |

### 7.3 Cash and dues

| ID | Requirement | Priority |
|---|---|---|
| FR-KAS-01 | List kas transactions per RT. | Must |
| FR-KAS-02 | Compute balances using the same rules as the RT app, including `saldoAwal`, archived rows, and reversals. | Must |
| FR-KAS-03 | Do not provide create, edit, delete, or reversal actions for RW. | Must |
| FR-KAS-04 | Show per-RT and aggregate totals with the period and calculation basis. | Must |

### 7.4 Letter approval

| ID | Requirement | Priority |
|---|---|---|
| FR-SRT-01 | Show letter requests that require RW review. | Must |
| FR-SRT-02 | Show requester, letter type, purpose, RT status, and submission date. | Must |
| FR-SRT-03 | Allow RW to approve, return for revision, or reject with a note. | Must |
| FR-SRT-04 | Require a note for return and rejection. | Must |
| FR-SRT-05 | Write the decision back to the originating RT. | Must |
| FR-SRT-06 | Expose the RW decision and note in the RT admin app. | Must |
| FR-SRT-07 | Allow RT to revise and resubmit the same request after `Dikembalikan` or `Ditolak`, up to 3 negative decisions; the third closes the request for revision. | Must |
| FR-SRT-08 | Prevent a stale approval from overwriting a newer RT edit. | Must |
| FR-SRT-09 | Keep historical letters out of the new approval queue by marking them `Tidak Perlu` during migration. | Must |

### 7.5 Complaints and escalation

| ID | Requirement | Priority |
|---|---|---|
| FR-LPR-01 | Show complaints per RT and across RTs. | Must |
| FR-LPR-02 | Allow filtering for complaints that need RW attention. New complaints start as `Tidak Perlu`; RT escalates by setting `Perlu Tindak Lanjut`. | Must |
| FR-LPR-03 | Allow RW to add a response without overwriting the RT's note. | Must |
| FR-LPR-04 | Record responses in an append-only timeline. | Must |
| FR-LPR-05 | Allow each response to be toggled public or internal; default is public. | Must |
| FR-LPR-06 | Expose the latest public response in the RT public status page. | Must |
| FR-LPR-07 | RT remains the complaint owner and closes it; RW marks its part as `Selesai RW`. | Must |
| FR-LPR-08 | Preserve RT ownership unless escalation explicitly transfers it. | Should |

### 7.6 Access and administration

| ID | Requirement | Priority |
|---|---|---|
| FR-ADM-01 | Register each RT with its RT ID, name, endpoint, and active status. | Must |
| FR-ADM-02 | Store RT credentials only on the server side. | Must |
| FR-ADM-03 | Map authenticated users to `RW Admin` or optional `RW Viewer`; viewer is read-only and masked. | Must |
| FR-ADM-04 | Record an audit entry for every RW approval and response. | Must |
| FR-ADM-05 | Provide a health/version check for each RT. | Should |
| FR-ADM-06 | Support token rotation without redeploying every RT UI. | Should |
| FR-ADM-07 | Configure cache TTL, daily digest, and retention without redeploying the portal. | Must |

---

## 8. Business rules

### 8.1 Letters

| ID | Rule |
|---|---|
| BRL-01 | The existing RT `Status Pengurusan` remains unchanged. RW approval uses separate fields. |
| BRL-02 | All new letter requests start with `Rw Status = Menunggu`. Historical letters are migrated as `Tidak Perlu`. |
| BRL-03 | RW decisions are `Disetujui`, `Dikembalikan`, or `Ditolak`. |
| BRL-04 | `Dikembalikan` and `Ditolak` require a note. |
| BRL-05 | RT must not be able to overwrite RW decision fields. |
| BRL-06 | `Dikembalikan` and `Ditolak` both allow RT to revise and resubmit the same request; each negative decision increments the revision counter and requires a note. RW may issue at most 3 negative decisions per request; the third closes the request for revision, and RT must create a new request if still needed. |
| BRL-07 | Approval writes use optimistic concurrency so an outdated decision cannot overwrite a newer record. |
| BRL-08 | Historical letters are marked `Tidak Perlu` or otherwise excluded from the queue unless RW decides to review them. |

RT is blocked from setting `Selesai` and from saving `No. Surat` until `Rw Status = Disetujui`. Records marked `Tidak Perlu` are exempt and remain usable for historical letters.

### 8.2 Complaints

| ID | Rule |
|---|---|
| BRP-01 | RW responses are appended to a timeline and do not replace RT notes. |
| BRP-02 | The latest public response is copied to the existing `Catatan Tindak Lanjut` field for backward compatibility. |
| BRP-03 | Internal notes are never shown on the public portal. |
| BRP-04 | Escalation does not automatically transfer RT ownership unless approved as a separate rule. |
| BRP-05 | Every RW response records the actor and timestamp. |
| BRP-06 | Each RW response is public or internal; public is the default, internal is never shown on the public portal. |
| BRP-07 | RT remains the complaint owner and performs final closure; RW marks its part `Selesai RW`. |
| BRP-08 | New complaints start with `Rw Status = Tidak Perlu`. RT admin sets `Perlu Tindak Lanjut` to route the complaint to RW. |

### 8.3 Residents and kas

| ID | Rule |
|---|---|
| BRD-01 | RW access to `Data_Warga` and `Iuran_Kas` is read-only. |
| BRD-02 | Archived residents and archived kas rows are excluded from default totals. |
| BRD-03 | Kas balances must include each RT's `saldoAwal` and reversal logic. |
| BRD-04 | RW must not sum transactions alone and call the result a balance. |
| BRD-05 | NIK is the cross-RT reference, but a person may appear in more than one RT because of moves. |

---

## 9. Solution direction

### 9.1 Recommended architecture

Hub-and-spoke:

```text
RT 017 app + Sheet ─┐
RT 018 app + Sheet ─┼─> RW 06 orchestrator ─> RW 06 portal
RT ... app + Sheet ─┘        |
                              ├─ RT registry and server-side credentials
                              ├─ surat decision log
                              ├─ lapor response log
                              ├─ outbox and retry
                              ├─ KPI snapshots
                              └─ audit log
```

Key principles:

1. Each RT remains the system of record.
2. The RW backend is an orchestrator, not a second full database.
3. The RW browser never calls RT backends directly.
4. RW writes only RW-specific fields.
5. Detail is fetched on demand; dashboard KPIs are cached or snapshotted.
6. Every write is idempotent and retryable.

### 9.2 Components

| Component | Responsibility |
|---|---|
| RT app | Existing SAPA-RT admin and public portal per RT |
| RT backend | Existing Apps Script plus narrow RW endpoints |
| RW orchestrator | Apps Script that reads RTs, writes decisions, manages registry, cache, outbox, and audit |
| RW portal | New static app for RW admins |
| RW Pages Function | Same-origin proxy, Cloudflare Access JWT verification, server-side gateway secret |
| RW spreadsheet | Registry, users, decisions, responses, snapshots, outbox, audit |

### 9.3 Integration approach

Add these actions to each RT backend:

| Action | Purpose |
|---|---|
| `rwRead` | Read one whitelisted sheet with filters and limited fields |
| `rwSuratDecision` | Apply an RW approval, return, or rejection |
| `rwLaporNote` | Append an RW response and update RW status |
| `rwCheck` | Return health, version, and capability information |

Requirements:

- Use a dedicated `RW_TOKEN` per RT, separate from `ADMIN_TOKEN`.
- Store `RW_TOKEN` only in the RW orchestrator's Script Properties.
- Use POST for write actions, not tokens in URLs.
- Validate the target RT, record ID, allowed fields, and idempotency key.
- Use `LockService` and revision checks for updates.

### 9.4 Deployment model

- One SAPA-RT codebase, deployed once per RT with generated configuration.
- Separate Cloudflare Pages project for RW 06, for example `sapa-rw06.pages.dev`.
- RW portal is fully behind Cloudflare Access.
- Each RT retains its own admin and public portal domains.
- No shared `ADMIN_TOKEN` across RTs.

---

## 10. Data requirements

### 10.1 Additions to RT `Pengajuan_Surat`

Append before the helper `ID` column:

| Column | Purpose |
|---|---|
| `Rw Status` | `Tidak Perlu`, `Menunggu`, `Disetujui`, `Dikembalikan`, `Ditolak` |
| `Rw Catatan` | RW decision note |
| `Rw Oleh` | RW actor email or name |
| `Rw Tanggal` | Decision timestamp |
| `Rw Revisi` | Revision or round counter |

### 10.2 Additions to RT `Lapor_Aspirasi`

| Column | Purpose |
|---|---|
| `Rw Status` | `Tidak Perlu`, `Perlu Tindak Lanjut`, `Ditangani RW`, `Selesai RW`; new rows start `Tidak Perlu` |
| `Rw Petugas` | RW actor currently handling the complaint |
| `Rw Diperbarui` | Last RW update timestamp |

### 10.3 New RT sheet: `Lapor_Tindak_Lanjut`

| Column | Purpose |
|---|---|
| `ID` | Unique row ID |
| `Lapor ID` | Reference to the immutable complaint ID |
| `RT ID` | RT identifier |
| `Aktor` | Name or email |
| `Peran` | `RT` or `RW` |
| `Catatan` | Response text |
| `Status` | Status after the response |
| `Visibilitas` | `Publik` or `Internal` |
| `Waktu` | Timestamp |

### 10.4 RW orchestrator data

| Sheet | Purpose |
|---|---|
| `RT_Registry` | RT ID, name, endpoint, active flag, backend version, last sync |
| `Users` | Authenticated email, role, active flag |
| `Surat_Decision_Log` | Immutable approval history with idempotency key |
| `Lapor_Response_Log` | Central audit copy of RW responses |
| `Outbox` | Pending writes, attempts, last error, next retry |
| `KPI_Snapshot` | Daily or periodic aggregate metrics per RT |
| `Audit_Log` | Actor, action, target, timestamp, result; includes login and RW form submissions |
| `Settings` | Non-secret operational parameters such as cache TTL, digest schedule, and retention |

Credentials must not be stored in a sheet that ordinary spreadsheet viewers can read.

### 10.5 Identifiers

- Use the existing immutable helper `ID` for row identity.
- Use a composite key such as `RT017:<ID>` for cross-RT references.
- Do not renumber existing letters or complaints.
- Keep RT-level numbering; prefix only if RW reporting requires it.

---

## 11. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | RW portal is responsive and usable on desktop and mobile. |
| NFR-02 | RW dashboard loads from cache within 3 seconds under normal conditions. |
| NFR-03 | Detail views load within 5 seconds per RT under normal conditions, with a progress state. |
| NFR-04 | The system tolerates one RT being offline and shows last-known data with a clear warning. |
| NFR-05 | Cross-RT access is blocked server-side, not only in the UI. |
| NFR-06 | All RW writes are idempotent and retryable. |
| NFR-07 | All RW actions are auditable. |
| NFR-08 | Backups exist for every RT sheet and the RW spreadsheet. |
| NFR-09 | The system supports up to 10 RTs without changing the application architecture. |
| NFR-10 | Version mismatches between RT and RW are visible to administrators. |
| NFR-11 | UI text follows the existing Indonesian language and design conventions. |
| NFR-12 | No sensitive token is exposed to the browser. |

Performance thresholds should be revisited if any RT exceeds several thousand resident or kas rows, or if multiple RW admins work concurrently.

Cache TTL, digest schedule, and retention must be configurable through the RW `Settings` sheet without redeploying the portal.

---

## 12. Security and privacy

### 12.1 Access control

- Use Cloudflare Access with Google identity for RW users.
- Map authenticated email addresses to RW roles.
- Verify the Access JWT in the Pages Function.
- Do not trust browser-supplied identity or role headers.
- Keep the RW portal fully protected; no public RW routes in the MVP.

### 12.2 Data protection

- Store RT credentials only in server-side Script Properties.
- Use a dedicated `RW_TOKEN`, scoped to RW actions.
- Show full NIK, phone, and address to RW Admin. RW Viewer sees only the last 4 digits of NIK and phone, and the address is hidden; controlled by `RW_MASK_VIEWER` (default enabled).
- Log access to sensitive resident data and all exports.
- Do not copy full resident or kas data into the RW spreadsheet.
- Retain login and audit records for 12 months, and RW decision/response logs plus KPI snapshots for 24 months. Both values are configurable from 12 to 36 months. RT letters, complaints, residents, and kas remain RT-owned and follow RT retention.

### 12.3 Integrity

- Use idempotency keys for approvals and responses.
- Use optimistic concurrency for letter decisions.
- Use per-record locks where concurrent RT and RW edits are possible.
- Retry failed write-backs through an outbox with visible error states.

---

## 13. User stories

| ID | Story |
|---|---|
| US-01 | As an RW admin, I can see resident counts and kas balances per RT so I can monitor all RTs. |
| US-02 | As an RW admin, I can open a resident list for one RT without editing it. |
| US-03 | As an RW admin, I can review kas transactions and see the correct balance for each RT. |
| US-04 | As an RW admin, I can approve, return, or reject a letter with a note. |
| US-05 | As an RT admin, I can see the RW decision and note on my letter. |
| US-06 | As an RW admin, I can read a complaint and add a response. |
| US-07 | As an RT admin, I can mark a complaint as needing RW attention. |
| US-08 | As a resident, I can see the latest public response to my complaint. |
| US-09 | As a system owner, I can see which RTs are stale or failing. |
| US-10 | As an auditor, I can trace who approved or responded and when. |

---

## 14. Migration and rollout

### 14.1 RT migration

1. Back up each RT spreadsheet.
2. Deploy the updated `code.gs` with new columns and RW actions.
3. Run header-based migration to add RW fields.
4. Mark all existing letters as `Tidak Perlu`; only letters created after cutover enter the RW queue.
5. Set each RT's `RW_TOKEN`.
6. Verify the RT app still works for existing workflows.
7. Deploy to pilot RT018 first, then to the remaining RTs.

RT018 pilot prerequisites are confirmed: spreadsheet backup completed, all existing letters will be marked `Tidak Perlu`, and RT018 runs the same codebase as RT017.

### 14.2 RW setup

1. Create the RW spreadsheet and Apps Script.
2. Register all RTs with endpoints and server-side tokens.
3. Configure Cloudflare Access and RW users.
4. Deploy the RW portal and Pages Function.
5. Test read, approval, response, retry, and audit flows.
6. Train RW admins.
7. Run a pilot with RT 017 and one additional RT before full rollout.

### 14.3 Rollback

- Keep the previous RT deployment available.
- New columns are additive and can remain unused if the RW feature is disabled.
- Disable RW actions without rolling back RT data.
- Restore from spreadsheet backups if migration fails.

---

## 15. Delivery phases and indicative effort

| Phase | Scope | Estimate |
|---|---|---|
| 0 | Confirm decisions (done 25 Oct 2026), inventory 10 RTs, finalize rules | 2-4 days |
| 1 | RT schema, `RW_TOKEN`, read/decision/response endpoints | 1.5-2 weeks — **implemented** (backend v35, v36 adds `saldoAwal`, v37 repairs RW status) |
| 2 | RT UI for RW status, pending filter, and complaint timeline | 1-1.5 weeks — **status/filter/panel implemented**; timeline history view pending |
| 3 | RW orchestrator: registry, fan-out, cache, outbox, audit | 2 weeks — **implemented** (`rw-orchestrator-v1-2026-10-25`) |
| 4 | RW portal: dashboard, residents, kas, surat, complaints | 2-3 weeks — **read-only milestone implemented** (`rw/`); decisions/responses next |
| 5 | Access control, pilot, rollout, documentation | 1-2 weeks |

Indicative totals:

- Minimum viable workflow: 5-7 weeks for one developer familiar with the codebase.
- Full rollout with reporting and polish: 8-10 weeks.

Estimates exclude organizational waiting time, Google verification, and content preparation.

The Phase 0 decision gate is closed. Phase 1 (schema migration, `RW_TOKEN`, RW endpoints, approval gate), the RT-side admin UI (RW badges, filters, decision panel, resubmit, complaint escalation), the Phase 3 orchestrator, and the Phase 4 read-only portal milestone are implemented. RT code is at `publik-v37-2026-10-26`; the orchestrator is `rw-orchestrator-v1-2026-10-25`. The portal lives in `rw/` with a Cloudflare Access gateway and read pages for dashboard, residents, kas, letters, and complaints; decision/response writes, user management, registry, settings, outbox, and audit pages remain for the next milestone. Only 2 of the maximum 10 RTs are currently deployed.

---

## 16. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Cross-RT data leakage | High | Server-side tenant scoping, least-privilege tokens, audits, tests |
| RT and RW both edit a letter | Medium | Separate RW fields, revision checks, locks |
| Duplicate resident records after moves | Medium | Report by RT, deduplicate by NIK only for counts, define conflict handling |
| Kas totals calculated differently | High | Reuse RT balance rules, include `saldoAwal`, reversals, and archives |
| Google Sheets concurrency and quotas | Medium | Narrow APIs, caching, retries, low write volume |
| RT backend offline | Medium | Last-known cache, stale indicators, outbox retries |
| Token exposure | High | Server-side credentials, separate RW token, POST writes |
| Code drift across 10 deployments | Medium | One codebase, generated configuration, version checks |
| Unclear RT vs RW authority | Medium | Approve workflow rules before build |
| Historical data floods approval queue | Low | Mark old records `Tidak Perlu` |
| Audit log grows unbounded | Low | Define retention and archive policy |

---

## 17. Assumptions

1. RW 06 has no more than 10 RTs.
2. Each RT has or will have its own spreadsheet and Apps Script deployment.
3. RT admins continue to use their existing SAPA-RT app.
4. RW users access the RW portal through Cloudflare Access.
5. The RW portal is not public in the MVP.
6. Google Sheets remains the system of record for this phase.
7. RW does not need to edit resident or kas data.
8. RW approval applies to new letters; historical letters are handled by an agreed migration rule.
9. Internet connectivity is required for RW and RT administrators.
10. The RW portal uses the existing branding and design language.

---

## 18. Decisions

Resolved on 25 October 2026. These decisions are binding for Phase 1.

| ID | Decision | Status |
|---|---|---|
| OD-01 | RW approval is required before RT can set `Selesai` and save `No. Surat`. Records marked `Tidak Perlu` are exempt. | Resolved |
| OD-02 | RT may revise and resubmit the same request after `Dikembalikan` or `Ditolak`. Each negative decision counts toward a maximum of 3; the third closes the request for revision. | Resolved |
| OD-03 | Each RW complaint response has a public/internal toggle. Default is public; internal responses are never shown to residents. | Resolved |
| OD-04 | RT remains the complaint owner and closes it; RW marks its part as `Selesai RW`. | Resolved |
| OD-05 | Roles are `RW Admin` and optional `RW Viewer`. | Resolved |
| OD-06 | RW Admin sees full NIK, phone, and address. RW Viewer sees only the last 4 digits of NIK and phone, and the address is hidden. | Resolved |
| OD-07 | Dashboard cache is configurable, default 10 minutes. Any detail view always fetches live data. | Resolved |
| OD-08 | Historical letters are marked `Tidak Perlu` during migration and excluded from the approval queue. | Resolved |
| OD-09 | Daily digest is optional and parameterized by enablement, send hour, recipients, and timezone. Default is disabled. | Resolved |
| OD-10 | Retain login and audit records for 12 months. Retain RW decision/response logs and KPI snapshots for 24 months. Both values are configurable from 12 to 36 months. RT operational data remains RT-owned. | Resolved |
| OD-11 | RW-level kas ledger is out of scope for this phase. | Resolved |
| OD-12 | New complaints start as `Tidak Perlu`; RT admin routes to RW by setting `Perlu Tindak Lanjut`. | Resolved |

### 18.1 Operational parameters

Store non-secret values in the RW `Settings` sheet. Store credentials only in Script Properties.

| Parameter | Default | Notes |
|---|---|---|
| `RW_CACHE_TTL_MINUTES` | 10 | 1-60 minutes; per-RT override allowed; detail views bypass the cache |
| `RW_SURAT_MAX_ROUNDS` | 3 | Maximum returns before RW must approve or reject |
| `RW_LAPOR_DEFAULT_VISIBILITY` | `Publik` | Per-response toggle; `Internal` is never public |
| `RW_MASK_VIEWER` | `true` | RW Viewer sees NIK/phone last 4 digits; address is hidden |
| `RW_DIGEST_ENABLED` | `false` | Enable during pilot when needed |
| `RW_DIGEST_HOUR` | `8` | 0-23 in the configured timezone |
| `RW_DIGEST_RECIPIENTS` | empty | Comma-separated RW emails; empty means all active RW Admins |
| `RW_TIMEZONE` | `Asia/Jakarta` | Used by digest and audit timestamps |
| `RW_AUDIT_RETENTION_MONTHS` | `12` | Login and audit records; allowed range 12-36 |
| `RW_RETENTION_MONTHS` | `24` | RW decisions/responses and snapshots; allowed range 12-36 |

---

## 19. Acceptance criteria

### 19.1 Read access

- RW admin can select any of the 10 RTs and view its residents.
- RW admin can view kas transactions and a balance that matches the RT app.
- RW cannot edit, delete, or archive resident or kas records.
- An RT admin cannot use RW endpoints or view another RT's data.

### 19.2 Letter approval

- Every new letter appears in the RW queue.
- RW can approve it with a note, and the RT app shows the decision.
- RW can return it with a required note, and RT can revise and resubmit.
- RT cannot set `Selesai` or save `No. Surat` before approval; `Tidak Perlu` is exempt.
- RW can return or reject the same request, and RT can revise and resubmit it.
- RW cannot issue more than 3 negative decisions; the third closes the request for revision.
- A stale approval is rejected when the RT record changed.
- Approval and rejection are recorded in the audit log.
- Historical letters are excluded from the queue as `Tidak Perlu` by migration rule.

### 19.3 Complaint handling

- RW can read complaints and filter for those needing attention.
- RW can append a response without overwriting the RT note.
- Each response can be toggled public or internal; public is the default.
- Public responses appear in the RT public status page.
- Internal notes never appear publicly.
- RT remains owner and closes the complaint; RW marks `Selesai RW`.
- The response timeline and actor are recorded.

### 19.4 Operations

- RW dashboard shows last sync and stale RTs.
- A failed RT write is queued and retried.
- Tokens are not visible in the browser.
- All RW pages require Cloudflare Access authentication.
- RW Admin sees full sensitive fields; RW Viewer sees only the last 4 digits of NIK/phone and no address.
- New complaints start as `Tidak Perlu`; RT sets `Perlu Tindak Lanjut` to route to RW.
- Cache TTL, digest, and retention can be changed without redeploying the portal.
- Login/audit records are retained for 12 months; decision/response logs and snapshots for 24 months.
- Backups and restore steps are documented.

---

## 20. Glossary

| Term | Meaning |
|---|---|
| RT | Rukun Tetangga, neighborhood unit |
| RW | Rukun Warga, group of RTs |
| SAPA-RT | Existing RT administration and service application |
| Orchestrator | RW backend that reads RTs and writes RW-specific updates |
| Outbox | Queue of writes waiting to be retried |
| Idempotency key | Unique key that prevents duplicate writes on retry |
| RW status | Separate workflow state owned by RW |
| Hub-and-spoke | Architecture where RTs remain independent and an RW hub aggregates them |

---

## 21. Revision history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 24 October 2026 | Discussion draft | Initial BRD based on RW 06 requirements and architecture discussion |
| 0.2 | 25 October 2026 | Discussion | Resolved OD-01 to OD-11; added operational parameters, approval gate, 3-return limit, visibility toggle, masking, digest, and 24-month retention |
| 0.3 | 25 October 2026 | Discussion | All new letters require approval; rejection permits same-request revision within 3 negative decisions; complaints start `Tidak Perlu`; viewer masking narrowed; login/audit retention set to 12 months; RT018 confirmed as pilot |
| 0.4 | 25 October 2026 | Implementation | Phase 1 delivered: backend v35 (`ensureRwSchema`, `RW_TOKEN`, RW endpoints, approval gate, escalation/resubmit) + RT admin UI (RW badges, filters, panels). Pilot branch `rt018` merged. RW portal remains Phase 4 |
| 0.5 | 25 October 2026 | Implementation | Phase 3 orchestrator delivered: registry, users, fan-out dashboard with cache/stale fallback, per-RT reads with viewer masking, idempotent surat/lapor writes via outbox, retry triggers, audit, retention. RT backend v36 adds `saldoAwal` to `rwRead`; v37 repairs invalid `Rw Status`, escalation timestamps, and shows No. Pengaduan in the RT panel. Portal remains Phase 4 |
| 0.6 | 26 October 2026 | Implementation | RT backend v37 repairs invalid `Rw Status` (self-heal), writes escalation timestamps to `Rw Diperbarui`, and shows No. Pengaduan in the RT RW panel. Portal remains Phase 4 |
| 0.7 | 26 October 2026 | Implementation | Phase 4 read-only portal milestone delivered: Cloudflare Pages gateway with Access JWT verification and server-side gateway secret, session/role display, aggregate dashboard, and read pages for residents, kas, letters, and complaints (detail drawer + complaint timeline). Viewer masking is enforced by the orchestrator. Local mock preview and harnesses added. Decision/response writes and admin pages remain |
