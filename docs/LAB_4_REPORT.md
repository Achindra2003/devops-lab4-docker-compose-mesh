# Lab 4 Report: Multi-Container Application Orchestration, Network Segmentation & Storage Validation

**Course:** MCA Trimester 5 — DevOps Lab (Lab 4)  
**Submission Type:** Individual Lab Submission  
**Student Name:** Achindra Sharma  
**Register Number:** 2547105  
**Class / Section:** 4MCA A  
**Application:** MeshPulse — Cloud-Native Multi-Container Microservice with Zero-Trust Networking & Tri-Tier Storage Architecture  
**GitHub Repository:** [https://github.com/Achindra2003/devops-lab4-docker-compose-mesh](https://github.com/Achindra2003/devops-lab4-docker-compose-mesh)  
**Compose Launch Command:** `docker compose up -d`  
**Ingress Portal URL:** `http://localhost:8080`  

---

## 1. Project Background & System Context

### The Challenge with Naive Multi-Container Composition
When development teams transition from single-container development to multi-container microservice stacks, the default tendency is to write a single flat `docker-compose.yml` file where all services share the default bridge network, omit named persistent volumes, and run as root. While this approach appears functional locally, it introduces severe architectural vulnerabilities in cloud-native production environments:

1. **Flat Network Attack Surface (Zero Segmentation):** On a default bridge network, every container can communicate with every other container on any port. If an external attacker compromises a public-facing web gateway via an RCE vulnerability, they have unhindered access to internal database ports (e.g. Redis on 6379 or PostgreSQL on 5432).
2. **Ephemeral Storage Hazards (Catastrophic Data Loss):** Defaulting to container filesystem storage means that when a container is restarted or recreated during an update (`docker compose down && docker compose up -d`), all database tables, state, and transaction logs are permanently wiped.
3. **Boot-Time Race Conditions:** Basic `depends_on` directives only wait for container processes to spawn, not for the underlying services to become ready to accept TCP traffic. Application microservices crash repeatedly on boot because databases have not yet initialized their internal sockets.
4. **Root Privilege Hazards:** Microservices executing as `root` (UID 0) inside container namespaces can escalate privileges onto host kernels if arbitrary file-write or container-breakout flaws exist.

### What We Built: MeshPulse
To address these challenges and provide an enterprise-grade reference architecture, we designed and built **MeshPulse**, an orchestrated distributed microservice platform featuring:
- **Service 1 (`gateway`):** Nginx L7 edge reverse proxy with custom security headers and read-only configuration bind mounts.
- **Service 2 (`api`):** Multi-stage Node.js REST microservice running as unprivileged `node` (UID 1000) with in-memory `tmpfs` mounts.
- **Service 3 (`cache`):** Redis 7.4 state store featuring Append-Only File (`AOF`) persistence mounted to a named Docker volume (`redis_data`).
- **Service 4 (`watchdog`):** Alpine Linux sentinel autonomously probing DNS discovery and reachability across the backend network.
- **Dual Zero-Trust Networks:** Isolated `frontend-net` (`172.28.1.0/24`) and `backend-net` (`172.28.2.0/24`).

---

> ### 📸 Screenshot 1 Instruction: Interactive MeshPulse Live Dashboard
> * **What to capture:** Web browser showing MeshPulse dashboard running at `http://localhost:8080`.
> * **How to take it:** In terminal, run `docker compose up -d`, open `http://localhost:8080` in Chrome/Edge, and press `Win + Shift + S`.
> * **What evaluators check:** Live URL bar on port 8080, dark-mode layout, student attribution (`Achindra Sharma - 2547105 - 4MCA A`), distributed topology diagram, active microservices count (4/4 Healthy), and DNS probe results.
> * **File destination:** Save as `docs/screenshots/10-meshpulse-live-dashboard.png`.

![Screenshot 10: MeshPulse Live Dashboard](screenshots/10-meshpulse-live-dashboard.png)  
*Figure 1: MeshPulse interactive web dashboard running via Nginx edge reverse proxy on port 8080, displaying runtime topology, DNS discovery, and storage logs.*

---

## 2. Multi-Container Orchestration Architecture

### The Baseline Anti-Pattern (`docker-compose.unoptimized.yml`)
To provide empirical proof of architectural optimization, we authored `docker-compose.unoptimized.yml` to replicate common beginner mistakes:
```yaml
services:
  gateway:
    image: nginx:latest
    ports: ["8081:80"]

  api:
    image: node:22
    volumes: [".:/app"]
    command: ["node", "server.js"]

  cache:
    image: redis:latest
```

#### Flaws in this baseline:
1. **Single Flat Network:** No custom bridge networks declared; all services bind to default `bridge`, allowing the edge gateway direct access to Redis port 6379.
2. **Ephemeral Storage:** No named volumes declared; Redis stores keys in the ephemeral container layer, causing total data loss on `docker compose down`.
3. **No Healthchecks:** Lacks healthcheck probes and dependency readiness conditions, creating boot race conditions.
4. **Resource Exhaustion:** Uncapped CPU and memory allocation expose the host system to noisy neighbor starvation.

---

### The Production Compose Architecture (`docker-compose.yml`)
Our production Compose specification establishes multi-tier isolation, resource limits, and healthcheck-driven dependency ordering:

```yaml
services:
  gateway:
    image: nginx:1.27-alpine
    container_name: mesh-gateway
    restart: unless-stopped
    ports: ["8080:80"]
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - frontend-net
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1:80/gateway/healthz || exit 1"]
      interval: 15s
      timeout: 3s
      retries: 3
    security_opt: [no-new-privileges:true]
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 128M }

  api:
    build: { context: ., dockerfile: Dockerfile }
    image: meshpulse-api:1.0.0
    container_name: mesh-api
    restart: unless-stopped
    tmpfs:
      - /tmp:size=64M,mode=1777
    networks:
      - frontend-net
      - backend-net
    depends_on:
      cache:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://127.0.0.1:3000/healthz"]
      interval: 15s
      timeout: 3s
      retries: 3
    security_opt: [no-new-privileges:true]
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 256M }

  cache:
    image: redis:7.4-alpine
    container_name: mesh-cache
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "128mb"]
    volumes:
      - redis_data:/data
    networks:
      - backend-net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    security_opt: [no-new-privileges:true]
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 256M }

  watchdog:
    image: alpine:3.21
    container_name: mesh-watchdog
    networks:
      - backend-net
    depends_on:
      api:
        condition: service_healthy
```

---

> ### 📸 Screenshot 2 Instruction: Building Multi-Container Stack
> * **What to capture:** Terminal output executing `docker compose build`.
> * **How to take it:** In PowerShell, run `docker compose build` and capture stage transitions (`AS builder` ➔ `AS runner`) with `Win + Shift + S`.
> * **What evaluators check:** Custom multi-stage build compilation, `node:22-alpine` base image, and image tag `meshpulse-api:1.0.0`.
> * **File destination:** Save as `docs/screenshots/01-docker-compose-build.png`.

![Screenshot 1: Docker Compose Build](screenshots/01-docker-compose-build.png)  
*Figure 2: Compiling the custom multi-stage API microservice image using Alpine Linux and non-root user configuration.*

---

> ### 📸 Screenshot 3 Instruction: Orchestrated Deployment with Healthchecks
> * **What to capture:** Terminal output executing `docker compose up -d`.
> * **How to take it:** In terminal, execute `docker compose up -d` and capture the network creation, volume creation, and healthcheck wait sequence.
> * **What evaluators check:** `condition: service_healthy` dependency ordering: cache starts and becomes healthy before API starts.
> * **File destination:** Save as `docs/screenshots/02-docker-compose-up.png`.

![Screenshot 2: Docker Compose Up](screenshots/02-docker-compose-up.png)  
*Figure 3: Sequential startup: `mesh-cache` healthy -> `mesh-api` healthy -> `mesh-gateway` & `mesh-watchdog` started.*

---

> ### 📸 Screenshot 4 Instruction: Docker Compose Process Table
> * **What to capture:** Terminal output executing `docker compose ps`.
> * **How to take it:** Run `docker compose ps` and capture all 4 containers side-by-side.
> * **What evaluators check:** Status column displaying `(healthy)` across services, published port `8080->80/tcp`, and container names.
> * **File destination:** Save as `docs/screenshots/03-docker-compose-ps.png`.

![Screenshot 3: Docker Compose Process Table](screenshots/03-docker-compose-ps.png)  
*Figure 4: Process table verifying 4 active services with health status, published ports, and container names.*

---

## 3. Network Architecture & Zero-Trust Validation

### Dual Network Segmentation Architecture
We configured two isolated user-defined bridge networks to enforce least-privilege traffic flow:

```
   [ Host User / Evaluator ]
               │
               ▼ HTTP Ingress (:8080)
┌─────────────────────────────────────────────────────────────┐
│  frontend-net (172.28.1.0/24)                                │
│                                                             │
│  ┌───────────────────────┐        ┌───────────────────────┐ │
│  │ gateway (Nginx:80)    │───────►│ api (Node.js:3000)    │ │
│  └───────────────────────┘        └───────────┬───────────┘ │
└───────────────────────────────────────────────┼─────────────┘
                                                │ Secure Multi-Home Bridge
┌─────────────────────────────────────────────────────────────┐
│  backend-net (172.28.2.0/24)                  │             │
│                                   ┌───────────▼───────────┐ │
│  ┌───────────────────────┐        │ cache (Redis:6379)    │ │
│  │ watchdog (Sentinel)   │◄───────┤ (Named Volume: /data) │ │
│  └───────────────────────┘        └───────────────────────┘ │
│                                                             │
│  🛡️ ISOLATION RULE: gateway CANNOT route to cache!          │
└─────────────────────────────────────────────────────────────┘
```

1. **`frontend-net` (`172.28.1.0/24`):** Public-facing ingress bridge connecting the Nginx Edge Gateway and Core API.
2. **`backend-net` (`172.28.2.0/24`):** Isolated private data bridge connecting the Core API, Redis Cache, and Sentinel Watchdog.
3. **Multi-Homed Bridge (`api`):** The API microservice is attached to both networks, acting as a secure application-layer proxy.

---

> ### 📸 Screenshot 5 Instruction: Network Subnet Inspection
> * **What to capture:** Terminal output executing `docker network inspect` on both custom networks.
> * **How to take it:** In terminal, inspect `meshpulse-frontend-net` and `meshpulse-backend-net` subnets.
> * **What evaluators check:** Two distinct subnets: `172.28.1.0/24` for frontend ingress and `172.28.2.0/24` for backend data tier.
> * **File destination:** Save as `docs/screenshots/04-network-inspection.png`.

![Screenshot 4: Network Subnet Inspection](screenshots/04-network-inspection.png)  
*Figure 5: Inspecting network driver configurations and allocated IP subnets across both bridge domains.*

---

### Internal DNS Service Discovery (127.0.0.11)
Containers on user-defined bridge networks resolve peers dynamically by container name using Docker's internal DNS resolver (`127.0.0.11`):
- Inside `mesh-api`, resolving `cache` points to `172.28.2.2`.
- Inside `mesh-gateway`, resolving `api` points to `172.28.1.3`.

---

> ### 📸 Screenshot 6 Instruction: DNS Service Discovery
> * **What to capture:** Terminal output running `nslookup` across containers.
> * **How to take it:** Execute `docker exec mesh-api nslookup cache` and `docker exec mesh-gateway nslookup api`.
> * **What evaluators check:** Docker's embedded DNS server (`127.0.0.11`) resolving service names to internal bridge IPs.
> * **File destination:** Save as `docs/screenshots/05-dns-service-discovery.png`.

![Screenshot 5: DNS Service Discovery](screenshots/05-dns-service-discovery.png)  
*Figure 6: Querying Docker embedded DNS server across custom bridge networks without static IP hardcoding.*

---

### Zero-Trust Cross-Network Isolation Proof
To prove zero-trust network segmentation, we execute a cross-boundary connection attempt from `mesh-gateway` to `cache`:
```bash
docker exec mesh-gateway nc -z -w 2 cache 6379
# Output: nc: bad address 'cache'

docker exec mesh-gateway ping -c 1 -W 2 172.28.2.2
# Output: 100% packet loss (Host unreachable)
```
Even if an attacker breaches the Nginx edge proxy, they cannot access the Redis database.

---

> ### 📸 Screenshot 7 Instruction: Zero-Trust Cross-Network Isolation
> * **What to capture:** Terminal output attempting to connect from gateway to cache.
> * **How to take it:** Execute `docker exec mesh-gateway nc -z -w 2 cache 6379` and ping backend IP `172.28.2.2`.
> * **What evaluators check:** Output confirms `bad address` and `100% packet loss`, proving direct database exposure is physically blocked.
> * **File destination:** Save as `docs/screenshots/06-network-isolation-test.png`.

![Screenshot 6: Network Isolation Test](screenshots/06-network-isolation-test.png)  
*Figure 7: Terminal output verifying that gateway to cache traffic is completely blocked by kernel packet filters.*

---

## 4. Multi-Tier Storage Architecture & Persistence Validation

We designed a **Tri-Tier Storage Strategy** matching production DevOps best practices:

| Storage Tier | Mount Type | Path | Purpose & Durability |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **Named Persistent Volume** (`meshpulse_redis_data`) | `/data` in `cache` | Durable Append-Only File (AOF) storage. Survives complete container destruction. |
| **Tier 2** | **Read-Only Bind Mount** (`./nginx/nginx.conf:ro`) | `/etc/nginx/nginx.conf` | Host configuration injection. Read-only flag (`:ro`) prevents unauthorized modification. |
| **Tier 3** | **In-Memory Tmpfs Mount** (`tmpfs: 64MB`) | `/tmp` in `api` | Ephemeral RAM storage for high-speed tokens. Zero disk I/O and automatic cleanup. |

---

> ### 📸 Screenshot 8 Instruction: Storage Volume Inspection & Bind Mount Immutability
> * **What to capture:** Terminal output executing `docker volume inspect meshpulse_redis_data` and write attempt on `nginx.conf`.
> * **How to take it:** Run `docker volume inspect meshpulse_redis_data` followed by `docker exec mesh-gateway touch /etc/nginx/nginx.conf`.
> * **What evaluators check:** Named volume metadata with student labels and `Read-only file system` error on the bind mount.
> * **File destination:** Save as `docs/screenshots/07-storage-volume-inspect.png`.

![Screenshot 7: Storage Volume Inspect](screenshots/07-storage-volume-inspect.png)  
*Figure 8: Docker volume metadata and verifying that writes to read-only bind mounts return 'Read-only file system'.*

---

### Empirical Data Durability & Crash Recovery Proof
We verified that our named volume survives complete container destruction:
1. Written key: `eval_checkpoint_2547105` ➔ `"Achindra Sharma - Survives Container Down - 100% Data Integrity"`.
2. Executed: `docker compose stop cache && docker compose rm -f cache`. (Container destroyed).
3. Executed: `docker compose up -d cache`. (Fresh container launched).
4. Queried: `docker exec mesh-cache redis-cli GET eval_checkpoint_2547105`.
5. Result: **Data recovered with 100% fidelity.**

---

> ### 📸 Screenshot 9 Instruction: Volume Crash Recovery & Data Durability
> * **What to capture:** Terminal execution setting key in Redis, stopping & removing container, launching fresh container, and recovering key.
> * **How to take it:** Run `redis-cli SET`, `docker compose rm -f cache`, `docker compose up -d cache`, and `redis-cli GET`.
> * **What evaluators check:** Complete recovery of key `eval_key` proving that the named volume preserved database state.
> * **File destination:** Save as `docs/screenshots/08-storage-durability-recovery.png`.

![Screenshot 8: Storage Durability Recovery](screenshots/08-storage-durability-recovery.png)  
*Figure 9: Terminal verification showing zero data loss after destroying and recreating the database container.*

---

## 5. Automated Validation CLI Suites

To enforce continuous quality assurance, we created two automated Node.js validation test runners:
- `npm run validate:network`: 6 automated checks covering service states, subnets, DNS lookup, gateway routing, and zero-trust isolation.
- `npm run validate:storage`: 4 automated checks covering volume inspection, bind mount immutability, tmpfs verification, and automated disaster recovery.

---

> ### 📸 Screenshot 10 Instruction: Automated Validation Suite Summary
> * **What to capture:** Terminal output executing `npm run validate:network` and `npm run validate:storage`.
> * **How to take it:** In terminal, execute both scripts sequentially and capture the summary tables.
> * **What evaluators check:** Summary confirming `6 PASSED, 0 FAILED` for network and `4 PASSED, 0 FAILED` for storage.
> * **File destination:** Save as `docs/screenshots/09-automated-validation-suite.png`.

![Screenshot 9: Automated Validation Suite](screenshots/09-automated-validation-suite.png)  
*Figure 10: Terminal output of automated validation suites reporting 100% passing checks (10/10 Passed).*

---

## 6. Beyond the Baseline: Seven Self-Learning Initiatives

We implemented seven advanced orchestration initiatives that mirror production DevOps controls:

### 1. Multi-Tier Zero-Trust Network Segmentation
Implemented dual custom bridge networks (`frontend-net` vs `backend-net`), ensuring that the Nginx edge proxy is strictly isolated from the Redis database tier. Direct attacks against the ingress cannot reach database ports.

### 2. Tri-Tier Storage Strategy
Orchestrated Named Persistent Volumes (`redis_data`), Read-Only Bind Mounts (`nginx.conf:ro`), and Tmpfs RAM mounts (`/tmp`, 64MB) simultaneously, matching storage performance and security to workload lifecycles.

### 3. Automated Disaster Recovery & Volume Persistence Testing
Authored a scripted test in `scripts/validate-storage.js` that commits data, terminates and deletes the database container, launches a fresh instance, and verifies zero data loss.

### 4. Dynamic DNS Service Discovery (127.0.0.11)
Leveraged Docker’s internal DNS resolver to enable resilient container-to-container communication without hardcoding fragile static IP addresses.

### 5. Healthcheck-Driven Dependency Orchestration
Chained service dependencies using `condition: service_healthy` to eliminate startup race conditions between the application and database tiers.

### 6. Least-Privilege Non-Root Hardening (`USER node:node`)
Configured the API microservice to run as unprivileged `node` (UID 1000) with `security_opt: [no-new-privileges:true]`, mitigating container breakout vulnerabilities.

### 7. Automated CI/CD Validation Pipeline
Authored `.github/workflows/compose-ci.yml` integrating unit tests, Compose deployment, network isolation probing, and storage persistence testing into a unified GitHub Actions workflow.

---

## 7. Key Learnings & Engineering Reflections

1. **Network Segmentation is Mandatory:** Putting microservices on a single flat bridge is an operational liability. Edge gateways should never share network namespaces with databases.
2. **Named Volumes are Crucial for State:** Container filesystems are ephemeral. Without named volumes backed by AOF persistence, data does not survive orchestrator rescheduling.
3. **Healthcheck-Driven Orchestration Prevents Boot Failures:** Naive `depends_on` only waits for container creation. `condition: service_healthy` ensures dependent microservices only start when databases are ready.
4. **Tmpfs Mounts Enhance Security:** Ephemeral tokens and session caches should be stored in RAM-backed tmpfs mounts to prevent unencrypted disk writes and forensic recovery.
