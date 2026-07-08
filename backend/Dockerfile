FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/
RUN mkdir -p /app/uploads

EXPOSE 3001

# Lance la migration puis démarre le serveur
CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]