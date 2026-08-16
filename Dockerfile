FROM node:26-alpine AS test
WORKDIR /app
COPY ./app /app
RUN npm ci && npm test

FROM node:26-alpine
WORKDIR /app
COPY ./app /app
RUN apk add --no-cache curl \
    && npm ci --omit=dev
EXPOSE 9000
ENTRYPOINT ["npm", "run", "start", "--"]
CMD ["--refreshIntervalInMS=60000"]
HEALTHCHECK --interval=30s --timeout=10s --retries=5 CMD wget -q -O- http://localhost:9000/metrics > /dev/null || exit 1
