# Employee Management

An employee directory and HR portal with separate administrator and employee access, attendance, leave requests, and announcements.

## Run with Docker Compose

Create a `.env` file at the project root (do not commit it):

```env
POSTGRES_DB=employee_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace-with-a-strong-database-password
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-initial-password
JWT_SECRET=replace-with-at-least-32-random-characters
JWT_EXPIRES_IN=1h
CLIENT_URL=http://localhost:5173
```

Start the application:

```powershell
docker compose up --build
```

Open `http://localhost:5173`. The backend creates or updates the required database tables at startup and creates the initial administrator if it does not exist. Database and backend ports are bound to loopback; the browser reaches the API through the frontend proxy.

## Development and checks

The Vite development server proxies `/api` to `http://localhost:3000`. Start PostgreSQL and the backend with the same database environment variables, then run:

```powershell
Set-Location .\backend
npm install
npm test
npm run dev
```

In another terminal:

```powershell
Set-Location .\frontend
npm install
npm run dev
npm run lint
npm run build
```

## Security and operations

- Employee account creation and password resets require administrator authorization. Temporary passwords must be changed before an employee can use the portal; resetting a password invalidates existing employee sessions. Passwords must contain at least 12 characters and no more than 72 UTF-8 bytes because the app uses bcrypt.
- Administrators can change their password in Account Settings. Password changes invalidate existing administrator sessions except for the session that performs the change. Account status, last login, session expiry, and recent security/profile-change activity are shown there.
- After upgrading to this version, administrators must sign in again because older administrator tokens do not include the new session-version claim.
- Employees can request profile corrections from their Profile page. An administrator must approve or reject each request; pending requests are limited to one per employee. Password and profile-change events are written to the administrator-only audit log.
- In-app notifications alert active administrators to new leave/profile requests and employees to review decisions and published announcements. Notifications are retained in the database and can be marked read from the header bell.
- Employee documents and profile photos are stored outside the public web root in the `employee_documents` Docker volume. Uploads accept PDF, PNG, or JPEG files with a 10 MB document limit (5 MB for photos); set `HR_STORAGE_PATH` to a private persistent directory when running the backend outside Docker.
- Login endpoints are rate-limited per client IP. The default limiter store is in-memory; use a shared store if deploying multiple backend replicas.
- Configure HTTPS at the public reverse proxy and use a managed secret store for production credentials. Do not expose PostgreSQL or the backend directly to the public internet.
- Schema setup is idempotent and runs at application startup. For production releases with frequent schema changes, replace startup DDL with a versioned migration process.
