#!/bin/sh
# =========================================================================
# MESHPULSE WATCHDOG SENTINEL SCRIPT
# MCA Trimester 5 - DevOps Lab 4
# Author: Achindra Sharma (2547105)
# =========================================================================

echo "[$(date -Iseconds)] [Watchdog Sentinel] Initializing backend network sentinel..."

while true; do
  echo "[$(date -Iseconds)] [Watchdog Sentinel] Probing backend network topology...";
  nc -z -w 2 cache 6379 && echo "  ✔ [DNS Check] Redis Cache reachable at cache:6379" || echo "  ✖ Cache unreachable";
  nc -z -w 2 api 3000 && echo "  ✔ [DNS Check] API Microservice reachable at api:3000" || echo "  ✖ API unreachable";
  sleep 15;
done
