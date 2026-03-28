# SmartClinic WebApp — React + Vite

## Quick Start

```bash
cd webapp
npm install
npm run dev
```
Open: **http://localhost:4173/**

## Features
- **Dashboard** — KPI stats, recent patients with photos, appointments, billing summary
- **Patients** — Full CRUD with photo upload (drag & drop or click), view modal, edit, delete
- **Appointments** — Table with full CRUD, status badges, search & filter
- **Billing** — Table with full CRUD, LKR amounts, payment status tracking

## Backend Requirements
| Service             | Port  | API                                     |
|---------------------|-------|-----------------------------------------|
| patient-service     | 8081  | http://localhost:8081/api/patients      |
| appointment-service | 8082  | http://localhost:8082/api/appointments  |
| billing-service     | 8083  | http://localhost:8083/api/billings      |

Vite proxies all `/api/*` requests automatically — no CORS issues.

## Stack
- React 18 + Hooks (no external UI library)
- Vite 5 with dev server proxy
- Custom CSS design system — dark midnight theme
- Google Fonts: Syne + Outfit
