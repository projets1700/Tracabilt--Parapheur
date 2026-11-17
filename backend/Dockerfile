FROM node:20-bookworm-slim

# LibreOffice (conversion DOCX ↔ PDF du module documentaire) sans interface graphique,
# + polices métriquement compatibles avec Calibri/Cambria/Arial/Times pour préserver
# la mise en page des documents Word.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui libreoffice-draw-nogui \
      fonts-liberation fonts-crosextra-carlito fonts-crosextra-caladea fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV LIBREOFFICE_BIN=soffice \
    UPLOADS_DIR=/app/uploads \
    LIBREOFFICE_PROFILS_DIR=/tmp/tracaparapheur-libreoffice

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/
RUN mkdir -p /app/uploads

EXPOSE 3001

# Lance la migration puis démarre le serveur
CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]
