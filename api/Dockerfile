# api/Dockerfile
FROM node:20-bullseye-slim
WORKDIR /app

# ensure openssl is present
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./tsconfig.json
COPY src ./src

EXPOSE 4000
CMD ["npm","run","dev"]
