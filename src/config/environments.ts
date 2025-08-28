import "dotenv/config";

export const config = {
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://taxi_user:taxi_chat_bot@db_taxi:5432/taxi_db",
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
  builderbot: {
    // Configuración según documentación oficial de BuilderBot
    experimentalStore: process.env.EXPERIMENTAL_STORE === "true", // Debe ser explícitamente true
    timeRelease: parseInt(process.env.TIME_RELEASE || "10800000"), // 3 horas (recomendación oficial)
    usePairingCode: process.env.USE_PAIRING_CODE === "true",
    phoneNumber: process.env.WHATSAPP_PHONE || "",
  },
  queue: {
    // Configuración de queue según documentación oficial de BuilderBot
    timeout: parseInt(process.env.QUEUE_TIMEOUT || "20000"), // 20 segundos timeout
    concurrencyLimit: parseInt(process.env.QUEUE_CONCURRENCY_LIMIT || "15"), // 15 procesos concurrentes
  },
  performance: {
    enableParallelNotifications:
      process.env.ENABLE_PARALLEL_NOTIFICATIONS !== "false",
    batchSize: parseInt(process.env.NOTIFICATION_BATCH_SIZE || "8"), // 8 conductores con 2 CPUs
    batchDelay: parseInt(process.env.BATCH_DELAY || "1200"), // 1.2 segundos más rápido
    maxParallelBatches: parseInt(process.env.MAX_PARALLEL_BATCHES || "2"), // 2 lotes simultáneos
  },
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  },
};

// Validaciones de configuración requerida
export const validateConfig = () => {
  const requiredVars = [
    { key: "DATABASE_URL", value: config.database.url },
    { key: "WHATSAPP_PHONE", value: config.builderbot.phoneNumber },
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
