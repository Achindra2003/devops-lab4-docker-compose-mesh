# Screenshot Checkpoints & Visual Verification Guide

**Course:** MCA Trimester 5 — DevOps Lab (Lab 4)  
**Student Name:** Achindra Sharma (2547105) — 4MCA A  
**Application:** MeshPulse — Multi-Container Application Orchestration, Network Segmentation & Storage Validation  
**Repository:** [github.com/Achindra2003/devops-lab4-docker-compose-mesh](https://github.com/Achindra2003/devops-lab4-docker-compose-mesh)  

---

## Screenshot Checkpoint Index

| Figure | Filename | Description | Evaluator Verification Target |
| :--- | :--- | :--- | :--- |
| **Fig. 1** | `01-docker-compose-build.png` | Compiling multi-container images | Shows `docker compose build` compiling custom multi-stage `meshpulse-api:1.0.0` (UID 1000) |
| **Fig. 2** | `02-docker-compose-up.png` | Ordered multi-container deployment | Shows sequential boot: `mesh-cache` healthy ➔ `mesh-api` healthy ➔ `mesh-gateway` & `mesh-watchdog` |
| **Fig. 3** | `03-docker-compose-ps.png` | Process table & service health | Shows `docker compose ps` verifying 4/4 healthy containers with ports `8080:80` and bound networks |
| **Fig. 4** | `04-network-inspection.png` | Subnet isolation verification | Demonstrates `docker network inspect` confirming subnets `172.28.1.0/24` and `172.28.2.0/24` |
| **Fig. 5** | `05-dns-service-discovery.png` | DNS service discovery (127.0.0.11) | Shows internal DNS resolving `cache` (172.28.2.2) and `api` (172.28.1.3) across subnets |
| **Fig. 6** | `06-network-isolation-test.png` | Zero-Trust network isolation | Proves gateway CANNOT connect or ping Redis cache (`nc: bad address`, 100% packet loss) |
| **Fig. 7** | `07-storage-volume-inspect.png` | Volume metadata & read-only mount | Shows `meshpulse_redis_data` volume inspect and `Read-only file system` error on `nginx.conf:ro` |
| **Fig. 8** | `08-storage-durability-recovery.png` | Volume crash recovery durability | Proves container destruction (`stop & rm`) with 100% data recovery via named volume |
| **Fig. 9** | `09-automated-validation-suite.png` | Automated test suite execution | Shows `validate:network` (6/6 passed) and `validate:storage` (4/4 passed) reporting 10/10 green checks |
| **Fig. 10**| `10-meshpulse-live-dashboard.png` | Interactive web dashboard | Shows live portal at `http://localhost:8080` with topology diagram, DNS probe, and storage logs |

---

## Detailed Capture Instructions

### 📸 Screenshot 1: Compiling Multi-Container Stack
- **What to capture:** Terminal output executing `docker compose build`.
- **How to take it:** In PowerShell, run `docker compose build` and capture stage transitions (`AS builder` ➔ `AS runner`) with `Win + Shift + S`.
- **What evaluators check:** Custom multi-stage build compilation, `node:22-alpine` base, and image tag `meshpulse-api:1.0.0`.
- **File destination:** Save as `docs/screenshots/01-docker-compose-build.png`.

### 📸 Screenshot 2: Orchestrated Deployment with Healthchecks
- **What to capture:** Terminal output executing `docker compose up -d`.
- **How to take it:** In terminal, execute `docker compose up -d` and capture the network creation, volume creation, and healthcheck wait sequence.
- **What evaluators check:** `condition: service_healthy` dependency ordering: cache starts and becomes healthy before API starts.
- **File destination:** Save as `docs/screenshots/02-docker-compose-up.png`.

### 📸 Screenshot 3: Docker Compose Process Table
- **What to capture:** Terminal output executing `docker compose ps`.
- **How to take it:** Run `docker compose ps` and capture all 4 containers side-by-side.
- **What evaluators check:** Status column displaying `(healthy)` across services, published port `8080->80/tcp`, and container names.
- **File destination:** Save as `docs/screenshots/03-docker-compose-ps.png`.

### 📸 Screenshot 4: Network Subnet Inspection
- **What to capture:** Terminal output executing `docker network inspect` on both custom networks.
- **How to take it:** In terminal, inspect `meshpulse-frontend-net` and `meshpulse-backend-net` subnets.
- **What evaluators check:** Two distinct subnets: `172.28.1.0/24` for frontend ingress and `172.28.2.0/24` for backend data tier.
- **File destination:** Save as `docs/screenshots/04-network-inspection.png`.

### 📸 Screenshot 5: DNS Service Discovery
- **What to capture:** Terminal output running `nslookup` across containers.
- **How to take it:** Execute `docker exec mesh-api nslookup cache` and `docker exec mesh-gateway nslookup api`.
- **What evaluators check:** Docker's embedded DNS server (`127.0.0.11`) resolving service names to internal bridge IPs.
- **File destination:** Save as `docs/screenshots/05-dns-service-discovery.png`.

### 📸 Screenshot 6: Zero-Trust Cross-Network Isolation
- **What to capture:** Terminal output attempting to connect from gateway to cache.
- **How to take it:** Execute `docker exec mesh-gateway nc -z -w 2 cache 6379` and ping backend IP `172.28.2.2`.
- **What evaluators check:** Output confirms `bad address` and `100% packet loss`, proving direct database exposure is physically blocked.
- **File destination:** Save as `docs/screenshots/06-network-isolation-test.png`.

### 📸 Screenshot 7: Storage Volume Inspection & Bind Mount Immutability
- **What to capture:** Terminal output executing `docker volume inspect meshpulse_redis_data` and write attempt on `nginx.conf`.
- **How to take it:** Run `docker volume inspect meshpulse_redis_data` followed by `docker exec mesh-gateway touch /etc/nginx/nginx.conf`.
- **What evaluators check:** Named volume metadata with student labels and `Read-only file system` error on the bind mount.
- **File destination:** Save as `docs/screenshots/07-storage-volume-inspect.png`.

### 📸 Screenshot 8: Volume Crash Recovery & Data Durability
- **What to capture:** Terminal execution setting key in Redis, stopping & removing container, launching fresh container, and recovering key.
- **How to take it:** Run `redis-cli SET`, `docker compose rm -f cache`, `docker compose up -d cache`, and `redis-cli GET`.
- **What evaluators check:** Complete recovery of key `eval_key` proving that the named volume preserved database state.
- **File destination:** Save as `docs/screenshots/08-storage-durability-recovery.png`.

### 📸 Screenshot 9: Automated CLI Validation Suite
- **What to capture:** Terminal output executing `npm run validate:network` and `npm run validate:storage`.
- **How to take it:** In terminal, execute both scripts sequentially and capture the summary tables.
- **What evaluators check:** Summary confirming `6 PASSED, 0 FAILED` for network and `4 PASSED, 0 FAILED` for storage.
- **File destination:** Save as `docs/screenshots/09-automated-validation-suite.png`.

### 📸 Screenshot 10: Interactive MeshPulse Live Dashboard
- **What to capture:** Web browser displaying the live portal running at `http://localhost:8080`.
- **How to take it:** Open `http://localhost:8080` in Chrome/Edge, click "Run DNS Probe", and capture with `Win + Shift + S`.
- **What evaluators check:** Live URL bar, student attribution (`Achindra Sharma - 2547105 - 4MCA A`), topology diagram, and storage recovery logs.
- **File destination:** Save as `docs/screenshots/10-meshpulse-live-dashboard.png`.
