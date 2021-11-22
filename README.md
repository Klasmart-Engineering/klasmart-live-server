**Description:**

---

## How to set up locally


1. Clone repository, Recomended using **ssh+clone** to skip authentication every time
2.  Run ***npm i***  to install required packages
3. Install redis and posgress. Recomended to install them in docker, so install docker first
4. To install and run redis:  ***docker run -p 6379:6379 -d redis***
5. To install and run posgress:  ***docker run -e POSTGRES_PASSWORD=kidsloop -e POSTGRES_USER=postgres -p 5432:5432 -d postgres***
6. Add ***DATABASE_URL=postgres://postgres:kidsloop@localhost*** in ***.env*** *(steps 5 and 6 will be moved to kidsloop-attendance-service soon)*
7. Finally run ***npm start***.


## How to make PR

Project has `master` and `alpha` (dev) branches. `master` branch contains production ready code.  
If there are any feature/bug_fixes need to be added. Start new branch onto `alpha`.  
When feature/bug_fixes are ready to merge, make ***PR*** (Pull Request) targeting `alpha`.

## How to make commit
We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0-beta.2/)

Common usage **[type]: description**  
Most used commit types:  
1. **fix** - patches a bug in your codebase (this correlates with PATCH in semantic versioning)  
2. **feat** - introduces a new feature to the codebase (this correlates with MINOR in semantic versioning)  
3. also **chore, test, style, refactor**

## How to controll versioning 

We follow [Semantic Versioning](https://semver.org/)

1. ***major*** version when you make incompatible API changes  
2. ***minor*** version when you add functionality in a backwards compatible manner  
3. ***patch*** version when you make backwards compatible bug fixes  

**npm version <update_types>** will upgrade version and make commit.
