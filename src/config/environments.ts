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
    timeRelease: parseInt(process.env.TIME_RELEASE || "10800000"), // 3 horas por defecto
  },
  mapbox: {
    accessToken: process.env.MAPBOX_ACCESS_TOKEN || "",
  },
};

// Validaciones de configuración requerida
export const validateConfig = () => {
  const requiredVars = [
    { key: "DATABASE_URL", value: config.database.url },
    { key: "WHATSAPP_PHONE", value: config.whatsapp.phoneNumber },
    { key: "MAPBOX_ACCESS_TOKEN", value: config.mapbox.accessToken },
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
