# Dockerfile simple para BuilderBot Taxi App
FROM node:21-alpine3.18

WORKDIR /app

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

# Crear directorio para sesiones
RUN mkdir -p bot_sessions

# Exponer puerto
EXPOSE 3008

# Comando para iniciar la aplicación
CMD ["node", "dist/app.js"]