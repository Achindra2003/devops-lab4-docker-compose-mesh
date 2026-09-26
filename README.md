# MeshPulse — Multi-Container Application Orchestration, Network & Storage Validation

[![Compose Services](https://img.shields.io/badge/Compose%20Services-4%2F4%20Healthy-10b981?style=flat&logo=docker&logoColor=white)](https://github.com/Achindra2003/devops-lab4-docker-compose-mesh)
[![Network Segmentation](https://img.shields.io/badge/Networking-Zero--Trust%20Dual%20Subnets-blue?style=flat&logo=wireguard&logoColor=white)](https://github.com/Achindra2003/devops-lab4-docker-compose-mesh)
[![Storage Architecture](https://img.shields.io/badge/Storage-Tri--Tier%20(Volume%20%7C%20Bind%20%7C%20Tmpfs)-purple?style=flat&logo=databricks&logoColor=white)](https://github.com/Achindra2003/devops-lab4-docker-compose-mesh)
[![Security Context](https://img.shields.io/badge/Security-Non--Root%20(UID%201000)-10b981?style=flat&logo=securityscorecard)](https://github.com/Achindra2003/devops-lab4-docker-compose-mesh)
[![Docker Compose](https://img.shields.io/badge/Compose%20Spec-v2.30%20Orchestration-orange?style=flat&logo=docker)](https://github.com/Achindra2003/devops-lab4-docker-compose-mesh)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **DevOps Lab 4:** Develop and deploy a multi-container application using Docker Compose or Podman. Compose and validate networking and storage.  
> **Course:** MCA Trimester 5 — DevOps Lab  
> **Submission Type:** Individual Lab Submission  
> **Student:** Achindra Sharma (2547105) — 4MCA A  
> **Repository:** [github.com/Achindra2003/devops-lab4-docker-compose-mesh](https://github.com/Achindra2003/devops-lab4-docker-compose-mesh)  
> **Ingress Dashboard URL:** [http://localhost:8080](http://localhost:8080)  

---

## Student Information

- **Name:** Achindra Sharma
- **Register Number:** 2547105
- **Class / Section:** 4MCA A
- **Course:** MCA Trimester 5 — DevOps Lab (Lab 4)

---

## 1. Project Overview

Rather than creating a toy multi-container setup with two unmonitored containers on a flat bridge network, we engineered **MeshPulse**, an enterprise-grade cloud-native distributed microservice platform featuring:
1. **Four-Tier Service Architecture:** Nginx L7 Edge Gateway, Multi-Stage Node.js Core API, Redis 7.4 State Store, and an Alpine Sentinel Watchdog.
2. **Zero-Trust Network Segmentation:** Dual isolated bridge networks (`frontend-net` 172.28.1.0/24 and `backend-net` 172.28.2.0/24), physically blocking direct communication between ingress proxies and backend databases.
3. **Tri-Tier Storage Strategy:** Named Persistent Volumes (`redis_data`), Read-Only Bind Mounts (`nginx.conf:ro`), and In-Memory Tmpfs RAM mounts (`/tmp`).
4. **Disaster Recovery Proof:** Automated verification proving that terminating and removing the database container results in **zero data loss** via Docker volume persistence.
5. **Healthcheck-Driven Orchestration:** Eliminating startup race conditions using `condition: service_healthy`.
6. **Interactive Dark-Mode Dashboard:** Live web portal at `http://localhost:8080` displaying real-time topology, DNS discovery, and storage logs.

---

## 2. Multi-Container Topology Diagram

```mermaid
graph TD
    User([Evaluator / Client]) -->|HTTP Ingress :8080| GW[mesh-gateway: Nginx 1.27]

    subgraph frontend-net [frontend-net: 172.28.1.0/24]
        GW -->|Proxy Pass :3000| API[mesh-api: Node.js 22 UID 1000]
    end

    subgraph backend-net [backend-net: 172.28.2.0/24]
        API -->|TCP RESP :6379| CACHE[(mesh-cache: Redis 7.4)]
        WD[mesh-watchdog: Sentinel] -.->|DNS & Health Ping| API
        WD -.->|DNS & Health Ping| CACHE
    end

    subgraph Storage Tiers
        VOL[(Volume: meshpulse_redis_data)] --- CACHE
        BIND[Bind Mount: nginx.conf:ro] --- GW
        TMPFS[Tmpfs: /tmp RAM Mount] --- API
    end

    classDef ingress fill:#1f6feb,stroke:#388bfd,stroke-width:2px,color:#fff;
    classDef bridge fill:#8957e5,stroke:#a371f7,stroke-width:2px,color:#fff;
    classDef data fill:#238636,stroke:#2ea043,stroke-width:2px,color:#fff;
    classDef sentinel fill:#6e7681,stroke:#8b949e,stroke-width:1px,color:#fff;

    class GW ingress;
    class API bridge;
    class CACHE data;
    class WD sentinel;
```

---

## 3. Architecture Benchmark: Baseline vs. Production MeshPulse

To provide empirical proof of architectural optimization, this repository contrasts `docker-compose.unoptimized.yml` against `docker-compose.yml`:

| Evaluation Metric | Baseline (`docker-compose.unoptimized.yml`) | Production (`docker-compose.yml`) | Improvement Delta |
| :--- | :--- | :--- | :--- |
| **Network Topology** | Single flat bridge (No segmentation) | Dual subnets (`frontend-net` & `backend-net`) | Lateral movement blocked |
| **Database Exposure** | Redis exposed directly to gateway | Isolated on backend-net (Zero-Trust) | Attack surface minimized |
| **Storage Durability** | Ephemeral container layer | Named Volume `redis_data` with AOF | Zero data loss on container recreation |
| **Configuration Security**| Uncontrolled host mounts | Read-Only Bind Mount (`nginx.conf:ro`) | Tamper-proof configuration |
| **Ephemeral Secrets** | Written to physical disk | In-Memory Tmpfs Mount (`/tmp`, 64MB) | Zero disk I/O, auto-wiped on restart |
| **Security User** | `root` (UID 0) across all services ⚠️ | `node` (UID 1000) with `no-new-privileges` ✔ | CIS Docker Benchmark 4.1 compliant |
| **Startup Ordering** | Basic `depends_on` (Race conditions) | `condition: service_healthy` | Deterministic, crash-free convergence |
| **Resource Limits** | Uncapped (Noisy Neighbor risk) | Capped CPU (0.5) and Memory (128M–256M) | Host resource exhaustion prevented |

---

## 4. Quick Start (Run Locally)

```bash
# 1. Start the complete multi-container stack in detached mode
docker compose up -d

# 2. Inspect active services and health status
docker compose ps

# 3. Access the interactive web dashboard
# Open in browser: http://localhost:8080

# 4. Run automated validation test suites
npm run validate:network
npm run validate:storage

# 5. Run automated microservice unit tests
npm test

# 6. Teardown stack
docker compose down
```

---

## 5. Verification Commands for Evaluator Demo

```bash
# A. Prove Zero-Trust Network Isolation (Gateway cannot connect to Redis)
docker exec mesh-gateway nc -z -w 2 cache 6379
# Output: nc: bad address 'cache'

# B. Prove Read-Only Bind Mount Immutability
docker exec mesh-gateway touch /etc/nginx/nginx.conf
# Output: touch: /etc/nginx/nginx.conf: Read-only file system

# C. Prove In-Memory Tmpfs RAM Mount
docker exec mesh-api df -T /tmp
# Output: Filesystem: tmpfs | Type: tmpfs | Mounted on: /tmp

# D. Prove Non-Root User Execution
docker exec mesh-api whoami
# Output: node (UID 1000)
```

---

## 6. Deliverables & Documentation Catalog

- 📄 **[Official PDF Lab Report (2547105_Lab4.pdf)](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/2547105_Lab4.pdf)** — Formal 9-page academic report with 10 annotated figures.
- 📝 **[Evaluation Quick Cheat Sheet](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/EVALUATION_CHEAT_SHEET.md)** — 90-second pitch, live demo commands, and viva Q&A.
- 📚 **[Full Academic Markdown Report](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/LAB_4_REPORT.md)** — Exhaustive documentation with screenshot instructions.
- 🌐 **[Printable Academic HTML Report](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/LAB_4_REPORT.html)** — Printable version for browser export.
- 💡 **[Self-Learning Initiatives (7 Pillars)](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/SELF_LEARNING.md)** — Advanced engineering breakdown.
- 📸 **[Screenshot Verification Guide](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/screenshots/README.md)** — Screenshot capture checkpoints and evaluation targets.
