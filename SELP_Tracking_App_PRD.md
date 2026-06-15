# Product Requirements Document
## SELP (Self-Expression and Leadership Program) Tracking Application

| | |
|---|---|
| **Document status** | Draft v1.0 |
| **Date** | June 15, 2026 |
| **Owner** | _[Product owner]_ |
| **Stack** | React (web) · Node.js (API) · PostgreSQL (data) |
| **Reference data** | `SELP_projects_Mar8-2026.xlsx` (12-column community-project intake sheet, 38 participants) |

---

## 1. Overview

The Self-Expression and Leadership Program (SELP) is a community-leadership program in which **participants** design and deliver real-world community projects, supported by a coaching structure of **Leaders, a Program Coach, Head Coaches, and Coaches**. Today this is tracked in spreadsheets (e.g. the attached `SELP_projects_Mar8-2026.xlsx`), which makes group management, progress tracking, and access control manual and error-prone, and offers no protection for participant personal data.

This application provides a single, role-secured system of record for running a SELP cohort end to end: standing up a program, onboarding participants, organizing them into coaching groups, capturing each participant's community project (including imported data), and tracking project progress with comments, photos, and video links — all behind strict role-based access control and with personal data encrypted at rest.

A defining constraint: **participants are subjects of the data, not users of the platform.** Only the coaching team logs in.

---

## 2. Goals and non-goals

### 2.1 Goals
- Let an authorized organizer create a SELP program and assign the coaching team (Leaders, Program Coach, Head Coaches, Coaches) as platform users.
- Onboard participants quickly with a minimal required dataset (Name + Phone), then enrich their profile over time.
- Organize participants into numbered coaching groups and enforce that a coach sees only their own group(s), while Leaders and Head Coaches see all groups.
- Capture each participant's community project, including bulk import from the existing Excel format, and allow every field to be edited later.
- Track project progress over the program with progress updates, comments, photo uploads, and video links.
- Make all of the above searchable by participant name and by coach name.
- Protect personally identifiable information (PII): store it encrypted, and show clear (decrypted) data only to authorized users.

### 2.2 Non-goals (this release)
- **No participant-facing access.** Participants do not have accounts, logins, or any view into the platform. (FR-10)
- No public website, donor portal, or external sharing of project pages.
- No payments, fundraising, or financial transactions.
- No native mobile apps (the React web app should be responsive, but native apps are out of scope).
- No automated SMS/email to participants in v1 (phone numbers are stored as profile data, not used for outbound messaging yet).

---

## 3. User roles and personas

The platform has internal users only. All roles below are platform users; the participant is **not** a user.

| Role | Description | Typical scope |
|---|---|---|
| **Leader** | Program leader(s) running the SELP cohort. Full visibility and administration. | All programs they own / all groups |
| **Program Coach** | Coaches the leaders/coaching team; oversees the whole cohort. | All groups in the program |
| **Head Coach** | Oversees multiple coaching groups within a program. | All groups in their program |
| **Coach** | Coaches a single group (or a small set of groups) of participants. | Only their assigned group(s) |
| **Participant** | A program enrollee delivering a community project. **No platform access.** | None — subject of records only |

> **Assumption A1:** A single person may hold a role in more than one program; permissions are evaluated per program. State if a person should instead be limited to one program.
> **Assumption A2:** Leaders also act as program administrators (they create programs and assign users). If a separate "Admin/Org Owner" super-role is required, it can be added; flag this.

---

## 4. Functional requirements

Each requirement traces to the original request items (R1–R10).

### FR-1 — Create a program and assign the coaching team *(R1)*
- An authorized user (Leader/Admin) can create a new SELP Program with at least: program name, location, start date, end date, status (Planned / Active / Completed).
- The creator can assign existing users — or invite new users by email — to the program with one of the roles: Leader, Program Coach, Head Coach, Coach.
- Role assignments are scoped to that program.
- **Acceptance:** A new program appears in the creator's program list; assigned users gain access per their role on next login; an unassigned user cannot see the program.

### FR-2 — Onboard participants *(R2)*
- A participant can be created with **only Name and Phone Number required**.
- Additional profile fields are optional and can be added later (see FR-5):
  - Family
  - "What is important for them"
  - "Why did they join SELP"
  - "What do they want to accomplish"
- A participant belongs to exactly one program and (optionally, at first) one group.
- **Acceptance:** Saving a participant with only first/last name + phone succeeds; the record is editable afterward to add profile details.

### FR-3 — Group management and group-scoped visibility *(R3)*
- Users with sufficient permission can **add, remove (delete), and move** participants between coaching groups.
- Groups are identified by a **group number** within a program; one coach (or coaches) is assigned to a group.
- **Visibility rule:**
  - **Coach** sees only the participants (and their projects) in their assigned group(s).
  - **Leader, Program Coach, Head Coach** see all groups in the program.
- Moving a participant immediately changes which coach can see them.
- **Acceptance:** Logged in as a coach, only that coach's group(s) are listed; after a Leader moves a participant to a different group, the original coach no longer sees them and the new coach does.

> **Assumption A3:** "Delete a participant from a group" means unassign/move (the participant record is retained for the program), not hard-delete the person. Hard delete is a separate, restricted action (Leader only) and is soft-delete + audit-logged for PII compliance.

### FR-4 — Community project + Excel import *(R4)*
- Each participant has one Community Project with the fields below (mapped 1:1 from the intake spreadsheet — see §6).
- Projects can be **imported in bulk from the attached Excel format**. The importer:
  - Accepts `.xlsx` matching the known 12-column layout.
  - Matches each row to a participant (see matching rule below), creating the participant if needed.
  - Reports a preview (rows to create / update / skipped) before committing.
- **Participant matching for import — Assumption A4:** Rows are matched to existing participants by First Name + Last Name within the selected program. Because the spreadsheet has no phone number, imported-only participants will have a blank phone until edited. Recommended: import into a chosen program + group, then fill phone numbers. Confirm if a different match key (e.g. phone) is preferred.
- **Acceptance:** Uploading `SELP_projects_Mar8-2026.xlsx` into a program produces 38 participants with their project fields populated and a reviewable import summary.

### FR-5 — All fields editable later *(R5)*
- Every participant profile field and every community-project field can be edited after creation/import, by any user with edit rights over that participant's group.
- Edits are timestamped and attributed to the editing user (for audit).
- **Acceptance:** Any field changed in the UI persists and shows last-edited-by / last-edited-at.

### FR-6 — Project tracking: progress, comments, media *(R6)*
For each project, authorized users can add, over time:
- **Progress updates** — a status/percentage or milestone note with a date.
- **Comments** — free-text notes, threaded by update or on the project.
- **Photo uploads** — image files attached to a progress update or the project.
- **Video links** — URLs (e.g. YouTube/Drive links); not file uploads.
- Each entry records author and timestamp; entries form a chronological activity log.
- **Acceptance:** A coach can post a progress update with a comment, attach a photo, and paste a video link; all appear in the project's timeline with author and time.

> **Assumption A5:** Photos are uploaded files (stored in object storage); videos are links only (no video file hosting in v1). Confirm if video file upload is needed.

### FR-7 — Search by participant and coach name *(R7)*
- A global search returns participants and projects matching a **participant name** or a **coach name**.
- Results respect the requesting user's visibility scope (a coach searching only finds within their own group(s)).
- **Acceptance:** Searching a participant's name jumps to their profile/project; searching a coach's name lists that coach's groups/participants (subject to permissions).

### FR-8 / FR-9 — PII security: encrypted storage, clear data only for valid users *(R8, R9)*
- PII fields (at minimum: participant name, phone number, family details, and free-text profile answers) are **encrypted at rest**.
- Data is stored as ciphertext; it is **decrypted and shown in the clear only to authenticated, authorized users** within their visibility scope.
- See §7 for the full security design.
- **Acceptance:** Raw database inspection of PII columns shows ciphertext, not plaintext; an authorized user sees readable values in the app; an unauthorized/unauthenticated request never receives plaintext PII.

### FR-10 — No participant access *(R10)*
- The platform exposes no participant login, registration, or self-service view.
- Participants exist only as records managed by the coaching team.
- **Acceptance:** There is no authentication path that resolves to a "participant" identity; all sessions belong to Leader/Program Coach/Head Coach/Coach.

---

## 5. Permissions matrix

| Action | Leader | Program Coach | Head Coach | Coach |
|---|:---:|:---:|:---:|:---:|
| Create program | ✅ | — | — | — |
| Assign / invite users to program | ✅ | ✅ | — | — |
| Create / edit groups, assign coach to group | ✅ | ✅ | ✅ | — |
| Add / move / remove participants across groups | ✅ | ✅ | ✅ | Own group only* |
| View all groups | ✅ | ✅ | ✅ | — |
| View own group only | — | — | — | ✅ |
| Onboard / edit participant profile | ✅ | ✅ | ✅ | ✅ (own group) |
| Import projects from Excel | ✅ | ✅ | ✅ | — |
| Add progress / comments / photos / video links | ✅ | ✅ | ✅ | ✅ (own group) |
| Hard-delete (soft-delete) a participant | ✅ | — | — | — |
| View audit log | ✅ | ✅ | — | — |

\* Whether a Coach can move participants out of their own group is configurable; default is **no** (only Head Coach and above reassign across groups). Confirm preference.

---

## 6. Data model

### 6.1 Core entities

```
Program        (id, name, location, start_date, end_date, status, created_by, created_at)
User           (id, full_name, email, phone, status, created_at)            -- coaching team only
ProgramRole    (id, program_id, user_id, role[Leader|ProgramCoach|HeadCoach|Coach])
Group          (id, program_id, group_number, name)
GroupCoach     (id, group_id, user_id)                                       -- coach(es) for a group
Participant    (id, program_id, group_id?, first_name*, last_name*, phone*,
                family*, whats_important*, why_joined*, what_accomplish*,
                is_deleted, created_at, updated_at)                          -- * = encrypted PII
CommunityProject (id, participant_id, <project fields below>, updated_at)
ProjectUpdate  (id, project_id, author_user_id, body, progress_status, created_at)
Comment        (id, project_id|update_id, author_user_id, body, created_at)
MediaAsset     (id, project_id|update_id, type[photo|video_link],
                storage_key|url, uploaded_by, created_at)
AuditLog       (id, actor_user_id, action, entity, entity_id, before, after, created_at)
```

### 6.2 Community Project fields → Excel column mapping (R4)

| Spreadsheet column | Project field |
|---|---|
| First Name | `participant.first_name` |
| Last Name | `participant.last_name` |
| Who I am is the possibility of: | `who_i_am_possibility` |
| My target community is: | `target_community` |
| The possibility of my project is: | `project_possibility` |
| My community project is: | `project_description` |
| The name of my project is: | `project_name` |
| The specific measurable results … by the end of the program are: | `smr_end_of_program` |
| MILESTONE by Workday 3 … results I will produce … | `milestone_workday3` |
| MILESTONE by Workday 2 … results I will produce … | `milestone_workday2` |
| Other resources I will contact to promote my project are: | `promotion_resources` |
| OTHER RESULTS: … people will register in the Landmark Forum: | `forum_registrations` |

All project text fields are long free-text and must be editable post-import (FR-5).

---

## 7. Security and PII requirements (R8, R9)

### 7.1 Encryption
- **At rest — storage layer:** Enable PostgreSQL encryption at rest (e.g. encrypted volumes / managed-DB TDE) as a baseline.
- **At rest — application-layer field encryption:** Encrypt designated PII columns (name, phone, family, and the free-text profile answers) in the application/service layer before they reach the database, using **envelope encryption** with a Key Management Service (KMS): a KMS-managed master key wraps per-record/per-tenant data keys. Result: PII columns are ciphertext in the DB; a DB dump or backup leak does not expose plaintext.
- **In transit:** TLS for all client↔API and API↔DB traffic.

### 7.2 "Only valid users see clear data"
- Decryption happens **server-side only**, after the request passes authentication and authorization (role + group scope). The client never receives encryption keys.
- The API returns plaintext PII **only** for records within the requester's visibility scope; otherwise it returns nothing (not a masked value the client could mishandle).
- **Optional masking:** For list views, phone numbers may be masked (e.g. last 4 digits) with full reveal on the detail view, to limit incidental exposure. Confirm if desired.

### 7.3 Access control
- Role-based access control (RBAC) evaluated **per program and per group** (see §5).
- Coaches are scoped to their group(s); Leaders/Program/Head Coaches to the whole program.
- No participant authentication exists (FR-10).

### 7.4 Auditing and data lifecycle
- All create/edit/delete actions on PII and all PII reads of sensitive fields are written to an immutable **audit log** (actor, action, entity, timestamp).
- Deletes are **soft-deletes** with a retention policy; hard purge is a restricted Leader-only operation, supporting data-subject deletion requests.
- Secrets and keys are never stored in source; rotation policy defined for data keys and master key.

### 7.5 Recommended baseline
- Strong password policy + optional MFA for all users; session timeouts.
- Principle of least privilege for service DB credentials.
- Encrypted backups; periodic restore tests.

---

## 8. Non-functional requirements
- **Responsiveness:** Web UI usable on desktop and tablet; readable on mobile browsers.
- **Performance:** List/search results under ~1s for a typical cohort (tens–low hundreds of participants).
- **Scale target:** Designed for many concurrent programs of ~40–200 participants each (the sample cohort is 38).
- **Reliability:** Daily encrypted backups; defined RPO/RTO.
- **Auditability & compliance:** Full audit trail; data-handling aligned to applicable privacy regulations (e.g. India DPDP / GDPR-style data-subject rights).
- **Accessibility:** Target WCAG 2.1 AA for the web UI.

---

## 9. Technical architecture

- **Frontend:** React single-page app (responsive). Talks to the API over HTTPS; holds no encryption keys; renders only data the API returns.
- **Backend:** Node.js REST (or GraphQL) API. Enforces authN/authZ, performs server-side encryption/decryption via KMS, writes audit logs, and runs the Excel import pipeline.
- **Database:** PostgreSQL. PII columns store ciphertext; relational integrity for programs, groups, participants, projects, updates, and media metadata.
- **Object storage:** Photos stored in object storage (e.g. S3-compatible) with private access; DB holds only references/keys. Video links are URLs.
- **Key management:** KMS for master key; envelope-encrypted data keys.
- **Import service:** Parses `.xlsx`, maps columns (§6.2), previews, then commits with per-row create/update/skip handling.

```
[React SPA] --HTTPS--> [Node API: authN/Z, encrypt/decrypt, audit, import]
                              |                         |
                         [PostgreSQL]            [Object storage]
                              |
                            [KMS]
```

---

## 10. Key user flows
1. **Stand up a cohort:** Leader creates program → invites/assigns Program Coach, Head Coaches, Coaches → creates groups → assigns a coach to each group.
2. **Onboard participants:** Add participant (Name + Phone) → assign to a group → later enrich profile (family, motivations, goals).
3. **Bulk import projects:** Upload `SELP_projects_Mar8-2026.xlsx` → choose target program/group → preview matches → commit → fill missing phone numbers.
4. **Track a project:** Coach opens a participant in their group → posts progress + comment → uploads photos → adds a video link → entries appear in the timeline.
5. **Find someone fast:** Any user searches a participant or coach name (scoped to their permissions) → opens the record.

---

## 11. Open questions / assumptions to confirm
- **A1** Can one person hold roles across multiple programs? (Assumed yes.)
- **A2** Is a dedicated Admin/Org-Owner super-role needed beyond Leader? (Assumed no.)
- **A3** Does "delete participant from group" mean unassign/move vs. remove the person entirely? (Assumed move; hard delete is Leader-only soft-delete.)
- **A4** Import match key — by name within a program (assumed), or by phone? Phone is absent from the sheet.
- **A5** Video = links only (assumed), or also uploaded video files?
- **A6** Should phone numbers be masked in list views with reveal on detail?
- **A7** Can a Coach reassign participants out of their own group? (Assumed no.)
- **A8** Is MFA required for all roles, or optional?

---

## 12. Suggested phasing
- **Phase 1 (MVP):** Programs + user/role assignment, participant onboarding (Name+Phone), groups & group-scoped visibility, community project CRUD, Excel import, search, PII encryption + RBAC, no participant access.
- **Phase 2:** Progress/comments/photos/video timeline, audit-log viewer, phone masking, import preview refinements.
- **Phase 3:** MFA, advanced reporting/dashboards (e.g. milestone roll-ups across groups), data-subject deletion workflows.
