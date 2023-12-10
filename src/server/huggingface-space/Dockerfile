FROM node:18

ARG MONGODB_URI

RUN git clone https://github.com/twikoojs/twikoo.git

WORKDIR /twikoo/src/server/self-hosted/

RUN yarn

EXPOSE 8080

CMD ["node", "server.js"]
