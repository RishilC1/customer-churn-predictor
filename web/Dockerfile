FROM node:20-alpine
WORKDIR /app

COPY package.json tsconfig.json index.html ./
COPY src ./src
COPY .dockerignore ./.dockerignore

RUN npm install --no-audit --no-fund

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
