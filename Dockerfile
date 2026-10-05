FROM node:22-slim
WORKDIR /app
# package.json macht "type": "module" ausdrücklich (sonst erkennt Node ES-Module nur an der Syntax)
COPY package.json ./
COPY src ./src
COPY public ./public
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/fvz.sqlite TZ=Europe/Berlin
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
CMD ["node", "--no-warnings", "src/main.ts"]
