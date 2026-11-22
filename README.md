# ⚖️ LEXASSIST — AI-Powered Legal Assistance & Appointment Platform

> **Minor Project | 2nd Year B.Tech/BCA**  
> A full-stack web platform that makes legal help accessible to every citizen of India using AI, RAG, and modern web technologies.

---

## 🚀 Project Overview

LEXASSIST is a comprehensive legal assistance platform that combines:
- 🤖 AI-powered legal chatbot (RAG on Indian law documents)
- 📋 Case tracking with visual timelines and priority system
- 🔍 Lawyer discovery and booking
- 📅 Integrated legal calendar
- 🛡️ Role-based dashboards for Citizens, Lawyers, and Admins

---

## 🗂️ Folder Structure

```
LEXASSIST/
│
├── server.js                    ← Main entry point (Express server)
├── package.json                 ← Dependencies & scripts
├── .env                         ← Environment variables (not committed)
├── .gitignore
│
├── Backend/
│   ├── config/
│   │   └── db.js                ← MongoDB connection
│   ├── controllers/
│   │   ├── authController.js    ← Register, login, profile
│   │   ├── caseController.js    ← Case CRUD, priority, timeline
│   │   ├── lawyerController.js  ← Lawyer search, profiles, reviews
│   │   ├── appointmentController.js ← Booking, slots, status
│   │   ├── chatbotController.js ← RAG AI chatbot logic
│   │   └── adminController.js   ← Admin dashboard, verification
│   ├── middleware/
│   │   └── auth.js              ← JWT protect + role authorize
│   ├── models/
│   │   ├── User.js              ← User schema (citizen/lawyer/admin)
│   │   ├── Lawyer.js            ← Lawyer profile, availability
│   │   ├── Case.js              ← Case with stages, timeline, priority
│   │   ├── Appointment.js       ← Booking system
│   │   └── Extras.js            ← Review, Document, Notification, ChatHistory, CalendarEvent
│   └── routes/
│       ├── authRoutes.js
│       ├── caseRoutes.js
│       ├── lawyerRoutes.js
│       ├── appointmentRoutes.js
│       ├── chatbotRoutes.js
│       ├── calendarRoutes.js
│       ├── adminRoutes.js
│       ├── documentRoutes.js
│       ├── notificationRoutes.js
│       └── userRoutes.js
│
├── Frontend/
│   ├── public/
│   │   ├── css/
│   │   │   └── main.css         ← Full design system (Navy + Gold theme)
│   │   └── js/
│   │       └── app.js           ← Shared utilities (Auth, API, Toast, DateUtils)
│   └── views/
│       ├── auth/
│       │   ├── landing.html     ← Marketing homepage
│       │   ├── login.html       ← Login with demo accounts
│       │   └── register.html    ← Register as Citizen or Lawyer
│       ├── citizen/
│       │   ├── dashboard.html   ← Citizen overview with stats
│       │   ├── cases.html       ← Case list with timeline & priority
│       │   ├── chatbot.html     ← Full AI chatbot interface
│       │   └── lawyers.html     ← Lawyer search & booking
│       ├── lawyer/
│       │   └── dashboard.html   ← Lawyer practice overview
│       ├── admin/
│       │   └── dashboard.html   ← Admin control panel
│       └── shared/
│           ├── calendar.html    ← Legal calendar view
│           ├── appointments.html← Appointments management
│           └── 404.html         ← 404 page
│
├── Ai_Chatbot_Rag/
│   ├── knowledge_base/
│   │   └── indian_law_basics.txt ← Legal knowledge for RAG
│   ├── embeddings/              ← Vector store (auto-generated)
│   └── utils/                   ← RAG utilities
│
├── DataBase_Ai_Data/
│   └── seed.js                  ← Database seeder with sample data
│
└── Documentation/
    └── (API docs, screenshots)
```

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js 20 or newer
- MongoDB (local or Atlas)
- SMTP credentials for account verification and password reset emails
- (Optional) OpenAI API key for generated answers; local retrieval remains available without it

### 2. Install Dependencies
```bash
npm ci
```

### 3. Configure Environment
Copy `.env.example` to `.env`, then set `MONGO_URI`, `CLIENT_URL`, `JWT_SECRET`, `OTP_PEPPER`, and SMTP values. Generate independent secrets with:
```sh
node -p "require('crypto').randomBytes(48).toString('base64url')"
```
Use a different generated value for each secret. Local `CLIENT_URL` is `http://localhost:5000`; `ALLOW_DEV_OTP=true` is for local development only. Production requires an HTTPS origin, SMTP credentials, and an absolute `UPLOAD_DIR` mounted on persistent storage. The app refuses to boot in production when required values are missing or invalid.

### 4. Seed demo data (optional, development only)
The demo seeder deletes existing demo collections and is disabled in production. Run it only against a disposable local database after explicitly enabling it. Set one unique demo password (12+ characters) for all sample accounts:
```powershell
$env:ALLOW_DESTRUCTIVE_SEED = 'true'
$env:SEED_DEMO_PASSWORD = 'your-unique-local-demo-password'
npm run seed
```
For a remote development database, also set `ALLOW_REMOTE_DEMO_SEED=true`. Never run the seeder against production data.

### 5. Start Server
```bash
npm start         # Start after the configured MongoDB is reachable
npm run dev       # Development (with nodemon)
```

### 6. Open in Browser
```
http://localhost:5000
```

---

## Demo accounts (after local seeding)

| Role    | Email                     |
|---------|---------------------------|
| Citizen | rajesh@example.com        |
| Lawyer  | priya@lexassist.com       |
| Admin   | admin@lexassist.com       |

Use the local `SEED_DEMO_PASSWORD` value; demo credentials are not compiled into the seeder.

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint                    | Description         |
|--------|-----------------------------|---------------------|
| POST   | /api/auth/register          | Register user       |
| POST   | /api/auth/login             | Login               |
| GET    | /api/auth/me                | Get current user    |
| PUT    | /api/auth/update            | Update profile      |
| PUT    | /api/auth/change-password   | Change password     |

### Cases
| Method | Endpoint                       | Description         |
|--------|--------------------------------|---------------------|
| GET    | /api/cases                     | Get all cases       |
| POST   | /api/cases                     | Create case         |
| GET    | /api/cases/:id                 | Get case details    |
| PUT    | /api/cases/:id                 | Update case         |
| PUT    | /api/cases/:id/stage/:i        | Complete stage      |
| GET    | /api/cases/stats               | Case statistics     |

### Lawyers
| Method | Endpoint                    | Description             |
|--------|-----------------------------|-------------------------|
| GET    | /api/lawyers                | Search lawyers          |
| GET    | /api/lawyers/:id            | Lawyer profile          |
| POST   | /api/lawyers/register       | Register as lawyer      |
| PUT    | /api/lawyers/profile        | Update lawyer profile   |
| POST   | /api/lawyers/:id/review     | Add review              |

### Appointments
| Method | Endpoint                         | Description         |
|--------|----------------------------------|---------------------|
| GET    | /api/appointments                | Get appointments    |
| POST   | /api/appointments                | Book appointment    |
| PUT    | /api/appointments/:id/status     | Update status       |
| GET    | /api/appointments/slots          | Available slots     |

### Chatbot (RAG)
| Method | Endpoint                         | Description         |
|--------|----------------------------------|---------------------|
| POST   | /api/chatbot/message             | Send message        |
| GET    | /api/chatbot/history             | Chat history        |
| DELETE | /api/chatbot/history/:sessionId  | Delete session      |

---

## 🌟 Key Features

| Feature | Description |
|---------|-------------|
| **AI Chatbot (RAG)** | Retrieves passages from a local legal library. Optional OpenAI generation requires in-product consent for each external request. |
| **Case Priority** | Auto-assigns 🔴 High / 🟠 Medium / 🟢 Low based on hearing dates |
| **Case Timeline** | 5-stage visual progress tracker for each case |
| **Lawyer Search** | Filter by specialization, city, experience, fee |
| **Appointment Booking** | Real-time slot availability, in-person/online/phone |
| **Legal Calendar** | Full monthly calendar with event types |
| **Role Dashboards** | Separate views for Citizen, Lawyer, Admin |
| **JWT Auth** | Secure token-based authentication |
| **Smart Notifications** | In-app notifications refresh by polling; hearing reminders use India Standard Time. |

---

## 🛠️ Tech Stack

| Layer      | Technology |
|------------|------------|
| Backend    | Node.js, Express.js |
| Database   | MongoDB, Mongoose ODM |
| Auth       | JWT (JSON Web Tokens), bcryptjs |
| AI/RAG     | Local TF-IDF retrieval, optional OpenAI API |
| Frontend   | Vanilla HTML, CSS, JavaScript |
| Fonts      | Playfair Display, DM Sans (Google Fonts) |
| File Upload| Multer |
| Email      | Nodemailer |
| Scheduler  | node-cron |
| Security   | Helmet, CORS, Rate Limiting |

## Production deployment checklist

- Set `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `OTP_PEPPER`, `CLIENT_URL`, `EMAIL_USER`, and `EMAIL_PASS` in the host's secret manager. Do not commit `.env`.
- Set `CLIENT_URL` to the public HTTPS origin with no path. Configure the same origin in DNS and hosting.
- Mount durable storage and set `UPLOAD_DIR` to its absolute mount path. User documents and lawyer verification files are stored on disk; ephemeral container storage is not suitable.
- Restrict MongoDB network access to the app, use a least-privilege database user, and configure backups and retention appropriate for confidential legal records.
- Run `npm ci`, `npm test`, and `npm start` in the deployment pipeline. `/api/health/live` checks process liveness; `/api/health` reports database readiness and is configured as the Railway health check.
- Production startup also requires `LEGAL_CONTENT_REVIEWED=true` and `LEGAL_CONTENT_REVIEW_DATE=YYYY-MM-DD`. These are an operator attestation: a qualified Indian legal professional must review every bundled legal source and generated document template for current law, accuracy, and licensing before they are set. Keep this false until that review is actually complete. Production admin uploads/deletions to the local legal library are disabled until source-level review tracking exists.
- Create the first admin with `seedAdmin.js` only as a one-time bootstrap: set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (16+ characters), and `ALLOW_ADMIN_BOOTSTRAP=true` in the deployment environment, run the script, then remove the bootstrap flag and password from the web service environment. The seeder skips when an admin already exists.
- Configure and verify SMTP before opening registration. Set `OPENAI_API_KEY` only when enabling generated answers; chat questions and uploaded-document text go to OpenAI only after user opt-in.
- Configure the OpenAI project spend limit as well as `AI_REQUESTS_PER_DAY`; the built-in request quota is per server instance and needs a shared store before horizontally scaling.
- Review hosting logs, data retention, privacy notices, legal-source licensing, and operational support before serving real users.

---

## 📌 Adding Your Own Legal Documents to RAG

1. In development, add `.txt` or `.md` files to `Ai_Chatbot_Rag/knowledge_base/`
2. Name them descriptively (e.g., `criminal_law.txt`, `consumer_rights.txt`)
3. Restart the server — chatbot will automatically use them. Never deploy a new source before qualified legal review; the production gate does not replace that review.

---

## 🎯 Project Objectives

LEXASSIST demonstrates:
1. Full-stack Node.js/MongoDB web development
2. JWT-based authentication & authorization
3. RAG (Retrieval-Augmented Generation) AI integration
4. Role-based access control (RBAC)
5. RESTful API design
6. Responsive, production-grade UI/UX design

---

## 👨‍💻 Team

Built as a Minor Project — 2nd Year  
*For educational purposes. Not a substitute for professional legal advice.*

---

## 📄 License
MIT License — Free to use for educational purposes.
