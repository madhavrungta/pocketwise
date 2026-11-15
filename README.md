# PocketWise â€” Practical No. 05: ExpressJS

## Objective

Design and develop a web application that demonstrates server-side validation, Express routing, and HTTP request/response handling. PocketWise extends the existing expense tracker: React provides the interface, while an Express API independently validates submitted expenses and stores them in a JSON file.

## Technologies and architecture

- React 18 and Vite frontend in `src/`
- Node.js ES modules and Express 4 backend
- JSON file persistence
- Node's built-in test runner (`node:test`) for API integration tests

Request flow: React sends JSON to `/api/expenses`; `server.js` parses the request and mounts `routes/expenseRoutes.js`; POST requests pass through `middleware/validateExpense.js` before `controllers/expenseController.js` reads or writes data via `utils/expenseStore.js`.

```text
src/                          React dashboard and form
server.js                     Express setup, middleware, health route, errors
routes/expenseRoutes.js       GET, POST, DELETE routes
controllers/expenseController.js  Request handlers and JSON responses
middleware/validateExpense.js Independent server-side validation
utils/expenseStore.js         JSON file persistence
tests/expense-api.test.js     Live HTTP integration tests
```

## Express and validation

Express uses `express.json()` with a 10 KB body limit and CORS configuration. The server listens on `PORT` (default `5000`). Route handlers read request bodies from `req.body` and expense IDs from `req.params.id`. Unknown routes return 404; malformed JSON returns 400; unexpected errors are handled centrally.

The POST validation middleware does not trust the React form. It checks:

- Title is a non-empty string, trimmed, at least two characters and at most 60 characters.
- Amount is present, finite, positive, and no greater than 10,000,000.
- Category matches the allowed category list.
- Date is an actual calendar date in ISO `YYYY-MM-DD` format. Future expense dates are rejected.

The UI accepts `DD-MM-YYYY`, validates it, converts it to ISO before sending, and formats saved ISO dates back for display. API validation errors are shown in the form; success messages are shown only after a successful response.

Responses use JSON. Validation errors return HTTP 400 with `{ "success": false, "message": "...", "errors": { ... } }`; successful creation returns 201 and the created item; GET and DELETE return 200; deleting an unknown ID returns 404.

## API routes

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check that the server is running |
| GET | `/api/expenses` | Return `{ success, count, data }` |
| POST | `/api/expenses` | Validate and save an expense |
| DELETE | `/api/expenses/:id` | Delete by ID or return 404 |

POST body example (the API date is ISO):

```json
{"title":"Lunch","amount":250,"category":"Food & Drinks","date":"2024-02-29"}
```

## Install and run

Requires Node.js 18 or later.

```bash
npm install
npm run server
```

In another terminal:

```bash
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `http://localhost:5000` during development. Build the frontend with `npm run build` and run the automated API suite with `npm test`.

## Tests

Run `npm test`. The integration suite starts the actual Express server with a temporary data file and checks health, GET, valid POST, empty title, missing amount, zero, negative and alphabetic amounts, missing/invalid category, invalid calendar date, missing fields, malformed JSON, persistence after restart, and successful/missing DELETE. The temporary test file is removed afterward.

Last verified in this workspace: `npm test` passed all 15 tests. Production build completed through Vite's JavaScript API. The standard `npm run build` command could not load `vite.config.js` in this restricted workspace because esbuild could not access an ancestor directory; the equivalent Vite build succeeded when config bundling was disabled. Browser-driven interaction with the React form has not been tested.

## Data storage

The backend writes to `utils/data/expenses.json` by default. If the file is missing, it creates an empty JSON array. Set `EXPENSES_FILE` to use another path (for example, a test temp file or a mounted persistent disk). Expense data files are excluded from Git; do not commit personal transaction records. Existing browser LocalStorage data can be migrated once by the frontend when the backend store is empty.

## Deployment

The Vite proxy is development-only. For a single-origin deployment, the Express server can serve `dist/` when `NODE_ENV=production`. The included `render.yaml` configures this setup for Render, with JSON data on a persistent disk; that Blueprint uses a paid Render service plan.

Vercel can host the React app and Express API on its free Hobby plan for personal projects, but its serverless filesystem is not persistent. To keep expenses there, first replace JSON storage with a hosted database (for example, Supabase) and configure the required environment variables. No production deployment has been completed from this repository.

