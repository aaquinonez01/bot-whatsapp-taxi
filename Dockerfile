# Dockerfile optimizado para BuilderBot Taxi App según documentación oficial
FROM node:21-alpine3.18

WORKDIR /app

# Crear directorio para sesiones de bot (persistencia según docs)
RUN mkdir -p /app/bot_sessions && chmod 777 /app/bot_sessions

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Generar Prisma Client
RUN npx prisma generate

# Construir la aplicación
RUN npm run build

# Exponer puerto
EXPOSE 3008

# Comando para iniciar la aplicación con configuración optimizada para BuilderBot
CMD ["node", "--max-old-space-size=1024", "dist/app.js"]