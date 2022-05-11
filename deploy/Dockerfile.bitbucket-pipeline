FROM node:16-alpine
WORKDIR /usr/app
COPY ./node_modules ./node_modules
COPY ./dist .
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD node main.js
