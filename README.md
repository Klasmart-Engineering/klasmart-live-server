**Description:**

---

## How to set up locally


1. Clone repository, Recommended using **ssh+clone** to skip authentication every time
2. Run `npm i`  to install required packages
3. Install redis. Recommended to install them in docker, so install docker first.  `REDIS_MODE=CLUSTER` requires a functional cluster: https://dltlabs.com/blog/how-to-setup-configure-a-redis-cluster-easily-573120.
4. run `npm run test` to run unit && integration tests.
5. run `npm run build` to build the project.
6. run `npm run dev` to run in development.
7. run `npm start` to run build project from `./dist`.


## Run the service in a docker container

Build the container and run:

```shell
docker build -t kl-live-server .
```
make sure redis and kl-live-server containers run in same docker network.
if you don't have custom network you can create by `docker network create network-name` and set `--net network-name` while running container
```shell
docker run --rm -it \
  --name kl_live_server \
  --env REDIS_HOST=redis \
  --env REDIS_PORT=6379 \
  --env PORT=8080 \
  -p 8082:8080 \
  kl-live-server
```
## How to make PR

Start new branch off `master`  
When feature/bug_fixes are ready to merge, make \*\*\_PR*\*\* (Pull Request) targeting `master`

## How to make commit
We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0-beta.2/)

Common usage **[type]: description**  
Most used commit types:  
1. **fix** - patches a bug in your codebase (this correlates with PATCH in semantic versioning)  
2. **feat** - introduces a new feature to the codebase (this correlates with MINOR in semantic versioning)  
3. also **chore, test, style, refactor**

## How to control versioning 

We follow [Semantic Versioning](https://semver.org/)

1. ***major*** version when you make incompatible API changes  
2. ***minor*** version when you add functionality in a backwards compatible manner  
3. ***patch*** version when you make backwards compatible bug fixes  

**npm version <update_types>** will upgrade version and make commit.

## Running Integration Tests

This service contains integration tests that validate the live server API. Before opening new PRs developers should
validate their code by running integration tests.

### Prerequistes
The integration tests will start a live backend instance internally to test against, however they are also reliant on
a Redis instance being available.  If you do not have one available, you can start a Redis docker instance that will
work with the integration test configuration by running:

```
docker run --name live-redis -p 6379:6379 -d redis
```

### Running Integration Tests

Run integration tests with the following command:

```
npm run test:integration
```
