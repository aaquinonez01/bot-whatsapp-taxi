// Configuración e imports principales
import { createBot, createProvider, createFlow } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";

// Configuración
import { config, validateConfig } from "./config/environments.js";

// Servicios
import { DriverService } from "./services/driver.service.js";
import { RequestService } from "./services/request.service.js";
import { NotificationService } from "./services/notification.service.js";

// Flujos
import {
  mainFlow,
  quickTaxiFlow,
  supportFlow,
  infoFlow,
  fallbackFlow,
  goodbyeFlow,
} from "./flows/main.flow.js";

import {
  taxiFlow,
  taxiAssignedFlow,
  postTimeoutFlow,
  cancelRequestFlow,
  statusFlow,
  completeRideFlow,
  checkTimeoutFlow,
  setTaxiFlowServices,
} from "./flows/taxi.flow.js";

import {
  driverAcceptFlow,
  driverRejectFlow,
  driverRegisterFlow,
  driverStatusFlow,
  driverLocationFlow,
  driverInfoFlow,
  setDriverFlowServices,
} from "./flows/driver.flow.js";

const main = async () => {
  try {
    console.log("🚀 Iniciando Taxi Cooperativa Bot...");

    // Validar configuración
    validateConfig();
    console.log("✅ Configuración validada");

    // Crear adaptadores con optimización
    const adapterProvider = createProvider(Provider, {
      experimentalStore: config.baileys.experimentalStore,
      timeRelease: config.baileys.timeRelease,
      usePairingCode: config.whatsapp.usePairingCode,
      phoneNumber: config.whatsapp.phoneNumber,
    });

    const adapterDB = new Database();
    console.log("✅ Adaptadores creados");

    // Inicializar servicios
    const driverService = new DriverService();
    const requestService = new RequestService();
    const notificationService = new NotificationService(adapterProvider);
    console.log("✅ Servicios inicializados");

    // Configurar servicios en flujos
    setTaxiFlowServices(requestService, notificationService);
    setDriverFlowServices(driverService, requestService, notificationService);
    console.log("✅ Servicios configurados en flujos");

    // Crear flujo principal
    const adapterFlow = createFlow([
      // Flujos críticos que deben tener máxima prioridad
      taxiAssignedFlow,  // CRÍTICO: Limpiar estado cuando se asigna taxi
      postTimeoutFlow,   // Manejar interacciones post-timeout
      
      // Flujos principales
      mainFlow,
      quickTaxiFlow,
      supportFlow,
      infoFlow,

      // Flujos de taxi
      taxiFlow,
      cancelRequestFlow,
      statusFlow,
      completeRideFlow,
      checkTimeoutFlow,

      // Flujos de conductores
      driverAcceptFlow,
      driverRejectFlow,
      driverRegisterFlow,
      driverStatusFlow,
      driverLocationFlow,
      driverInfoFlow,

      // Flujos de control
      goodbyeFlow,
      fallbackFlow,
    ]);

    const { handleCtx, httpServer } = await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    });

    console.log("✅ Bot creado exitosamente");

    // Configurar endpoints API
    setupAPIEndpoints(
      adapterProvider,
      handleCtx,
      driverService,
      requestService,
      notificationService
    );

    // Configurar tareas programadas
    setupScheduledTasks(requestService, notificationService);

    // Iniciar servidor
    httpServer(config.server.port);
    console.log(`🌐 Servidor iniciado en puerto ${config.server.port}`);
    console.log("🚕 Taxi Cooperativa Bot listo para recibir mensajes!");
  } catch (error) {
    console.error("❌ Error iniciando la aplicación:", error);
    process.exit(1);
  }
};

// Configurar endpoints de la API
function setupAPIEndpoints(
  provider: Provider,
  handleCtx: any,
  driverService: DriverService,
  requestService: RequestService,
  notificationService: NotificationService
) {
  // Endpoint para enviar mensajes
  provider.server.post(
    "/v1/messages",
    handleCtx(async (bot: any, req: any, res: any) => {
      try {
        const { number, message, urlMedia } = req.body;
        await bot.sendMessage(number, message, { media: urlMedia ?? null });
        return res.end("sent");
      } catch (error) {
        console.error("Error sending message:", error);
        return res.status(500).end("error");
      }
    })
  );

  // Endpoint para registrar conductor
  provider.server.post(
    "/v1/driver/register",
    handleCtx(async (bot: any, req: any, res: any) => {
      try {
        const { name, phone, plate, location } = req.body;
        const result = await driverService.createDriver({
          name,
          phone,
          plate,
          location,
        });
        return res.json(result);
      } catch (error) {
        console.error("Error registering driver:", error);
        return res
          .status(500)
          .json({ success: false, error: "Internal server error" });
      }
    })
  );

  // Endpoint para estadísticas
  provider.server.get(
    "/v1/stats",
    handleCtx(async (bot: any, req: any, res: any) => {
      try {
        const [driverStats, requestStats] = await Promise.all([
          driverService.getDriverStats(),
          requestService.getRequestStats(),
        ]);

        return res.json({
          drivers: driverStats.data,
          requests: requestStats.data,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error getting stats:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    })
  );

  // Endpoint para listar conductores
  provider.server.get(
    "/v1/drivers",
    handleCtx(async (bot: any, req: any, res: any) => {
      try {
        const result = await driverService.getAllActiveDrivers();
        return res.json(result);
      } catch (error) {
        console.error("Error getting drivers:", error);
        return res
          .status(500)
          .json({ success: false, error: "Internal server error" });
      }
    })
  );

  // Endpoint para blacklist
  provider.server.post(
    "/v1/blacklist",
    handleCtx(async (bot: any, req: any, res: any) => {
      try {
        const { number, intent } = req.body;
        if (intent === "remove") bot.blacklist.remove(number);
        if (intent === "add") bot.blacklist.add(number);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ status: "ok", number, intent }));
      } catch (error) {
        console.error("Error managing blacklist:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    })
  );

  console.log("✅ Endpoints API configurados");
}

// Configurar tareas programadas
function setupScheduledTasks(
  requestService: RequestService,
  notificationService: NotificationService
) {
  // Limpiar solicitudes expiradas cada 30 minutos
  const cleanupInterval = config.taxi.cleanupIntervalMinutes * 60 * 1000;

  setInterval(async () => {
    try {
      const result = await requestService.cleanupExpiredRequests();
      if (result.success && result.data && result.data > 0) {
        console.log(
          `🧹 Limpieza automática: ${result.data} solicitudes expiradas canceladas`
        );
      }
    } catch (error) {
      console.error("Error en limpieza automática:", error);
    }
  }, cleanupInterval);

  console.log(
    `✅ Tareas programadas configuradas (limpieza cada ${config.taxi.cleanupIntervalMinutes} min)`
  );
}

main();
