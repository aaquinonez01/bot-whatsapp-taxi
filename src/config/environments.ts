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
    experimentalStore: false, // Deshabilitar para mayor estabilidad
    timeRelease: parseInt(process.env.TIME_RELEASE || "300000"), // 5 minutos - más frecuente para evitar Bad MAC
    messageTimeout: parseInt(process.env.MESSAGE_TIMEOUT || "20000"), // 20 segundos - reducido
    maxRetries: parseInt(process.env.MAX_RETRIES || "4"), // Más reintentos para Bad MAC
    retryDelay: parseInt(process.env.RETRY_DELAY || "2000"), // 2 segundos - más rápido
    maxConcurrentMessages: parseInt(process.env.MAX_CONCURRENT_MESSAGES || "5"), // Reducido para VPS
    sessionCleanupInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL || "120000"), // 2 minutos - más frecuente
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
