FROM node:16-alpine
RUN mkdir -m 700 ~/.ssh; touch -m 600 ~/.ssh/known_hosts; ssh-keyscan bitbucket.org > ~/.ssh/known_hosts
WORKDIR /usr/app
RUN --mount=type=ssh npm ci
RUN --mount=type=ssh npm audit fix
COPY ./dist ./dist
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD [ "npm", "start" ]
