# Self-Learning Report: Advanced Compose Orchestration, Zero-Trust Networking & Storage Architecture

**Course:** MCA Trimester 5 — DevOps Lab (Lab 4)  
**Student Name:** Achindra Sharma (2547105) — 4MCA A  
**Application:** MeshPulse — Cloud-Native Multi-Container Orchestration Platform  

---

## 1. Why Go Beyond the Baseline?

The baseline prompt for Lab 4 asks to:
> *"Develop and deploy a multi-container application using Docker Compose or Podman. Compose and validate networking and storage."*

A basic student submission could connect two containers over the default bridge network, mount an empty folder, and call it a day. However, in enterprise cloud-native DevOps architectures, multi-container deployments represent complex microservice topologies requiring strict **Zero-Trust network segmentation**, **fault-tolerant storage tiers**, and **lifecycle health probing**.

We implemented **seven advanced self-learning initiatives** that mirror production DevOps controls.

---

## 2. The Seven Self-Learning Initiatives

### Initiative 1: Multi-Tier Zero-Trust Network Segmentation
- **The Problem:** Default Docker Compose attaches all containers to a single flat bridge network. An attacker compromising an Nginx web proxy has direct socket access to internal database ports (e.g. Redis on 6379).
- **What We Implemented:** We created dual subnets:
  - `frontend-net` (`172.28.1.0/24`): Connects `gateway` and `api`.
  - `backend-net` (`172.28.2.0/24`): Connects `api`, `cache`, and `watchdog`.
- **Engineering Impact:** `gateway` has NO route to `cache`. Queries to `nc -z cache 6379` from the gateway are blocked at the Linux kernel packet filtering level, satisfying zero-trust network principles.

---

### Initiative 2: Tri-Tier Storage Strategy
- **The Problem:** Beginners treat all storage mounts identically. In production, different data types require different durability and security guarantees.
- **What We Implemented:**
  1. **Named Persistent Volume (`redis_data`):** For database state. Retains data across container destruction.
  2. **Read-Only Bind Mount (`nginx.conf:ro`):** For host config injection. `:ro` ensures the container process cannot modify its own routing rules.
  3. **In-Memory Tmpfs Mount (`/tmp`, 64MB):** For ephemeral tokens. Stored in RAM, bypassing physical disk I/O and leaving zero forensic traces on reboot.

---

### Initiative 3: Automated Disaster Recovery & Volume Persistence Testing
- **The Problem:** Developers assume volumes work until a crash occurs and data is lost.
- **What We Implemented:** In `scripts/validate-storage.js`, we authored an end-to-end disaster recovery test:
  1. Commits key `eval_checkpoint_2547105` into Redis.
  2. Issues `docker compose stop cache && docker compose rm -f cache` to completely destroy the running database container.
  3. Launches a fresh container on the existing named volume: `docker compose up -d cache`.
  4. Automatically asserts that the key is recovered with 100% data integrity.

---

### Initiative 4: Dynamic DNS Service Discovery (127.0.0.11)
- **The Problem:** Hardcoding static IP addresses in microservice configs breaks container scaling and rescheduling.
- **What We Implemented:** We utilized Docker's internal DNS resolver (`127.0.0.11`). Microservices communicate strictly via service names (`http://api:3000`, `redis://cache:6379`), enabling dynamic IP assignment across restarts.

---

### Initiative 5: Healthcheck-Driven Dependency Orchestration
- **The Problem:** Standard Compose `depends_on` only waits for a container to *start*, not for it to be *ready*. If an API starts before Redis initializes its sockets, the API crashes on startup.
- **What We Implemented:** We chained healthchecks using `condition: service_healthy`:
  ```yaml
  api:
    depends_on:
      cache:
        condition: service_healthy
  gateway:
    depends_on:
      api:
        condition: service_healthy
  ```
  Containers converge in a strictly ordered, zero-crash startup sequence.

---

### Initiative 6: Least-Privilege Non-Root Hardening
- **The Problem:** Most Compose setups run all microservices as `root` (UID 0), creating severe container-escape hazards.
- **What We Implemented:**
  - Microservice executes as unprivileged `USER node` (UID 1000).
  - Configured `security_opt: [no-new-privileges:true]` across all services to prevent setuid binary privilege escalation.

---

### Initiative 7: Automated CI/CD Validation Pipeline
- **The Problem:** Manual `docker compose up` commands work on developer laptops but lack automated regression testing.
- **What We Implemented:** Authored `.github/workflows/compose-ci.yml`, which spins up an Ubuntu VM on push, executes unit tests, builds the multi-container stack, runs both automated network and storage validation suites, and shuts down cleanly.

---

## 3. Synthesis Table

| Initiative | Technical Domain | Practical Operational Value |
| :--- | :--- | :--- |
| **Zero-Trust Dual Networks** | Network Security | Blocks direct database breaches from edge web ingress. |
| **Tri-Tier Storage Strategy** | Storage Engineering | Separates persistent state, immutable configs, and RAM tokens. |
| **Disaster Recovery Proof** | High Availability | Verifies zero data loss across container destruction. |
| **DNS Service Discovery** | Microservice Architecture| Eliminates static IP brittleness in cloud deployments. |
| **Healthcheck Orchestration** | Reliability | Prevents boot-time race conditions and startup crashes. |
| **Non-Root Hardening** | System Security | Thwarts container breakout and privilege escalation attacks. |
| **Automated Compose CI/CD** | Pipeline Automation | Enforces continuous regression testing of Compose topologies. |
