FROM node:20-bullseye-slim
WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund

COPY src ./src
RUN mkdir -p /app/data

EXPOSE 4000
CMD ["npm", "run", "start"]
