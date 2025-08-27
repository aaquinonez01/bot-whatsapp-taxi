import "dotenv/config";

export const config = {
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://username:password@localhost:5432/taxi_cooperativa",
  },
  whatsapp: {
    phoneNumber: process.env.WHATSAPP_PHONE || "",
    usePairingCode: process.env.USE_PAIRING_CODE === "true",
  },
  server: {
    port: parseInt(process.env.PORT || "3008"),
  },
  taxi: {
    requestTimeoutMinutes: parseInt(
      process.env.REQUEST_TIMEOUT_MINUTES || "10"
    ),
    cleanupIntervalMinutes: parseInt(
      process.env.CLEANUP_INTERVAL_MINUTES || "30"
    ),
  },
  baileys: {
    experimentalStore: process.env.EXPERIMENTAL_STORE !== "false",
    timeRelease: parseInt(process.env.TIME_RELEASE || "900000"), // 15 minutos - más frecuente con 8GB RAM
    messageTimeout: parseInt(process.env.MESSAGE_TIMEOUT || "25000"), // 25 segundos - más agresivo
    maxRetries: parseInt(process.env.MAX_RETRIES || "3"),
    retryDelay: parseInt(process.env.RETRY_DELAY || "3000"), // 3 segundos - más rápido
    maxConcurrentMessages: parseInt(process.env.MAX_CONCURRENT_MESSAGES || "10"), // 10 con 2 CPUs
    sessionCleanupInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL || "180000"), // 3 minutos más frecuente
  },
  performance: {
    enableParallelNotifications: process.env.ENABLE_PARALLEL_NOTIFICATIONS !== "false",
    batchSize: parseInt(process.env.NOTIFICATION_BATCH_SIZE || "8"), // 8 conductores con 2 CPUs
    batchDelay: parseInt(process.env.BATCH_DELAY || "1200"), // 1.2 segundos más rápido
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || "30000"), // 30s más frecuente
    maxParallelBatches: parseInt(process.env.MAX_PARALLEL_BATCHES || "2"), // 2 lotes simultáneos
    memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || "6000"), // 6GB límite de memoria
  },
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  },
};

// Validaciones de configuración requerida
export const validateConfig = () => {
  const requiredVars = [
    { key: "DATABASE_URL", value: config.database.url },
    { key: "WHATSAPP_PHONE", value: config.whatsapp.phoneNumber },
    { key: "GOOGLE_MAPS_API_KEY", value: config.googleMaps.apiKey },
  ];

  const missingVars = requiredVars
    .filter(({ value }) => !value || value === "")
    .map(({ key }) => key);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }
};
