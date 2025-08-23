# Docker Setup for Taxi Cooperativa Bot

## Quick Start

1. **Clone and setup environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration (WHATSAPP_PHONE, GOOGLE_MAPS_API_KEY, etc.)
   ```

2. **Build and run (Production):**
   ```bash
   npm run docker:prod
   # or
   docker compose up -d
   ```

3. **View logs:**
   ```bash
   npm run docker:logs
   ```

4. **Stop services:**
   ```bash
   npm run docker:down
   ```

## Available Scripts

- `npm run docker:build` - Build the Docker image
- `npm run docker:up` - Start services in detached mode
- `npm run docker:down` - Stop and remove services
- `npm run docker:logs` - Show container logs
- `npm run docker:restart` - Restart services
- `npm run docker:clean` - Stop services and remove volumes
- `npm run docker:dev` - Start in development mode
- `npm run docker:prod` - Start in production mode

## Environment Variables

### Required Variables (must be set in .env):
- `WHATSAPP_PHONE` - Your WhatsApp phone number (with country code)
- `GOOGLE_MAPS_API_KEY` - Google Maps API key for geocoding

### Optional Variables (with defaults):
- `DB_USER=taxi_user` - Database username
- `DB_PASSWORD=taxi_chat_bot` - Database password  
- `DB_NAME=taxi_db` - Database name
- `USE_PAIRING_CODE=true` - Use WhatsApp pairing code
- `PORT=3008` - Application port
- `REQUEST_TIMEOUT_MINUTES=10` - Taxi request timeout
- `CLEANUP_INTERVAL_MINUTES=30` - Cleanup interval
- `EXPERIMENTAL_STORE=true` - Baileys experimental store
- `TIME_RELEASE=10800000` - Time release setting

## Architecture

### Services:
1. **taxi_app** - Main BuilderBot application
   - Port: 3008
   - Connects to PostgreSQL database
   - Persistent WhatsApp sessions

2. **db_taxi** - PostgreSQL database
   - Port: 5432 (exposed for external access if needed)
   - Persistent data storage
   - Health checks enabled

### Volumes:
- `postgres_data` - Database files
- `bot_sessions` - WhatsApp session data
- `app_logs` - Application logs

### Network:
- `taxi_network` - Internal bridge network for service communication

## Development Mode

For development with hot reload:

```bash
npm run docker:dev
```

This uses `docker-compose.dev.yml` which:
- Mounts source code for live editing
- Uses development Docker target
- Enables npm dev script with nodemon

## Health Checks

Both services include health checks:
- **Database**: Checks PostgreSQL connection
- **Application**: Checks API endpoint availability

## Troubleshooting

### Container won't start:
1. Check environment variables in `.env`
2. View logs: `npm run docker:logs`
3. Check service health: `docker compose ps`

### Database connection issues:
1. Ensure `DATABASE_URL` uses container name `db_taxi`
2. Wait for database health check to pass
3. Check database logs: `docker compose logs db_taxi`

### Port conflicts:
- Change port mappings in docker-compose.yml if needed
- Default ports: 3008 (app), 5432 (database)

### Reset everything:
```bash
npm run docker:clean  # This removes all volumes and data
npm run docker:up
```

## Production Deployment

1. Set `NODE_ENV=production` in .env
2. Configure proper secrets for production
3. Consider using Docker Swarm or Kubernetes for orchestration
4. Set up proper logging and monitoring
5. Configure SSL/TLS termination (reverse proxy)

## API Endpoints

Once running, the following endpoints are available:

- `GET /v1/stats` - Service statistics
- `POST /v1/messages` - Send WhatsApp messages
- `POST /v1/driver/register` - Register new driver
- `GET /v1/drivers` - List active drivers
- `POST /v1/blacklist` - Manage user blacklist

## Monitoring

- Health check endpoint: `http://localhost:3008/v1/stats`
- Database status: `docker compose exec db_taxi pg_isready`
- Application logs: `docker compose logs -f taxi_app`
- Database logs: `docker compose logs -f db_taxi`