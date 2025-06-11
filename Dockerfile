FROM node:24-alpine
LABEL org.opencontainers.image.source=https://github.com/thristhart/cyrclebot2025

RUN addgroup -S app --gid=1234 && adduser -S app -G app --uid 1234

COPY . /srv/cyrclebot
WORKDIR /srv/cyrclebot
RUN npm ci

WORKDIR /srv/cyrclebot/
USER app
CMD npm run migrate; npm start

EXPOSE 3000