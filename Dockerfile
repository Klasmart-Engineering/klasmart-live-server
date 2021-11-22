FROM node:14
RUN mkdir -m 700 ~/.ssh; touch -m 600 ~/.ssh/known_hosts; ssh-keyscan bitbucket.org > ~/.ssh/known_hosts
WORKDIR /usr/src/app
COPY ./package*.json ./
RUN --mount=type=ssh npm ci
RUN --mount=type=ssh npm audit fix
COPY ./src ./src
COPY ./tsconfig.json .
COPY ./types ./types
COPY ./dist ./dist

ENV PORT=8080
EXPOSE 8080
CMD [ "npm", "start" ]
