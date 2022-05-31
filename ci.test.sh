#!/bin/sh
# cleanup
docker rmi -f kltest-live-server:latest
docker compose -f docker-compose.test.yml down -v --remove-orphans --rmi local
docker compose -f docker-compose.test.yml rm -svf

# build test env
docker compose -f docker-compose.test.yml up --force-recreate --always-recreate-deps --abort-on-container-exit --remove-orphans --renew-anon-volumes --timeout 1

# save output
docker logs -t kltest-live-server >& ci.test.log
docker sbom kltest-live-server:latest > sbom-kltest-live-server.test.log