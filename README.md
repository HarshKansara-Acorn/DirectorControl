# DirectorControl

A productivity and management dashboard for Directors and their Personal Assistant (PA).

## Project Structure

```
DirectorControl/
├── frontend/          # React JS frontend
├── backend/           # Node.js + Express API
└── README.md
```

## Tech Stack

- **Frontend:** React JS, Tailwind CSS, React Router
- **Backend:** Node.js, Express.js
- **Database:** MS SQL Server
- **Auth:** JWT-based authentication

## Roles

- **PA (Admin):** Can manage all 3 directors — create reminders, tasks, submit approvals, urgent emails
- **Director:** Can view their own dashboard, approve/reject requests, manage their tasks

## Phase 1 Features

- ✅ Dashboard Tab (Meetings, Urgent Emails, Key Reminders, Pending Approvals, Travel Reminders, Task Summary)
- ✅ Tasks Tab (Kanban Board — To Do, In Progress, Review, Done)

## Getting Started

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## Environment Variables

Copy `.env.example` to `.env` in both `frontend/` and `backend/` and fill in your values.
