-- Script para crear la base de datos de Taxi Cooperativa
-- Ejecutar este script en PostgreSQL como superusuario

-- Crear la base de datos
CREATE DATABASE taxi_cooperativa;

-- Crear usuario específico (opcional, más seguro)
CREATE USER taxi_user WITH ENCRYPTED PASSWORD 'taxi_password';

-- Dar permisos al usuario
GRANT ALL PRIVILEGES ON DATABASE taxi_cooperativa TO taxi_user;

-- Conectarse a la nueva base de datos
\c taxi_cooperativa;

-- Dar permisos al usuario en la nueva base de datos
GRANT ALL ON SCHEMA public TO taxi_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO taxi_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO taxi_user;

-- Mostrar bases de datos disponibles
\l