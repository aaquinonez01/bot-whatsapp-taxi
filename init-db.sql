-- Database initialization script for Taxi Cooperativa
-- This script runs automatically when the PostgreSQL container starts

-- Set timezone to Ecuador
SET timezone = 'America/Guayaquil';

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant necessary privileges
GRANT ALL PRIVILEGES ON DATABASE taxi_db TO taxi_user;

-- Note: Prisma will handle table creation through migrations
-- This script is primarily for initial database setup and extensions