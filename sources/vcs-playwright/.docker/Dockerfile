ARG BASE_IMAGE=portal.works.prod.sbt:8999/sbt_docker/ci90000318_sbtws/base_images/mcr.microsoft.com/playwright:v1.57.0
FROM ${BASE_IMAGE}

WORKDIR /app

COPY package.json package-lock.json ./
ARG NPM_CONFIG_USERCONFIG=/run/secrets/tuz_npm_config
RUN --mount=type=secret,id=tuz_npm_config,required=true \
    npm install && \
    npm cache clean --force
