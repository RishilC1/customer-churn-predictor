FROM node:20-alpine
WORKDIR /app

COPY package.json tsconfig.json index.html ./
COPY src ./src

RUN npm install --no-audit --no-fund
RUN npm run build

EXPOSE 5173
CMD ["npm", "run", "preview"]
