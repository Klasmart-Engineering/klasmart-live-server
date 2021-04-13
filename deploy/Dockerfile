FROM node:14
WORKDIR /usr/src/app
COPY ../package*.json ./
COPY ../node_modules ./node_modules
COPY ../src ./src
COPY ../tsconfig.json .

ENV JWT_ISSUER=kidsloop-live
ENV JWT_ALGORITHM=RS512 
ENV JWT_PRIVATE_KEY_FILENAME=private_key 
ENV JWT_PUBLIC_KEY_FILENAME=public_key
COPY ../private_key ./private_key
COPY ../public_key ./public_key

ENV PORT=8080
EXPOSE 8080
CMD [ "npm", "start" ]