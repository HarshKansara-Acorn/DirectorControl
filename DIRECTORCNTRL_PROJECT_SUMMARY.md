# DirectorControl — Full Project Summary

**Project:** DirectorControl Executive Management Dashboard
**Client:** Acorn Universal Consultancy
**Repository:** HarshKansara-Acorn / DirectorControl (GitHub)
**Document Date:** April 2026
**Current Status:** Phase 1 & 2 Complete — Live on Azure SQL

---

## 1. Project Overview

DirectorControl is a role-based web productivity dashboard built for **Acorn Universal Consultancy**. It serves 3 company directors and their shared Personal Assistant (PA). The PA manages all information centrally from one interface; directors each have a focused, limited-access portal showing only what is relevant to them.

### Business Problem Solved

- Directors were receiving updates via email and WhatsApp with no central tracking
- The PA had no structured way to manage reminders, approvals, and tasks across 3 directors simultaneously
- No visibility into upcoming travel, document expiry dates, or bill due dates
- No shared calendar or meeting coordination tool

### Solution Delivered

A role-based web portal where:
- **PA (Admin)** manages all 3 directors from one interface with a director switcher dropdown
- **Directors** each have a focused portal showing only their own tasks, reminders, and approvals
- All data persists in Azure SQL Server (no mock data in production)
- Microsoft Teams integration available for calendar and task sync

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React JS | 18.3.1 |
| Routing | React Router DOM | 6.24.0 |
| Drag & Drop | @hello-pangea/dnd | 16.6.0 |
| HTTP Client | Axios | 1.7.2 |
| Date Utilities | date-fns | 3.6.0 |
| Icons | Lucide React | 0.395.0 |
| Build Tool | react-scripts (CRA) | 5.0.1 |
| Backend | Node.js + Express | 4.19.2 |
| Authentication | JWT (jsonwebtoken) | 9.0.2 |
| Password Hashing | bcryptjs | 2.4.3 |
| Session | express-session | 1.18.0 |
| Unique IDs | uuid | 9.0.1 |
| Database Driver | mssql | 11.0.1 |
| Database | MS SQL Server (Azure) | — |
| Query Style | Raw parameterised SQL | — |
| Styling | CSS Modules + CSS Variables | — |
| Dev Server | nodemon | 3.1.0 |
| Version Control | Git + GitHub | — |

### Infrastructure

| Item | Value |
|---|---|
| Azure SQL Server | bcdwsqlserver.database.windows.net |
| Database Name | BCDWsqldatabase |
| DB User | bcsqlsvr |
| Frontend Dev Port | localhost:3000 |
| Backend Dev Port | localhost:5000 |
| Table Prefix | DC_ (to avoid conflicts in shared DB) |

---

## 3. User Roles & Access Matrix

| Feature | PA (Admin) | Director |
|---|---|---|
| Login URL | `/login` → `/dashboard` | `/login` → `/director/dashboard` |
| See all 3 directors | ✅ Director switcher dropdown | ❌ Own data only |
| Create / edit all records | ✅ Full CRUD | ❌ Read + status updates only |
| Approve / reject requests | ❌ | ✅ |
| Broadcast to multiple directors | ✅ | ❌ |
| Dashboard tab | ✅ | ✅ (director version) |
| Tasks tab (Kanban) | ✅ | ✅ (own tasks only) |
| Travel tab | ✅ | ❌ |
| Documents tab | ✅ | ❌ |
| Bills tab | ✅ | ❌ |
| Assets tab | ✅ | ❌ |
| Events tab | ✅ | ❌ |
| Teams tab | ✅ | ❌ |
| Reminders tab | ❌ | ✅ |
| Approvals tab | ❌ | ✅ |
| Profile page | ✅ | ✅ |
| Settings page | ✅ | ✅ |

### Login Credentials

| User | Email | Password |
|---|---|---|
| PA (Admin) | harsh.kansara@acornuniversalconsultancy.com | Admin@123 |
| Director 1 | director1@acornuniversalconsultancy.com | Director@123 |
| Director 2 | director2@acornuniversalconsultancy.com | Director@123 |
| Director 3 | director3@acornuniversalconsultancy.com | Director@123 |

> Passwords are auto-synced on every backend startup via bcrypt hash update.

---

## 4. Feature Inventory

### 4.1 PA Admin Portal (`/dashboard`)

#### Dashboard Tab
- Time-of-day greeting with today's date
- Summary bar: meetings today, unread emails, pending approvals
- 6 widget cards:
  - **Today's Meetings** — time, location, duration; PA can add/delete
  - **Urgent Emails** — unread count, mark-as-read; PA can add/delete
  - **Key Reminders** — priority colour coding (High/Medium/Low); PA can add/delete
  - **Pending Approvals** — Approve/Reject buttons inline; PA can add/delete
  - **Travel Reminders** — upcoming trips with status; PA can add/delete
  - **Task Summary** — overdue / due today / completed counts (auto-calculated)

#### Tasks Tab
- Kanban board with 4 columns: To Do → In Progress → Review → Done
- Drag-and-drop between columns (optimistic UI update + server sync)
- Priority filter: All / High / Medium / Low
- Task cards show: title, description, tags, priority chip, due date
- Add Task modal with director multi-select (broadcast to multiple directors)
- Task detail modal: view full details, update status, delete

#### Travel Tab
- Card grid with status filter: Upcoming / Ongoing / Completed / Cancelled
- Add / Edit / Delete travel records
- Fields: destination, purpose, departure date, return date, notes, status

#### Documents Tab
- Card grid with category filter: Finance / Legal / HR / IT / Admin
- Expiry warning — red highlight when ≤ 30 days to expiry
- File type icons: PDF, DOCX, XLSX, PPTX
- Add / Edit / Delete documents
- Fields: title, description, category, file name, file size, file type, expiry date, tags

#### Bills Tab
- Table view with summary stats: pending amount, overdue amount, total count
- Status filter: Pending / Paid / Overdue / Cancelled
- Mark as Paid button with one click
- Multi-currency support: ₹, $, £, €
- Add / Edit / Delete bills
- Fields: title, vendor, category, amount, currency, due date, invoice number, notes

#### Assets Tab
- Card grid with category + status filters
- Total asset value summary card
- Warranty expiry alerts — red highlight when ≤ 30 days
- Toggle maintenance status
- Add / Edit / Delete assets
- Fields: name, description, category, serial number, purchase date, purchase value, current value, location, warranty expiry, assigned to

#### Events Tab
- Timeline view grouped by month
- Event type icons: Meeting, Conference, Presentation, Company, Personal
- Priority badges (High / Medium / Low)
- Today's events highlighted in blue
- Shared events visible to multiple directors simultaneously
- Add / Edit / Delete events
- Fields: title, description, type, directors (multi-select), start/end date, start/end time, location, attendees, all-day toggle, priority, notes

#### Teams Tab
- Microsoft Teams OAuth2 integration via Azure AD
- Per-director connection status display
- Status bar: presence indicator, today's meetings count, To Do tasks count, OOO status
- Out-of-office banner with message when active
- Calendar tab: all events with filter (All / Teams Meetings / Today)
- Today's Schedule tab: timeline view with Join Meeting buttons
- To Do Tasks tab: grouped by list, overdue items highlighted
- Sync to Events button: imports Teams calendar events into the Events tab
- Setup guide for Azure AD app registration

#### Profile Page
- Avatar with colour picker (10 preset colours) + custom initials (max 2 chars)
- First name, last name, email (read-only), phone number
- Job title, department, location / office
- Bio / About Me (500 character limit with counter)
- All data saved to Azure SQL via `/api/users/me/profile`

#### Settings Page
- **Password** — change with strength meter + 4 validation rules (length, uppercase, number, special char)
- **Two-Factor Authentication** — enable/disable toggle (saved to DB)
- **Active Sessions** — viewer showing device, IP, last active time
- **Linked Accounts** — Microsoft/Teams, Google, Outlook connect buttons
- **Account Actions** — Sign out everywhere, Deactivate account, Delete account (all require password confirmation)

---

### 4.2 Director Portal (`/director/*`)

#### Director Dashboard
- 4 stat cards: Overdue Tasks, Due Today, Pending Tasks, Pending Approvals (all clickable)
- Pending Approvals section with Approve / Reject buttons
- Key Reminders with overdue highlighting
- My Tasks table showing pending tasks with priority, status, due date

#### My Tasks Tab
- Full Kanban board (same UX as admin but filtered to own tasks only)
- Drag-and-drop status updates
- Priority filter
- Task detail modal with status update capability

#### Reminders Tab
- All reminders set by the PA for this director
- Filter: All / Active / Overdue
- Days-until-due display
- Overdue items highlighted in red

#### Approvals Tab
- Full approval history with tabs: Pending / Approved / Rejected / All
- One-click Approve / Reject with loading state
- Approval details: type, from, description, due date, remarks

---

### 4.3 Cross-Cutting Features

#### Notification Bell
Aggregates notifications automatically from all modules:
- Pending approvals
- Unread urgent emails
- Overdue bills
- Reminders due within 7 days
- Documents expiring within 30 days
- Asset warranties expiring within 30 days
- Events today or tomorrow
- Teams meetings today (when connected)
- Overdue Teams To Do tasks (when connected)
- Out-of-office active (when connected)

Grouped into Urgent / Important / Info priority tiers. Each notification is clickable and navigates to the relevant tab. Auto-refreshes every 2 minutes.

#### Global Search (Ctrl+K)
Searches across all 10 modules simultaneously:
- Tasks, Events, Meetings, Approvals, Reminders, Emails, Travel, Documents, Bills, Assets
- Results grouped by module with match highlighting
- Keyboard navigation: ↑↓ arrows to move, Enter to open, Esc to close
- 220ms debounce to avoid excessive API calls

#### Light / Dark / System Theme
- Three-way toggle: Sun (Light) / Moon (Dark) / Monitor (System)
- Implemented via CSS custom properties — instant switch, zero JS overhead
- Persists to localStorage across sessions
- System mode follows OS preference automatically (prefers-color-scheme)

#### Broadcast (One-to-Many)
PA can send the same item to multiple directors at once via DirectorSelector component:
- **Tasks** → creates separate independent records per director (each director acts independently)
- **Reminders** → creates separate records per director
- **Approvals** → creates separate records per director
- **Meetings / Events** → creates ONE shared record visible to all selected directors (same event)

---

## 5. Database Schema

All tables use the `DC_` prefix to avoid conflicts in the shared `BCDWsqldatabase`.

| Table | Purpose | Key Columns |
|---|---|---|
| `DC_Users` | All users (PA + directors) | Id, Name, Email, Password, Role, Title, Avatar, FirstName, LastName, Phone, Bio, Location, Department, AvatarColor, TwoFAEnabled, IsActive, LastLoginAt |
| `DC_Tasks` | Tasks assigned to directors | Id, Title, Description, Priority, Status, AssignedTo, CreatedBy, DueDate, Tags |
| `DC_Reminders` | Key reminders for directors | Id, Title, Description, DirectorId, DueDate, Priority, IsActive, CreatedBy |
| `DC_Approvals` | Approval requests | Id, Type, Title, Description, FromName, FromEmail, DirectorId, Priority, Status, Remarks, ActionBy, ActionAt |
| `DC_Meetings` | Meetings (individual + shared) | Id, Title, DirectorId, DirectorIds, IsShared, MeetingDate, MeetingTime, Duration, Location, Attendees |
| `DC_UrgentEmails` | Urgent email alerts | Id, Subject, FromEmail, FromName, DirectorId, Preview, Priority, IsRead |
| `DC_Travel` | Travel records | Id, Destination, Purpose, DirectorId, DepartureDate, ReturnDate, Status, Notes |
| `DC_Documents` | Document registry | Id, Title, Category, DirectorId, FileName, FileSize, FileType, ExpiryDate, Tags |
| `DC_Bills` | Bills and invoices | Id, Title, Vendor, Category, DirectorId, Amount, Currency, DueDate, Status, InvoiceNumber, PaidDate |
| `DC_Assets` | Asset registry | Id, Name, Category, DirectorId, SerialNumber, PurchaseDate, PurchaseValue, CurrentValue, Status, WarrantyExpiry, AssignedTo |
| `DC_Events` | Calendar events (individual + shared) | Id, Title, Type, DirectorId, DirectorIds, IsShared, StartDate, EndDate, StartTime, EndTime, Location, Attendees, Priority, Status, TeamsId, JoinUrl, Source |
| `DC_TeamsTokens` | OAuth tokens for Teams | DirectorId, AccessToken, RefreshToken, ExpiresAt, MsUserEmail |

### Schema Management
- Schema runs automatically on every backend startup via `setupDb.js`
- All `CREATE TABLE` statements use `IF NOT EXISTS` guards — safe to restart without data loss
- Profile columns (FirstName, LastName, Phone, Bio, etc.) added via `migrateProfile.js` migration
- Shared event columns (DirectorIds, IsShared) added via the same migration

---

## 6. API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login, returns JWT token + user object |
| POST | `/api/auth/logout` | JWT | Logout |

### Users / Profile
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/users/directors` | Admin | List all directors |
| GET | `/api/users/me` | JWT | Get current user full profile |
| PUT | `/api/users/me/profile` | JWT | Update profile (name, phone, bio, etc.) |
| PUT | `/api/users/me/avatar` | JWT | Update avatar colour and initials |
| PUT | `/api/users/me/password` | JWT | Change password (requires current password) |
| PUT | `/api/users/me/2fa` | JWT | Toggle 2FA on/off |
| DELETE | `/api/users/me` | JWT | Deactivate or permanently delete account |
| GET | `/api/users/me/sessions` | JWT | List active sessions |

### Tasks
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/tasks?directorId=` | JWT | List tasks for a director |
| POST | `/api/tasks` | Admin | Create task for single director |
| POST | `/api/tasks/broadcast` | Admin | Create task for multiple directors |
| PUT | `/api/tasks/:id` | Admin | Update task |
| PATCH | `/api/tasks/:id/status` | JWT | Update task status only |
| DELETE | `/api/tasks/:id` | Admin | Delete task |

### Reminders
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/reminders?directorId=` | JWT | List reminders |
| POST | `/api/reminders` | Admin | Create reminder |
| POST | `/api/reminders/broadcast` | Admin | Create reminder for multiple directors |
| PUT | `/api/reminders/:id` | Admin | Update reminder |
| DELETE | `/api/reminders/:id` | Admin | Delete reminder |

### Approvals
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/approvals?directorId=` | JWT | List approvals |
| POST | `/api/approvals` | Admin | Create approval request |
| POST | `/api/approvals/broadcast` | Admin | Create approval for multiple directors |
| PATCH | `/api/approvals/:id/action` | Director | Approve or reject |
| DELETE | `/api/approvals/:id` | Admin | Delete approval |

### Meetings
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/meetings?directorId=&date=` | JWT | List meetings (includes shared) |
| POST | `/api/meetings` | Admin | Create meeting (single or shared) |
| PUT | `/api/meetings/:id` | Admin | Update meeting |
| DELETE | `/api/meetings/:id` | Admin | Delete meeting |

### Other Modules (same CRUD pattern)
| Module | Base Path | Extra Endpoints |
|---|---|---|
| Urgent Emails | `/api/emails` | PATCH `/:id/read` |
| Travel | `/api/travel` | — |
| Documents | `/api/documents` | — |
| Bills | `/api/bills` | PATCH `/:id/status` |
| Assets | `/api/assets` | PATCH `/:id/status` |
| Events | `/api/events` | PATCH `/:id/status` |

### Teams Integration
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/teams/auth/connect?directorId=` | Start OAuth2 flow |
| GET | `/api/teams/auth/callback` | OAuth2 callback handler |
| POST | `/api/teams/auth/disconnect` | Disconnect Teams for a director |
| GET | `/api/teams/status?directorId=` | Connection status |
| GET | `/api/teams/summary?directorId=` | Full Teams data (presence, calendar, tasks) |
| GET | `/api/teams/calendar?directorId=&days=` | Calendar events |
| GET | `/api/teams/today?directorId=` | Today's schedule |
| GET | `/api/teams/tasks?directorId=` | To Do tasks |
| GET | `/api/teams/presence?directorId=` | User presence status |
| POST | `/api/teams/sync` | Sync Teams calendar into Events tab |

### System / Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check + DB connection status |
| POST | `/api/db/setup` | Manually trigger schema setup |
| POST | `/api/admin/reset-all-directors` | Reset all director passwords |
| POST | `/api/migrate/reset-passwords` | One-time password migration |

---

## 7. Project File Structure

```
DirectorControl/
├── backend/
│   ├── schema.sql                      # DB schema — runs on startup
│   ├── package.json                    # Node dependencies
│   ├── .env                            # Azure SQL + JWT secrets
│   ├── .env.example                    # Template for new devs
│   └── src/
│       ├── index.js                    # Express server entry point
│       ├── config/
│       │   ├── db.js                   # Azure SQL connection pool
│       │   ├── setupDb.js              # Auto-run schema on startup
│       │   └── migrateProfile.js       # Add profile + shared-event columns
│       ├── middleware/
│       │   └── auth.js                 # JWT verification middleware
│       ├── data/
│       │   └── mockData.js             # Legacy mock data (preserved, not used)
│       ├── services/
│       │   └── teamsService.js         # Microsoft Graph API service layer
│       └── routes/
│           ├── auth.js                 # Login / logout
│           ├── users.js                # Profile + settings endpoints
│           ├── tasks.js                # Tasks + broadcast
│           ├── reminders.js            # Reminders + broadcast
│           ├── approvals.js            # Approvals + broadcast + action
│           ├── meetings.js             # Meetings + shared meetings
│           ├── emails.js               # Urgent emails
│           ├── travel.js               # Travel records
│           ├── documents.js            # Document registry
│           ├── bills.js                # Bills + mark paid
│           ├── assets.js               # Assets + maintenance toggle
│           ├── events.js               # Events + shared events
│           ├── teams.js                # Teams OAuth + data endpoints
│           ├── admin.js                # Password reset utilities
│           └── migrate.js              # One-time migration endpoints
│
├── frontend/
│   ├── package.json                    # React dependencies
│   ├── .env                            # REACT_APP_API_URL
│   ├── .env.example
│   └── src/
│       ├── App.js                      # Route definitions (admin + director)
│       ├── index.css                   # CSS custom properties (light + dark)
│       ├── services/
│       │   └── api.js                  # Axios instance with base URL + auth header
│       ├── context/
│       │   ├── AuthContext.js          # Login, logout, updateUser
│       │   ├── DirectorContext.js      # Director switcher state
│       │   ├── NotificationContext.js  # Aggregated notifications (auto-refresh)
│       │   ├── SearchContext.js        # Global search state
│       │   └── ThemeContext.js         # Light / Dark / System theme
│       ├── components/
│       │   ├── auth/
│       │   │   └── ProtectedRoute.js   # Role-based route guard
│       │   ├── layout/
│       │   │   ├── DashboardLayout.js  # PA admin shell (header + nav)
│       │   │   ├── DirectorLayout.js   # Director shell (header + nav)
│       │   │   ├── NotificationPanel.js # Bell dropdown panel
│       │   │   ├── SearchPanel.js      # Ctrl+K search overlay
│       │   │   └── ThemeToggle.js      # Sun/Moon/System toggle button
│       │   ├── dashboard/
│       │   │   ├── DashboardCard.js    # Base card wrapper
│       │   │   ├── MeetingsCard.js
│       │   │   ├── UrgentEmailsCard.js
│       │   │   ├── RemindersCard.js
│       │   │   ├── ApprovalsCard.js
│       │   │   ├── TravelCard.js
│       │   │   └── TaskSummaryCard.js
│       │   └── modals/
│       │       ├── Modal.js            # Base modal wrapper
│       │       ├── FormField.js        # Reusable form field
│       │       ├── DirectorSelector.js # Multi-director broadcast selector
│       │       ├── AddTaskModal.js
│       │       ├── AddReminderModal.js
│       │       ├── AddApprovalModal.js
│       │       ├── AddMeetingModal.js
│       │       ├── AddEmailModal.js
│       │       ├── AddTravelModal.js
│       │       └── TaskDetailModal.js
│       └── pages/
│           ├── LoginPage.js
│           ├── Dashboard.js
│           ├── Tasks.js
│           ├── Travel.js
│           ├── Documents.js
│           ├── Bills.js
│           ├── Assets.js
│           ├── Events.js
│           ├── Teams.js
│           ├── Profile.js
│           ├── Settings.js
│           └── director/
│               ├── DirectorDashboard.js
│               ├── DirectorTasks.js
│               ├── DirectorReminders.js
│               └── DirectorApprovals.js
│
├── scripts/
│   └── verify-and-commit.sh            # Auto-commit helper script
├── .kiro/                              # Kiro IDE config + hooks
├── .gitignore
├── package.json                        # Root workspace package
└── README.md
```

---

## 8. Development Gantt Chart

```
FEATURE / SPRINT                         Apr W1    Apr W2    Apr W3    Apr W4    May W1    May W2
                                         (20 Apr)  (27 Apr)  (4 May)   (11 May)  (18 May)  (25 May)
─────────────────────────────────────────────────────────────────────────────────────────────────────

SPRINT 1 — Foundation
  Project setup, Git init                ████
  Backend scaffold (Express + routes)    ████
  Frontend scaffold (React + routing)    ████
  Login page + JWT authentication        ████
  Mock data layer                        ████
  Role-based ProtectedRoute              ████

SPRINT 2 — Core Dashboard (Phase 1)
  Dashboard page + 6 widget cards              ████
  Tasks Kanban board (drag & drop)             ████
  Add modals (meetings, emails, reminders)     ████
  Director switcher dropdown                   ████
  PA admin layout (header + nav)               ████

SPRINT 3 — Extended Tabs (Phase 2)
  Travel tab (card grid + CRUD)                      ████
  Documents tab (expiry alerts + filters)            ████
  Bills tab (table view + mark paid)                 ████
  Assets tab (warranty alerts + filters)             ████
  Events tab (timeline + shared events)              ████

SPRINT 4 — Intelligence Layer
  Notification bell (aggregated, auto-refresh)             ████
  Global search Ctrl+K (10 modules)                        ████
  Light / Dark / System theme toggle                       ████
  Microsoft Teams OAuth2 integration                       ████
  Teams calendar, tasks, presence sync                     ████

SPRINT 5 — Database Integration
  Azure SQL schema design (12 tables)                            ████
  Replace all mock data with real SQL queries                    ████
  Auto schema setup on startup (IF NOT EXISTS)                   ████
  Connection pool with health check + reconnect                  ████
  Password migration (bcrypt hash sync)                          ████

SPRINT 6 — Director Portal
  Director-specific layout + routing                                   ████
  Director Dashboard (stats + approvals + reminders)                   ████
  Director Tasks (Kanban, own tasks only)                              ████
  Director Reminders tab                                               ████
  Director Approvals tab (approve/reject)                              ████
  Role-based URL namespacing (/director/*)                             ████

SPRINT 7 — Profile & Settings
  Profile page (avatar, bio, work info)                                      ████
  Avatar colour picker + custom initials                                      ████
  Settings — password change + strength meter                                 ████
  Settings — 2FA toggle (saved to DB)                                         ████
  Settings — active sessions viewer                                           ████
  Settings — linked accounts + account deletion                               ████

SPRINT 8 — Broadcast & Shared Records
  DirectorSelector multi-select component                                           ████
  Broadcast tasks / reminders / approvals                                           ████
  Shared meetings (one record, multiple directors)                                  ████
  Shared events (one record, multiple directors)                                    ████

SPRINT 9 — Polish & Fixes
  Profile email overflow fix (word-break CSS)                                             ████
  CSS variable theming across all pages                                                   ████
  Proxy removal (hot-reload fix)                                                          ████
  Auto-commit Kiro hooks setup                                                            ████
  Project summary document                                                                ████
─────────────────────────────────────────────────────────────────────────────────────────────────────
TOTAL DURATION                           |←──────────────── ~9 Sprints / ~9 Weeks ──────────────────→|
```

---

## 9. Key Design Decisions

| Decision | Rationale |
|---|---|
| CSS Modules over Tailwind | Scoped styles per component, no class name conflicts, easier to maintain |
| CSS Custom Properties for theming | Zero JS overhead for dark mode, instant switch, no re-render |
| Raw parameterised SQL over ORM | Direct control, no abstraction overhead, easier to debug Azure SQL issues |
| Mock data preserved but unused | `mockData.js` kept for reference/offline testing; all routes use real DB |
| Broadcast vs Shared records | Tasks/reminders/approvals are broadcast (independent copies) so each director acts independently; meetings/events are shared (one record) since they represent the same occurrence |
| Role-based URL namespacing | `/dashboard` for PA, `/director/*` for directors — clean separation, no accidental cross-access |
| Auto schema on startup | `IF NOT EXISTS` guards make it safe to run on every restart without manual intervention |
| JWT in localStorage | Appropriate for this internal intranet tool; for public-facing production consider httpOnly cookies |
| Director passwords separate from admin | `Director@123` vs `Admin@123` avoids Chrome data breach warnings for shared passwords |

---

## 10. Running the Project

### Prerequisites
- Node.js 18+
- Git Bash (Windows) — required for git commands
- Network access to `bcdwsqlserver.database.windows.net`

### Start Backend
```bash
cd backend
npm install
npm run dev
```

Expected startup output:
```
🚀 Server running on port 5000
✅ Connected to Azure MS SQL Server
✅ Schema ready — 12 statements ran
✅ Profile & shared-event columns ready
✅ Passwords synced — PA: Admin@123 | Directors: Director@123
```

### Start Frontend
```bash
cd frontend
npm install
npm start
```
Opens at `http://localhost:3000`

### Health Check
```
GET http://localhost:5000/api/health
→ { "status": "OK", "db": "connected", "message": "DirectorControl API running" }
```

### Manual Schema Reset (if needed)
```
POST http://localhost:5000/api/db/setup
```

---

## 11. Pending / Future Work (Phase 3+)

| Feature | Priority | Notes |
|---|---|---|
| Real director names in DB | High | Update `DC_Users` with actual director names from Acorn |
| Azure AD app registration for Teams | High | Needs client ID + secret from Azure portal to enable OAuth |
| File upload for Documents tab | Medium | Currently stores metadata only — no actual file binary |
| Email notifications | Medium | Notify directors when PA adds approvals or reminders |
| Push notifications | Medium | Browser push API for urgent items |
| Audit log | Medium | Track who changed what and when |
| Mobile responsive improvements | Low | Currently desktop-first layout |
| Export to PDF / Excel | Low | For bills, assets, tasks reports |
| Recurring tasks / reminders | Low | Weekly / monthly repeat options |
| Calendar grid view for Events | Low | Month / week grid in addition to timeline |
| Two-Factor Authentication (full TOTP) | Low | Currently toggle only — no actual authenticator app flow |
| Director name customisation | Low | Allow PA to rename directors in settings |

---

*Document generated: April 2026 | DirectorControl v1.0 | Acorn Universal Consultancy*
