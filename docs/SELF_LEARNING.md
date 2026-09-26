# Self-Learning Report: Advanced Compose Orchestration, Zero-Trust Networking & Storage Architecture

**Course:** MCA Trimester 5 — DevOps Lab (Lab 4)  
**Student Name:** Achindra Sharma (2547105) — 4MCA A  
**Application:** MeshPulse — Cloud-Native Multi-Container Orchestration Platform  
**Context:** Developing, Composing & Validating Multi-Container Networking and Storage  

---

## 1. Why Go Beyond the Baseline?

The baseline assignment prompt for Lab 4 asks to:
> *"Develop and deploy a multi-container application using Docker Compose or Podman. Compose and validate networking and storage."*

A basic student submission could take two generic containers, link them over the default flat bridge network, mount an unmonitored host directory, and call it complete. However, in enterprise cloud-native DevOps architectures, containers are not isolated islands—they are the foundational building blocks of microservices, zero-trust service meshes, and distributed state machines.

We used Lab 4 as an opportunity to implement **seven advanced multi-container engineering initiatives** that mirror production DevOps controls used in enterprise organizations.

---

## 2. Initiative 1: Multi-Tier Zero-Trust Network Segmentation

### The Problem
When developers run standard `docker-compose.yml` configurations without custom networks, Docker places all containers on a single flat bridge network. On this flat network, every container can reach every other container on every port. If an external attacker exploits a vulnerability in a public-facing web gateway, they have direct, unhindered network access to internal state stores (e.g., Redis on 6379 or MongoDB on 27017).

### What We Implemented
In `docker-compose.yml`, we established two isolated bridge networks with custom subnets:
```yaml
networks:
  frontend-net:
    name: meshpulse-frontend-net
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.1.0/24

  backend-net:
    name: meshpulse-backend-net
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.2.0/24
```
- The **`gateway` (Nginx)** service binds **only** to `frontend-net`.
- The **`cache` (Redis)** and **`watchdog`** services bind **only** to `backend-net`.
- The **`api` (Node.js)** service is **multi-homed**, attached to both networks to act as a secure application-layer proxy.

### Engineering Impact
- An attacker compromising the Nginx reverse proxy cannot ping or open TCP sockets to `cache:6379`.
- Verified in terminal via:
  ```bash
  docker exec mesh-gateway nc -z -w 2 cache 6379 # Output: bad address
  docker exec mesh-gateway ping -c 1 172.28.2.2  # Output: 100% packet loss
  ```
- Satisfies **Zero-Trust Architecture (NIST SP 800-207)** by eliminating lateral movement within the container cluster.

---

## 3. Initiative 2: Tri-Tier Storage Architecture

### The Problem
Inexperienced developers often treat all storage mounts identically, either storing database files directly inside the container's ephemeral read-write layer or using loose bind mounts with write permissions for static configurations. This leads to accidental configuration tampering, performance bottlenecks, and catastrophic data loss during container recreation.

### What We Implemented
We designed a tri-tier storage hierarchy matching storage durability to data lifecycles:

```yaml
# Tier 1: Named Volume for Persistent Database State
volumes:
  redis_data:
    name: meshpulse_redis_data
    driver: local

# Service Mounts:
services:
  gateway:
    volumes:
      # Tier 2: Read-Only Bind Mount for Host Config
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro

  api:
    # Tier 3: In-Memory Tmpfs Mount for Ephemeral Tokens
    tmpfs:
      - /tmp:size=64M,mode=1777

  cache:
    volumes:
      - redis_data:/data
```

### Engineering Impact
- **Tier 1 (Named Volume):** Database state is managed by Docker in `/var/lib/docker/volumes/meshpulse_redis_data/_data`, decoupled from container lifecycles.
- **Tier 2 (Read-Only Bind Mount):** Host configuration is injected with `:ro`. Attempts to modify configuration from within the container return `Read-only file system`.
- **Tier 3 (Tmpfs Mount):** Ephemeral session tokens reside in host RAM. Eliminates physical disk write wear, guarantees sub-millisecond I/O, and automatically purges sensitive data on reboot.

---

## 4. Initiative 3: Automated Disaster Recovery & Volume Persistence Testing

### The Problem
Developers frequently assume that container volumes preserve data, but rarely test what happens during an unexpected crash, node drain, or forced recreation (`docker compose down`). Without verification, misconfigurations (such as forgetting the `AOF` flag in Redis) result in silent data corruption.

### What We Implemented
In `scripts/validate-storage.js`, we authored an automated end-to-end disaster recovery verification pipeline:
1. Commits key `eval_checkpoint_2547105` containing student metadata into the active Redis cache.
2. Triggers Redis `SAVE` to flush memory state to the Append-Only File on `/data`.
3. Issues `docker compose stop cache && docker compose rm -f cache` to completely terminate and delete the container.
4. Re-provisions a fresh Redis container attached to the existing named volume: `docker compose up -d cache`.
5. Automatically queries `redis-cli GET eval_checkpoint_2547105` and validates that the value matches with 100% cryptographic equality.

### Engineering Impact
- Empirically proves that data durability is preserved across container destruction.
- Ensures zero data loss during production rolling updates and automated node rescheduling.

---

## 5. Initiative 4: Dynamic DNS Service Discovery (127.0.0.11)

### The Problem
Hardcoding static container IP addresses (e.g. `172.28.1.3`) inside microservice configurations causes brittle deployments. If an instance restarts and acquires a new IP, dependent services break immediately.

### What We Implemented
We leveraged Docker’s embedded DNS server (`127.0.0.11`) configured automatically on user-defined bridge networks:
- In `server.js`, Node.js connects to `cache:6379` using standard domain resolution.
- In `nginx.conf`, the upstream proxy connects to `server api:3000`.
- Verified in terminal via:
  ```bash
  docker exec mesh-api nslookup cache
  # Output: Server 127.0.0.11 -> Address 172.28.2.2
  ```

### Engineering Impact
- Eliminates configuration coupling; containers can scale horizontally or restart without updating routing files.

---

## 6. Initiative 5: Healthcheck-Driven Dependency Orchestration

### The Problem
Standard Docker Compose `depends_on` only verifies that a container has been created and started at the OS process level. It does not check whether the daemon inside (e.g. Redis) is ready to accept TCP connections. When applications boot before their database is ready, they crash with connection errors (`ECONNREFUSED`).

### What We Implemented
We chained healthchecks using `condition: service_healthy`:
```yaml
services:
  gateway:
    depends_on:
      api:
        condition: service_healthy

  api:
    depends_on:
      cache:
        condition: service_healthy

  cache:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
```

### Engineering Impact
- Guarantees deterministic, sequential startup ordering: Redis becomes healthy first, then the API microservice initializes, and finally the Nginx edge gateway opens ingress traffic. Zero startup crashes.

---

## 7. Initiative 6: Least-Privilege Non-Root Hardening

### The Problem
Running microservices as `root` (UID 0) inside containers violates basic security hygiene. If an attacker exploits an application vulnerability, they inherit root privileges and can attempt container breakout exploits onto the host machine.

### What We Implemented
In `Dockerfile`:
```dockerfile
# Pre-create directory ownership
RUN chown -R node:node /app

# Switch to standard unprivileged node user (UID 1000)
USER node
```
In `docker-compose.yml`:
```yaml
security_opt:
  - no-new-privileges:true
```

### Engineering Impact
- Microservice runs under UID 1000.
- `no-new-privileges:true` prevents processes from gaining additional privileges via `setuid` binaries.
- Satisfies **CIS Docker Benchmark 4.1**.

---

## 8. Initiative 7: Automated CI/CD Validation Pipeline

### The Problem
Manual `docker compose up` commands on developer machines risk the "works on my machine" anti-pattern and lack automated regression testing.

### What We Implemented
In `.github/workflows/compose-ci.yml`, we created an automated pipeline that:
1. Runs automated unit tests on microservice logic (`npm test`).
2. Builds and launches the multi-container stack (`docker compose up -d --build`).
3. Waits for container healthchecks to reach `(healthy)`.
4. Executes automated network validation (`node scripts/validate-networking.js`).
5. Executes automated storage persistence testing (`node scripts/validate-storage.js`).
6. Tears down all resources cleanly with volume disposal (`docker compose down -v`).

### Engineering Impact
- Every code change is automatically audited for network isolation and volume durability before reaching production branches.

---

## 9. Synthesis Table of Self-Learning Initiatives

| Initiative | Technical Domain | Practical Operational Value |
| :--- | :--- | :--- |
| **Zero-Trust Dual Networks** | Network Security | Blocks direct database breaches from edge web ingress. |
| **Tri-Tier Storage Strategy** | Storage Engineering | Separates persistent state, immutable configs, and RAM tokens. |
| **Disaster Recovery Proof** | High Availability | Verifies zero data loss across container destruction. |
| **DNS Service Discovery** | Microservice Architecture| Eliminates static IP brittleness in cloud deployments. |
| **Healthcheck Orchestration** | Reliability | Prevents boot-time race conditions and startup crashes. |
| **Non-Root Hardening** | System Security | Thwarts container breakout and privilege escalation attacks. |
| **Automated Compose CI/CD** | Pipeline Automation | Enforces continuous regression testing of Compose topologies. |
