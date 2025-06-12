FROM node:24-slim
LABEL org.opencontainers.image.source=https://github.com/thristhart/cyrclebot2025

# for node-gyp
RUN apt-get update && apt-get install -y python3 build-essential

RUN addgroup --system app --gid 1234 && adduser --system app --gid 1234 --uid 1234 --home /home/app

COPY . /srv/cyrclebot
WORKDIR /srv/cyrclebot
RUN npm ci

WORKDIR /srv/cyrclebot/
USER app
CMD npm run migrate; npm start

EXPOSE 3000