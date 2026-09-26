# Lab 4 Evaluation Quick-Reference Cheat Sheet
**Course:** MCA Trimester 5 — DevOps Lab (Lab 4)  
**Student Name:** Achindra Sharma  
**Register Number:** 2547105  
**Class / Section:** 4MCA A  
**Application:** MeshPulse — Cloud-Native Multi-Container Orchestration, Zero-Trust Networking & Storage Architecture  
**GitHub Repository:** [https://github.com/Achindra2003/devops-lab4-docker-compose-mesh](https://github.com/Achindra2003/devops-lab4-docker-compose-mesh)  
**Live Ingress URL:** `http://localhost:8080`  
**Full Report:** [LAB_4_REPORT.md](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/LAB_4_REPORT.md) | [2547105_Lab4.pdf](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/2547105_Lab4.pdf)  

---

## 1. The 90-Second Elevator Pitch (Read or Deliver This Confidently)

> *"Good morning Sir/Ma'am. My name is Achindra Sharma, Register Number 2547105, Section 4MCA A.*
>
> *For Lab 4, the prompt was to **develop and deploy a multi-container application using Docker Compose, and validate networking and storage**.*
>
> *I designed and deployed **MeshPulse** — a four-tier distributed microservice stack featuring an Nginx L7 Edge Gateway, a multi-stage Node.js Core API, an append-only Redis cache, and an autonomous health sentinel.*
>
> *Key engineering highlights:*
> 1. *Implemented **Zero-Trust Network Segmentation** across two isolated bridge networks: `frontend-net` (172.28.1.0/24) for public ingress and `backend-net` (172.28.2.0/24) for the data tier. The edge gateway has NO route to the database, preventing direct exploitation.*
> 2. *Validated a **Tri-Tier Storage Strategy**: Named Persistent Volumes (`redis_data`), Read-Only Bind Mounts (`nginx.conf:ro`), and In-Memory Tmpfs RAM mounts (`/tmp`).*
> 3. *Empirically proved **Disaster Recovery**: destroyed the running Redis database container and launched a fresh one on the existing volume with **zero data loss**.*
> 4. *Eliminated startup race conditions using **healthcheck-driven orchestration (`condition: service_healthy`)** and hardened services with **non-root user privileges (UID 1000)**.*
> 5. *Built an interactive dark-mode web portal at `http://localhost:8080` and automated CLI test suites validating networking and storage with 100% passing checks.*
>
> *Allow me to demonstrate the live multi-container environment and our validation tests."*

---

## 2. Live Terminal Demo Commands (Windows Ready)

### Step 1: Start the Multi-Container Composition
```bash
docker compose up -d
docker compose ps
```
> *Point out: "All 4 containers (mesh-gateway, mesh-api, mesh-cache, mesh-watchdog) are active and healthy."*

### Step 2: Open the Interactive Browser Dashboard
Open in your browser:
👉 **`http://localhost:8080`**
- Show the **Attribution Banner**: `Achindra Sharma (2547105) - 4MCA A`.
- Show the **Distributed Topology Diagram**: Gateway ➔ API ➔ Cache.
- Click **"Run DNS Probe"**: Demonstrates dynamic service discovery across subnets.
- Click **"Write Record"** followed by **"Read Records"**: Demonstrates live commits to the named volume `redis_data`.
- Click **"Test Tmpfs"**: Demonstrates in-memory RAM storage at `/tmp`.

---

### Step 3: Run the Automated Validation Suites in Terminal
```bash
# Automated Network Validation (6/6 Checks Passed)
npm run validate:network

# Automated Storage Validation (4/4 Checks Passed)
npm run validate:storage
```
> *Point out: "These scripts automatically test DNS resolution, subnet isolation, bind mount read-only immutability, and end-to-end container crash recovery."*

---

### Step 4: Prove Zero-Trust Network Isolation (The Security "Money Shot")
Ask the evaluator: *"Would you like to see proof that the edge gateway cannot touch the database?"*
```bash
# Try to reach Redis cache from the Nginx edge gateway:
docker exec mesh-gateway nc -z -w 2 cache 6379
# Output: nc: bad address 'cache'

# Try to ping the backend IP directly:
docker exec mesh-gateway ping -c 1 -W 2 172.28.2.2
# Output: 1 packets transmitted, 0 packets received, 100% packet loss
```
> *Say: "This proves Zero-Trust network segmentation. Even if an attacker breaches the Nginx web server, they cannot reach or ping the Redis database on the backend network."*

---

### Step 5: Prove Read-Only Bind Mount Immutability
```bash
docker exec mesh-gateway touch /etc/nginx/nginx.conf
# Output: touch: /etc/nginx/nginx.conf: Read-only file system
```
> *Say: "The `:ro` flag ensures that the container cannot modify its own configuration file, preventing unauthorized proxy tampering."*

---

## 3. Rubric Requirements Mapping

| Assignment Requirement | What You Implemented | Evidence File / Figure |
| :--- | :--- | :--- |
| **Develop multi-container app** | 4-tier microservice architecture: Nginx Gateway, Node.js API, Redis Cache, Sentinel | [docker-compose.yml](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docker-compose.yml), Figure 1 |
| **Deploy using Docker Compose** | Healthcheck-driven dependency ordering with resource limits and non-root hardening | Figure 2 & Figure 3 |
| **Validate networking** | Dual subnets (`frontend-net` & `backend-net`), DNS discovery (`127.0.0.11`), and Zero-Trust isolation | `npm run validate:network`, Figure 5, 6, 7 |
| **Validate storage** | Named Volume (`redis_data`), Read-Only Bind Mount (`nginx.conf:ro`), and Tmpfs Mount (`/tmp`) | `npm run validate:storage`, Figure 8, 9 |

---

## 4. The 7 Self-Learning Initiatives (Your Extra Efforts)

1. **Zero-Trust Network Segmentation:** Dual subnets (`172.28.1.0/24` and `172.28.2.0/24`) keeping database completely unreachable from ingress.
2. **Tri-Tier Storage Hierarchy:** Orchestrating Named Persistent Volumes, Read-Only Bind Mounts, and Tmpfs RAM mounts simultaneously.
3. **Automated Disaster Recovery Testing:** Scripted verification proving zero data loss when database container is destroyed and recreated.
4. **Dynamic DNS Service Discovery:** Services resolve each other by name via Docker internal DNS (`127.0.0.11`) without static IPs.
5. **Healthcheck-Driven Dependency Orchestration:** Using `condition: service_healthy` to eliminate startup race conditions.
6. **Least-Privilege Non-Root Hardening:** Microservice runs as `USER node` (UID 1000) with `no-new-privileges:true`.
7. **Automated CI/CD Validation Pipeline:** GitHub Actions workflow executing unit tests, Compose deployment, and validation test suites.

---

## 5. Report Screenshot Quick-Reference Guide

| If Evaluator Asks About... | Point to This in Report | Key Numbers / Facts to Highlight |
| :--- | :--- | :--- |
| **Live Web Dashboard** | **Figure 1** (Page 1) | Interactive MeshPulse UI at `http://localhost:8080`, dark mode, student attribution. |
| **Compose Build** | **Figure 2** (Page 2) | Multi-stage build of `meshpulse-api:1.0.0` (138MB, UID 1000). |
| **Compose Startup** | **Figure 3** (Page 2) | Sequential boot: Cache healthy ➔ API healthy ➔ Gateway active. |
| **Process Table** | **Figure 4** (Page 3) | 4/4 services healthy with ports `8080:80` and bound networks. |
| **Subnet Inspection** | **Figure 5** (Page 3) | `172.28.1.0/24` (frontend) and `172.28.2.0/24` (backend). |
| **DNS Service Discovery** | **Figure 6** (Page 4) | Internal DNS `127.0.0.11` resolving `cache` to `172.28.2.2`. |
| **Zero-Trust Isolation** | **Figure 7** (Page 4) | Gateway to Cache blocked (100% packet loss, address unresolved). |
| **Storage Inspection** | **Figure 8** (Page 5) | `meshpulse_redis_data` volume inspect & `Read-only file system` error. |
| **Disaster Recovery Proof** | **Figure 9** (Page 5) | Destroying container and recovering key `eval_checkpoint_2547105` intact. |
| **Automated CLI Suites** | **Figure 10** (Page 6) | 10/10 automated validation checks passed. |

---

## 6. Viva & Evaluator Trap Questions (Instant Model Answers)

### Q1: "What is the difference between a default bridge network and a custom user-defined bridge network in Docker?"
> *"Default bridge connects all containers on a flat network and requires legacy container linking for DNS. Custom user-defined bridge networks provide automatic internal DNS resolution by container name (via `127.0.0.11`) and allow network segmentation so containers on different custom bridges cannot talk to each other without explicit multi-homing."*

### Q2: "What is the difference between a named volume, a bind mount, and a tmpfs mount?"
> *"1. **Named Volume:** Managed directly by the Docker daemon inside `/var/lib/docker/volumes/`. Ideal for database persistence because it survives container destruction and is OS-independent.*  
> *2. **Bind Mount:** Directly maps a specific file or folder from the host filesystem into the container (e.g. `./nginx/nginx.conf`). Great for host configs; marked `:ro` to prevent container tampering.*  
> *3. **Tmpfs Mount:** Stored purely in host RAM. It never touches physical storage, provides maximum I/O performance, and automatically wipes data on container restart (great for secret tokens)."*

### Q3: "Why did you use `condition: service_healthy` instead of basic `depends_on`?"
> *"Basic `depends_on` only waits for the dependency container to start running at the OS process level. It does not wait for the application inside (like Redis or PostgreSQL) to be ready to accept TCP connections. This causes race conditions where the API crashes on startup. Using `condition: service_healthy` ensures dependent containers only start once the healthcheck passes."*

### Q4: "How does Docker’s embedded DNS server work?"
> *"Every container attached to a user-defined network has its `/etc/resolv.conf` configured to point to `127.0.0.11`. When a container requests a domain name (like `cache`), Docker's embedded DNS server intercepts the query on UDP port 53 and resolves it to the internal IP allocated to that container on that specific bridge network."*

### Q5: "What is the security risk of having only one flat network for all containers in Compose?"
> *"If a web proxy or frontend has a Remote Code Execution (RCE) vulnerability, an attacker who gains access to the container can directly access database ports (e.g., Redis on 6379, Postgres on 5432) across the network. By segmenting into `frontend-net` and `backend-net`, the database is physically unreachable from the ingress proxy at the kernel packet filter level."*
