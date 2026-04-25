# CareKit k6 Load Tests

Performance tests for the CareKit backend API (`http://localhost:5100/api/v1`).

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

The backend must be running on port 5000 before running tests:

```bash
# From repo root
npm run docker:up    # Start PostgreSQL + Redis
npm run dev:backend  # NestJS on :5100 (default)
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `K6_EMAIL` | `admin@carekit.sa` | Admin login email |
| `K6_PASSWORD` | `Password123!` | Admin password |
| `K6_EMPLOYEE_ID` | `1` | Employee ID for slot/rating tests |
| `K6_SERVICE_ID` | `1` | Service ID for booking creation |
| `K6_CLIENT_ID` | `1` | Client ID for detail/stats tests |

## Running Tests

### Run all scenarios

```bash
cd scripts/performance/k6
./run-all.sh
```

### Run a single scenario

```bash
# Auth endpoints
k6 run scenarios/auth.load.js

# Bookings endpoints
k6 run scenarios/bookings.load.js

# Employees (public endpoints)
k6 run scenarios/employees.load.js

# Clients endpoints
k6 run scenarios/clients.load.js
```

### Override ENV variables

```bash
K6_EMAIL=doctor@clinic.sa \
K6_PASSWORD=MyPass123! \
K6_EMPLOYEE_ID=42 \
k6 run scenarios/employees.load.js
```

### Output to JSON for analysis

```bash
k6 run --out json=results/auth-$(date +%s).json scenarios/auth.load.js
```

## Thresholds

Each scenario enforces these thresholds — if violated, k6 exits with code 99:

| Scenario | p95 threshold | Error rate |
|---|---|---|
| Auth `/auth/login` | < 300ms | < 1% |
| Auth `/auth/me` | < 200ms | < 1% |
| Bookings (read) | < 500ms | < 1% |
| Bookings (create) | < 800ms | < 1% |
| Employees | < 400ms | < 1% |
| Clients | < 500ms | < 1% |

## Stage Configs

| Stage | VUs | Duration | Purpose |
|---|---|---|---|
| Smoke | 1 | 30s | Sanity check — catch obvious failures |
| Load | 10–20 | 2–3min | Normal expected traffic |
| Stress | 50 | 1min | Find the breaking point |
| Spike | 100 | 30s | Simulate sudden burst |

Auth and Bookings tests use smoke + load stages.
Employees use a higher VU count (50) since they are unauthenticated public endpoints.

## Interpreting Results

Key metrics to watch in the k6 output:

- `http_req_duration` — p95 must stay under the threshold
- `http_req_failed` — must stay below 1%
- `http_reqs` — total request throughput
- Custom trends (`auth_login_duration`, `bookings_list_duration`, etc.) — per-endpoint p95

A `PASS` with all thresholds green means the API is production-ready under that load profile.

A `FAIL` with threshold violations means you need to investigate DB query performance, caching, or horizontal scaling before going live.

## Results Directory

`run-all.sh` saves raw JSON to `results/<timestamp>/`:

```
results/
  20260327_143000/
    auth.json
    bookings.json
    employees.json
    clients.json
    summary.json    ← pass/fail manifest
```

Use `k6 cloud` or Grafana k6 OSS for visual dashboards if needed.
