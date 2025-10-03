FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html ./index.html
COPY src ./src
EXPOSE 5173
CMD ["npm","run","dev","--","--host","0.0.0.0"]
