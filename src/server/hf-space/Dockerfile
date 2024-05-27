FROM alpine AS build

RUN adduser -D app

USER root
RUN apk --no-cache add curl nodejs npm

RUN npm i tkserver -g

WORKDIR /home/app
RUN curl -LO https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x cloudflared-linux-amd64 && \
    mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

COPY ./src/start.sh /usr/bin/start.sh

USER app
WORKDIR /home/app/twikoo

CMD ["sh", "/usr/bin/start.sh"]
