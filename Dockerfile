FROM node:22-slim
WORKDIR /app
COPY src ./src
COPY public ./public
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/fvz.sqlite TZ=Europe/Berlin
VOLUME /data
EXPOSE 8080
CMD ["node", "--no-warnings", "src/main.ts"]
