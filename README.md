# PocketWise â€” Smart Expense Tracker

PocketWise is a React expense dashboard with an Express API. It supports adding, searching, filtering, summarizing, and deleting expenses. Expense data is persisted in a JSON file by the backend.

## Stack and structure

- React 18 and Vite: `src/App.jsx`, `src/main.jsx`, `src/styles.css`
- Express API: `server.js`, `routes/expenseRoutes.js`, `controllers/expenseController.js`
- Independent server validation: `middleware/validateExpense.js`
- JSON storage: `utils/expenseStore.js`, `utils/data/expenses.json`
- `data/expenses.json` is a legacy/unused file; the active store is under `utils/data/`.

Requires Node.js 18 or later.

## Install and run locally

```bash
npm install
npm run server
```

In a second terminal:

```bash
npm run dev
```

Open http://localhost:5173. The Vite development server proxies `/api` to `http://localhost:5000`. Build the frontend with `npm run build` and preview it with `npm run preview`.

## API

| Method | Endpoint | Result |
|---|---|---|
| GET | `/api/health` | API status |
| GET | `/api/expenses` | `{ success, count, data }` |
| POST | `/api/expenses` | Creates an expense; returns 201 |
| DELETE | `/api/expenses/:id` | Deletes an expense; returns 404 when absent |

POST JSON fields: `title`, `amount`, `category`, `date`. The API expects `date` in ISO `YYYY-MM-DD` format. The browser form displays and accepts `DD-MM-YYYY`, validates the actual calendar date and rejects future dates, then sends ISO format. Server validation independently checks all fields, amount limits, date validity, and the same future-date policy. Validation failures return 400 with `{ success: false, message, errors }`.

Example:

```json
{"title":"Lunch","amount":250,"category":"Food & Drinks","date":"2026-11-15"}
```

## Data and migration

The server creates the active JSON file when it is missing and does not overwrite existing records at startup. Invalid JSON is surfaced as a useful server error instead of silently replacing the file. Existing `expenses` LocalStorage data is copied to an empty server once, with a completion marker; the backend is the primary database. Keep a backup of the JSON file when deploying or moving the project.

## Deployment

### Render deployment

The included `render.yaml` deploys one Node web service that serves both the built Vite site and API from the same origin. It configures the health check and stores JSON data on a 1 GB persistent disk mounted at `/var/data`. This blueprint uses Render's `starter` paid web service plan because persistent disks are not available on free web services. Review the plan and cost in Render before creating the service.

1. Push this project to a GitHub repository.
2. In Render, choose **New â†’ Blueprint**, connect the repository, and select the branch containing `render.yaml`.
3. Review the `pocketwise` web service, paid plan and persistent disk, then apply the Blueprint.
4. After deployment, open the service's `onrender.com` URL. Verify `/api/health` and `/api/expenses` on that same host.

No `VITE_API_BASE_URL` or `FRONTEND_URL` is needed when frontend and API share this service and origin. Render provides `PORT`; Express binds to it. For manually configured services, use build command `npm install && npm run build`, start command `npm start`, health check path `/api/health`, and set `NODE_ENV=production`, `EXPENSES_FILE=/var/data/expenses.json`; attach a persistent disk mounted at `/var/data`.

The service has not been deployed from this local workspace: it must be pushed to a repository connected to your Render account and the Blueprint applied there. The Render URL will be assigned after deployment.

