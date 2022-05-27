#!/bin/sh
docker compose -f docker-compose.test.yml up

# docker sbom redis:alpine
# docker sbom kl-local-live-server:latest