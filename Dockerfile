FROM node:20-alpine
LABEL org.opencontainers.image.source=https://github.com/thristhart/cyrclebot2025

RUN addgroup -S app --gid=1234 && adduser -S app -G app --uid 1234

COPY . /srv/cyrclebot
WORKDIR /srv/cyrclebot
RUN npm ci --workspaces

WORKDIR /srv/cyrclebot/packages/web
USER app
CMD npm start

EXPOSE 3000