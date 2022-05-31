#!/bin/sh
docker compose -f docker-compose.test.yml down
docker compose -f docker-compose.test.yml rm
docker compose -f docker-compose.test.yml up --abort-on-container-exit --remove-orphans --renew-anon-volumes --timeout 1

docker logs -t kltest-live-server > ci-test.log

# docker sbom redis:alpine
# docker sbom kl-local-live-server:latest 