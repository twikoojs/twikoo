FROM node:lts-slim AS build

RUN useradd -m app

USER root

RUN npm i -g tkserver

ADD https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 /usr/local/bin/cloudflared
RUN chmod +x /usr/local/bin/cloudflared

COPY ./src/start.sh /usr/bin/start.sh

USER app
WORKDIR /home/app/twikoo

CMD ["sh", "/usr/bin/start.sh"]
