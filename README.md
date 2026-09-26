# MeshPulse — Multi-Container Application Orchestration, Network & Storage Validation

**MCA Trimester 5 — DevOps Lab 4**  
**Author:** Achindra Sharma (2547105) — Section 4MCA A  
**Application:** MeshPulse Cloud-Native Distributed Microservice  

---

## Quick Start (Run Locally)

```bash
# 1. Start the complete multi-container stack
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

## Architectural Highlights

- **4-Tier Composition:** Nginx Edge Gateway (`gateway`), Node.js Core API (`api`), Redis Cache (`cache`), and Health Sentinel (`watchdog`).
- **Zero-Trust Network Segmentation:** Dual bridge networks (`frontend-net` 172.28.1.0/24 & `backend-net` 172.28.2.0/24). Gateway cannot connect to the database.
- **Tri-Tier Storage Strategy:** Named Persistent Volume (`redis_data`), Read-Only Bind Mount (`./nginx/nginx.conf:ro`), and Ephemeral In-Memory Tmpfs (`/tmp`).
- **Disaster Recovery Proof:** Automated script destroys the database container and proves 100% data recovery via named volumes.
- **Healthcheck-Driven Boot:** Services wait for dependencies to be healthy via `condition: service_healthy`.
- **Non-Root Hardening:** Microservices execute as unprivileged `USER node` (UID 1000).

---

## Deliverables & Documentation

- [Full Academic Lab Report (Markdown)](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/LAB_4_REPORT.md)
- [Printable Academic Lab Report (HTML)](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/LAB_4_REPORT.html)
- [Self-Learning Initiatives (7 Pillars)](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/SELF_LEARNING.md)
- [Evaluation Quick-Reference Cheat Sheet](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/EVALUATION_CHEAT_SHEET.md)
- [Report Screenshots (10 Figures)](file:///d:/Downloads/Trimester%205%20-%20DevOps/Lab%204/docs/screenshots)
