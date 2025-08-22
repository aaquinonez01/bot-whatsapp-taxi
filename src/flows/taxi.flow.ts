import { addKeyword, utils, EVENTS } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MemoryDB } from "@builderbot/bot";
import { MESSAGES } from "../constants/messages.js";
import { ValidationUtils } from "../utils/validation.js";
import { RequestService } from "../services/request.service.js";
import { NotificationService } from "../services/notification.service.js";
import { DriverService } from "../services/driver.service.js";
import { GeocodingService } from "../services/geocoding.service.js";
import { LocationData, RequestStatus } from "~/types/index.js";
import * as IdleCustom from "../utils/idle-custom.js";

// Flujo especial para limpiar estado cuando se asigna taxi
export const taxiAssignedFlow = addKeyword<BaileysProvider, MemoryDB>([
  "¡Taxi asignado!",
]).addAction(async (ctx, { state }) => {
  // Este flujo se activa cuando el cliente recibe el mensaje de asignación

  // Limpiar el timeout si existe
  const timeoutId = state.get("timeoutId");
  if (timeoutId) {
    clearTimeout(timeoutId);
    console.log(`🕐 Timeout limpiado para cliente ${ctx.from}`);
  }

  // Limpiar completamente el estado del cliente
  await state.clear();
});

// ELIMINADO postTimeoutFlow que causaba conflictos con driverAcceptFlow
// La lógica de timeout se maneja ahora en welcomeFlow y mainFlow

// Flujo que detecta y procesa ubicaciones GPS directamente
export const debugAllEventsFlow = addKeyword<BaileysProvider, MemoryDB>([
  /.*/, // Captura TODO pero con verificación de locationMessage
]).addAction(async (ctx, { flowDynamic, state }) => {
  // Verificar si es ubicación GPS PRIMERO
  const locationMessage = ctx.message?.locationMessage;

  if (locationMessage) {
    // Verificar si el usuario está esperando ubicación
    const clientName = state.get("clientName");

    if (clientName) {
      console.log("🎯 ===== PROCESANDO UBICACIÓN GPS DIRECTAMENTE =====");

      // Procesar la ubicación GPS aquí mismo
      const latitude = locationMessage.degreesLatitude;
      const longitude = locationMessage.degreesLongitude;
      const name = locationMessage.name || "Ubicación compartida";
      const address = locationMessage.address || `${latitude}, ${longitude}`;

      // Geocodificación automática
      let detectedSector = "Ubicación GPS";

      try {
        await flowDynamic("🔍 Detectando sector automáticamente...");

        if (!geocodingService) {
          throw new Error("geocodingService no está disponible");
        }

        const sector = await geocodingService.getSectorFromCoordinates(
          latitude,
          longitude
        );
        detectedSector = sector;

        await flowDynamic(`🏘️ Sector detectado: ${detectedSector}`);
      } catch (error) {
        console.error("❌ ERROR EN GEOCODIFICACIÓN:", error);
        console.error("❌ Error stack:", error.stack);
        console.error("❌ Error message:", error.message);
        await flowDynamic("⚠️ No se pudo detectar el sector automáticamente");
      }

      // Crear solicitud de taxi
      const locationData = {
        type: "whatsapp_location",
        latitude,
        longitude,
        name,
        address,
        formatted: `${name} - ${address}`,
      };

      const clientPhone = ctx.from;

      await state.update({
        clientLocation: locationData.formatted,
        clientLocationData: locationData,
        clientPhone: clientPhone,
      });

      const requestResult = await requestService.createTaxiRequest({
        clientName,
        clientPhone,
        location: locationData.formatted,
        sector: detectedSector,
        locationData: locationData as LocationData,
      });

      if (!requestResult.success) {
        await flowDynamic(`❌ ${requestResult.error}`);
        return;
      }

      const request = requestResult.data!;
      console.log("✅ SOLICITUD CREADA:", request.id);

      await state.update({
        requestId: request.id,
        isWaitingForDriver: true,
      });

      const notificationResult =
        await notificationService.sendToAllActiveDrivers(request);

      if (notificationResult.sent === 0) {
        await flowDynamic("❌ No hay conductores disponibles en este momento");
        await requestService.cancelRequest(
          request.id,
          "No hay conductores disponibles"
        );
        await state.clear();
        return;
      }

      await flowDynamic(
        `🔍 Buscando taxi disponible...\n✅ Se notificó a ${notificationResult.sent} conductores disponibles.\n⏳ Esperando respuesta de los conductores (máximo 20 segundos)...`
      );

      console.log(`✅ UBICACIÓN GPS PROCESADA COMPLETAMENTE: ${request.id}`);

      // Terminar aquí para que no siga a otros flujos
      return;
    }
  }

  // No interferir con otros mensajes normales
  return;
});

// Flujo para manejar ubicación de WhatsApp - CAMBIO A REGEX
export const taxiLocationFlow = addKeyword<BaileysProvider, MemoryDB>([
  /event_location/i, // Patrón para ubicaciones
]).addAction(async (ctx, { flowDynamic, state, gotoFlow }) => {
  try {
    // Verificar estado completo
    const fullState = await state.getMyState();
    console.log("🔍 Estado completo:", JSON.stringify(fullState, null, 2));

    // Verificar si el usuario está en proceso de solicitar taxi
    const clientName = state.get("clientName");

    if (!clientName) {
      console.log("❌ FLUJO DETENIDO: No hay clientName en el estado");
      // Usuario no está en proceso de solicitar taxi, ignorar ubicación
      return;
    }

    // Extraer datos de ubicación de WhatsApp
    const locationMessage = ctx.message?.locationMessage;

    if (!locationMessage) {
      console.log("❌ FLUJO DETENIDO: No hay locationMessage");
      await flowDynamic(
        "❌ No se pudo procesar la ubicación. Intenta nuevamente."
      );
      return;
    }

    const latitude = locationMessage.degreesLatitude;
    const longitude = locationMessage.degreesLongitude;
    const name = locationMessage.name || "Ubicación compartida";
    const address = locationMessage.address || `${latitude}, ${longitude}`;

    await flowDynamic(`✅ Ubicación recibida: ${name}`);
    if (address !== name) {
      console.log("💬 ENVIANDO MENSAJE: Dirección adicional");
      await flowDynamic(`📍 Dirección: ${address}`);
    }

    // 🆕 NUEVO: Detectar sector automáticamente usando Mapbox
    let detectedSector = "Ubicación GPS"; // Fallback por defecto

    try {
      await flowDynamic("🔍 Detectando sector automáticamente...");

      const sector = await geocodingService.getSectorFromCoordinates(
        latitude,
        longitude
      );
      detectedSector = sector;
      await flowDynamic(`🏘️ Sector detectado: ${detectedSector}`);
    } catch (error) {
      console.error("❌ ERROR EN GEOCODIFICACIÓN:", error);
      await flowDynamic("⚠️ No se pudo detectar el sector automáticamente");
    }

    console.log("🎯 GEOCODIFICACIÓN COMPLETADA, CONTINUANDO...");

    // Crear formato de ubicación que incluye coordenadas y texto
    const locationData = {
      type: "whatsapp_location",
      latitude,
      longitude,
      name,
      address,
      formatted: `${name} - ${address}`,
    };

    console.log(
      "📦 LOCATION DATA CREADO:",
      JSON.stringify(locationData, null, 2)
    );

    // Guardar ubicación en estado
    const clientPhone = ctx.from;

    await state.update({
      clientLocation: locationData.formatted,
      clientLocationData: locationData,
      clientPhone: clientPhone,
    });

    console.log("✅ ESTADO ACTUALIZADO CON UBICACIÓN");

    try {
      // Crear solicitud de taxi CON SECTOR AUTOMÁTICO
      const requestResult = await requestService.createTaxiRequest({
        clientName,
        clientPhone,
        location: locationData.formatted,
        sector: detectedSector, // 🆕 SECTOR AUTOMÁTICO
        locationData: locationData as LocationData,
      });

      console.log(
        "📊 Resultado de crear solicitud:",
        JSON.stringify(requestResult, null, 2)
      );

      if (!requestResult.success) {
        console.log("❌ FALLO AL CREAR SOLICITUD:", requestResult.error);
        await flowDynamic(`❌ ${requestResult.error}`);
        return;
      }

      const request = requestResult.data!;

      // Guardar ID de solicitud en estado y marcar como esperand
      await state.update({
        requestId: request.id,
        isWaitingForDriver: true,
      });

      // Notificar a todos los conductores activos
      const notificationResult =
        await notificationService.sendToAllActiveDrivers(request);

      console.log(
        "📊 Resultado de notificaciones:",
        JSON.stringify(notificationResult, null, 2)
      );

      if (notificationResult.sent === 0) {
        console.log("❌ NO HAY CONDUCTORES DISPONIBLES");
        // No hay conductores disponibles
        await flowDynamic(MESSAGES.TAXI.NO_DRIVERS_AVAILABLE);

        // Cancelar la solicitud automáticamente
        await requestService.cancelRequest(
          request.id,
          "No hay conductores disponibles"
        );
        return;
      }

      // Mensaje combinado: búsqueda, notificación y espera
      await flowDynamic(
        `🔍 Buscando taxi disponible...\n✅ Se notificó a ${notificationResult.sent} conductores disponibles.\n⏳ Esperando respuesta de los conductores (máximo 20 segundos)...`
      );

      // Configurar timeout de 20 segundos
      const timeoutId = setTimeout(async () => {
        try {
          // Verificar si la solicitud sigue pendiente
          const currentRequest = await requestService.getRequestById(
            request.id
          );

          if (
            currentRequest.success &&
            currentRequest.data?.status === "PENDING"
          ) {
            // Cancelar la solicitud
            await requestService.cancelRequest(
              request.id,
              "Timeout - ningún conductor aceptó en 20 segundos"
            );

            // Marcar que hubo timeout y limpiar resto del estado
            await state.clear();
            await state.update({ hadTimeout: true });

            // Enviar mensaje de timeout y menú
            try {
              await flowDynamic(
                "⏰ Ningún conductor ha aceptado tu solicitud en este momento."
              );
              await flowDynamic(
                [MESSAGES.GREETING, MESSAGES.MENU].join("\n\n")
              );
            } catch (flowError) {
              console.error(
                "Error sending timeout message via flowDynamic:",
                flowError
              );
              // Fallback: usar notificationService
              await notificationService.sendToClient(
                clientPhone,
                "⏰ Ningún conductor ha aceptado tu solicitud en este momento.\n\n" +
                  MESSAGES.GREETING +
                  "\n\n" +
                  MESSAGES.MENU
              );
            }

            console.log(`Request ${request.id} timed out after 20 seconds`);
          }
        } catch (error) {
          console.error("Error in timeout handler:", error);
        }
      }, 20000); // 20 segundos

      // Guardar el timeout ID en el estado
      await state.update({ timeoutId: timeoutId });
    } catch (error) {
      console.error("❌ ERROR EN TAXI LOCATION FLOW (catch interno):", error);
      console.error("📍 Stack trace:", error.stack);
      await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
    }
  } catch (error) {
    console.error(
      "❌ ERROR PROCESANDO UBICACIÓN WHATSAPP (catch externo):",
      error
    );
    console.error("📍 Stack trace:", error.stack);
    await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
  }
});

// Servicios globales (se inicializarán en app.ts)
let requestService: RequestService;
let notificationService: NotificationService;
let driverService: DriverService;
let geocodingService: GeocodingService;

// Función helper para procesar datos de ubicación
async function processLocationData(
  locationData: LocationData,
  ctx: any,
  state: any,
  flowDynamic: any,
  sector?: string
) {
  try {
    const clientName = state.get("clientName");
    const clientPhone = ctx.from;

    console.log(`👤 Client: ${clientName}, Phone: ${clientPhone}`);

    // Guardar ubicación en estado
    await state.update({
      clientLocation: locationData.formatted,
      clientLocationData: locationData,
      clientPhone: clientPhone,
    });

    // Crear solicitud de taxi CON SECTOR
    const requestPayload = {
      clientName,
      clientPhone,
      location: locationData.formatted,
      sector: sector || "Ubicación GPS", // 🆕 Usar sector detectado
      locationData: locationData,
    };

    const requestResult = await requestService.createTaxiRequest(
      requestPayload
    );

    if (!requestResult.success) {
      await flowDynamic(`❌ ${requestResult.error}`);
      return;
    }

    const request = requestResult.data!;

    // IMPORTANTE: Adjuntar locationData al request ya que no se guarda en DB
    request.locationData = locationData;

    console.log(
      "🗺️ Request with locationData:",
      JSON.stringify(
        {
          id: request.id,
          location: request.location,
          locationData: request.locationData,
        },
        null,
        2
      )
    );

    // Guardar ID de solicitud en estado y marcar como esperando
    await state.update({
      requestId: request.id,
      isWaitingForDriver: true,
    });

    // Notificar a todos los conductores activos
    const notificationResult = await notificationService.sendToAllActiveDrivers(
      request
    );

    if (notificationResult.sent === 0) {
      // No hay conductores disponibles
      await flowDynamic(MESSAGES.TAXI.NO_DRIVERS_AVAILABLE);

      // Cancelar la solicitud automáticamente
      await requestService.cancelRequest(
        request.id,
        "No hay conductores disponibles"
      );
      return;
    }

    // Mensaje combinado: búsqueda, notificación y espera
    await flowDynamic(
      `🔍 Buscando taxi disponible...\n✅ Se notificó a ${notificationResult.sent} conductores disponibles.\n⏳ Esperando respuesta de los conductores (máximo 20 segundos)...`
    );

    // Configurar timeout de 20 segundos
    const timeoutId = setTimeout(async () => {
      try {
        // Verificar si la solicitud sigue pendiente
        const currentRequest = await requestService.getRequestById(request.id);

        if (
          currentRequest.success &&
          currentRequest.data?.status === "PENDING"
        ) {
          // Cancelar la solicitud
          await requestService.cancelRequest(
            request.id,
            "Timeout - ningún conductor aceptó en 20 segundos"
          );

          // Marcar que hubo timeout y limpiar resto del estado
          await state.clear();
          await state.update({ hadTimeout: true });

          // Enviar mensaje de timeout y menú
          try {
            await flowDynamic(
              "⏰ Ningún conductor ha aceptado tu solicitud en este momento."
            );
            await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
          } catch (flowError) {
            console.error(
              "Error sending timeout message via flowDynamic:",
              flowError
            );
            // Fallback: usar notificationService
            await notificationService.sendToClient(
              clientPhone,
              "⏰ Ningún conductor ha aceptado tu solicitud en este momento.\n\n" +
                MESSAGES.GREETING +
                "\n\n" +
                MESSAGES.MENU
            );
          }
        }
      } catch (error) {
        console.error("Error in timeout handler:", error);
      }
    }, 20000); // 20 segundos

    // Guardar el timeout ID en el estado
    await state.update({ timeoutId: timeoutId });

    // Detener el timer de inactividad ya que el proceso se completó exitosamente
    IdleCustom.stop(ctx);
    console.log(
      `⏹️ Timer de inactividad detenido para usuario ${ctx.from} - solicitud creada exitosamente`
    );
  } catch (error) {
    console.error("Error in processLocationData:", error);
    await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);

    // En caso de error, también detener el timer
    IdleCustom.stop(ctx);
  }
}

export const setTaxiFlowServices = (
  reqService: RequestService,
  notifService: NotificationService,
  drvService: DriverService,
  geoService: GeocodingService
) => {
  requestService = reqService;
  notificationService = notifService;
  driverService = drvService;
  geocodingService = geoService;
};

export const taxiFlow = addKeyword<BaileysProvider, MemoryDB>(
  utils.setEvent("TAXI_FLOW")
)
  .addAction(async (ctx, { state, flowDynamic, gotoFlow }) => {
    // Verificar si el usuario ya expiró antes de continuar
    if (IdleCustom.isExpired(ctx)) {
      const wasExpired = await IdleCustom.cleanExpiredUser(ctx, state);
      if (wasExpired) {
        await flowDynamic(
          "⏰ Tu sesión anterior expiró por inactividad. Iniciando proceso nuevo..."
        );
        await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
        // Importar y redirigir al mainFlow para reiniciar completamente
        const { mainFlow } = await import("./main.flow.js");
        return gotoFlow(mainFlow);
      }
    }

    // Iniciar timer global de 5 minutos cuando comienza el flujo de taxi
    IdleCustom.start(ctx, 300000); // 5 minutos = 300000ms
  })
  .addAnswer(
    MESSAGES.TAXI.ASK_NAME,
    {
      capture: true,
      delay: 500,
    },
    async (ctx, { fallBack, flowDynamic, state, gotoFlow }) => {
      // Verificar si el usuario expiró mientras esperaba
      if (IdleCustom.isExpired(ctx)) {
        const wasExpired = await IdleCustom.cleanExpiredUser(ctx, state);
        if (wasExpired) {
          await flowDynamic(
            "⏰ Tu sesión expiró por inactividad (5+ minutos sin respuesta)."
          );
          await flowDynamic("Para tu comodidad, hemos reiniciado el proceso.");
          await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
          // Importar y redirigir al mainFlow para reiniciar completamente
          const { mainFlow } = await import("./main.flow.js");
          return gotoFlow(mainFlow);
        }
      }

      const name = ctx.body.trim();

      // Validar nombre
      const validation = ValidationUtils.validateName(name);

      if (!validation.isValid) {
        console.log("❌ VALIDACIÓN DE NOMBRE FALLÓ:", validation.error);
        return fallBack(validation.error || MESSAGES.VALIDATION.EMPTY_NAME);
      }
      // Guardar nombre en estado
      await state.update({ clientName: name });

      await flowDynamic(MESSAGES.TAXI.ASK_LOCATION);
    }
  )
  .addAction(
    { capture: true },
    async (ctx, { fallBack, flowDynamic, state, gotoFlow }) => {
      // Verificar si el usuario expiró mientras esperaba la ubicación
      if (IdleCustom.isExpired(ctx)) {
        const wasExpired = await IdleCustom.cleanExpiredUser(ctx, state);
        if (wasExpired) {
          await flowDynamic(
            "⏰ Tu sesión expiró por inactividad (5+ minutos sin respuesta)."
          );
          await flowDynamic("Para tu comodidad, hemos reiniciado el proceso.");
          await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
          // Importar y redirigir al mainFlow para reiniciar completamente
          const { mainFlow } = await import("./main.flow.js");
          return gotoFlow(mainFlow);
        }
      }

      const location = ctx.body.trim();
      // Detectar si es un evento de ubicación de WhatsApp
      if (location.includes("event_location_")) {
        // Esto es un evento de ubicación de WhatsApp pero no se procesó correctamente
        // Intentar extraer datos de ubicación del contexto
        const locationMessage = ctx.message?.locationMessage;

        if (locationMessage) {
          console.log("✅ LocationMessage found! Processing coordinates...");

          // Procesar como ubicación de WhatsApp
          const latitude = locationMessage.degreesLatitude;
          const longitude = locationMessage.degreesLongitude;
          const name = locationMessage.name || "Ubicación compartida";
          const address =
            locationMessage.address || `${latitude}, ${longitude}`;

          console.log(
            `📍 Extracted coordinates: lat=${latitude}, lng=${longitude}`
          );
          console.log(`📍 Name: ${name}`);
          console.log(`📍 Address: ${address}`);

          // Confirmar ubicación recibida
          await flowDynamic(`✅ Ubicación recibida: ${name}`);
          if (address !== name) {
            await flowDynamic(`📍 Dirección: ${address}`);
          }

          // 🆕 GEOCODIFICACIÓN AUTOMÁTICA CON MAPBOX
          let detectedSector = "Ubicación GPS";

          try {
            await flowDynamic("🔍 Detectando sector automáticamente...");

            console.log("🔥 LLAMANDO A GEOCODING SERVICE...");
            if (!geocodingService) {
              throw new Error("geocodingService no está disponible");
            }

            const sector = await geocodingService.getSectorFromCoordinates(
              latitude,
              longitude
            );
            detectedSector = sector;

            await flowDynamic(`🏘️ Sector detectado: ${detectedSector}`);
          } catch (error) {
            console.error("❌ ERROR EN GEOCODIFICACIÓN:", error);
            console.error("❌ Error stack:", error.stack);
            console.error("❌ Error message:", error.message);
            await flowDynamic(
              "⚠️ No se pudo detectar el sector automáticamente"
            );
          }

          // Crear formato de ubicación que incluye coordenadas y texto
          const locationData = {
            type: "whatsapp_location" as const,
            latitude,
            longitude,
            name,
            address,
            formatted: `${name} - ${address}`,
          };

          // Continuar con el procesamiento usando los datos de ubicación CON SECTOR
          await processLocationData(
            locationData,
            ctx,
            state,
            flowDynamic,
            detectedSector
          );
          return;
        } else {
          // Intentar buscar en otras propiedades posibles
          if (ctx.message) {
            console.log(
              "🔍 Searching for location data in other properties..."
            );
            for (const [key, value] of Object.entries(ctx.message)) {
              if (typeof value === "object" && value !== null) {
                console.log(`🔍 ${key}:`, JSON.stringify(value, null, 2));
              }
            }
          }

          // No se pudo extraer la ubicación, solicitar nuevamente
          return fallBack(
            "❌ No se pudo procesar la ubicación de WhatsApp. Por favor, envía tu ubicación nuevamente usando el botón de ubicación 📍 de WhatsApp."
          );
        }
      }

      // Procesar como dirección de texto
      const validation = ValidationUtils.validateLocation(location);

      if (!validation.isValid) {
        return fallBack(validation.error || MESSAGES.VALIDATION.EMPTY_LOCATION);
      }

      // Obtener datos del estado
      const clientName = state.get("clientName");
      const clientPhone = ctx.from;

      // Crear LocationData para direcciones de texto
      const locationData = ValidationUtils.createLocationData(location);

      // Usar función helper para procesar la ubicación
      await processLocationData(locationData, ctx, state, flowDynamic);
    }
  );

// Flujo para manejar cancelaciones
export const cancelRequestFlow = addKeyword<BaileysProvider, MemoryDB>([
  "cancelar",
  "cancel",
  "2",
])
  .addAction(async (ctx, { flowDynamic, endFlow, gotoFlow }) => {
    try {
      const userPhone = ctx.from;

      const driverResult = await driverService.getDriverByPhone(userPhone);

      if (driverResult.success && driverResult.data) {
        // Es un conductor registrado - mostrar mensaje personalizado y terminar
        return endFlow(MESSAGES.DRIVER_WELCOME);
      }

      // No es conductor - verificar si tiene solicitud pendiente

      // Verificar si el cliente tiene realmente una solicitud pendiente
      const pendingResult = await requestService.getClientPendingRequest(
        userPhone
      );

      if (!pendingResult.success || !pendingResult.data) {
        console.log(
          "❌ CancelRequestFlow: No pending requests found for client - going to mainFlow"
        );
        await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
        // Importar mainFlow dinámicamente para evitar dependencias circulares
        const { mainFlow } = await import("./main.flow.js");
        return gotoFlow(mainFlow);
      }

      console.log(
        `✅ CancelRequestFlow: Found pending request ${pendingResult.data.id} for client`
      );
      await flowDynamic(
        "🤔 ¿Estás seguro de que quieres cancelar tu solicitud de taxi?\n\n1️⃣ Sí, cancelar\n2️⃣ No, mantener solicitud"
      );
    } catch (error) {
      console.error("Error in cancelRequestFlow driver check:", error);
      // En caso de error, continuar con flujo normal
      await flowDynamic(
        "🤔 ¿Estás seguro de que quieres cancelar tu solicitud de taxi?\n\n1️⃣ Sí, cancelar\n2️⃣ No, mantener solicitud"
      );
    }
  })
  .addAnswer(
    "",
    {
      capture: true,
      delay: 500,
    },
    async (ctx, { flowDynamic, state }) => {
      const response = ctx.body.trim();

      if (response === "1") {
        try {
          const clientPhone = ctx.from;

          // Buscar solicitud pendiente del cliente
          const pendingResult = await requestService.getClientPendingRequest(
            clientPhone
          );

          if (!pendingResult.success) {
            await flowDynamic(
              "ℹ️ No tienes solicitudes pendientes para cancelar."
            );
            return;
          }

          // Cancelar solicitud
          const cancelResult = await requestService.cancelRequest(
            pendingResult.data!.id,
            "Cancelada por el cliente"
          );

          if (cancelResult.success) {
            // Limpiar estado y marcar que se puede usar el menu
            await state.clear();
            await state.update({ hadTimeout: true });

            await flowDynamic("✅ Tu solicitud de taxi ha sido cancelada.");
            await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
          } else {
            await flowDynamic(
              "❌ Error al cancelar la solicitud. Intenta nuevamente."
            );
          }
        } catch (error) {
          console.error("Error canceling request:", error);
          await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
        }
      } else if (response === "2") {
        await flowDynamic(
          "✅ Solicitud mantenida. Esperando asignación de conductor..."
        );
      } else {
        await flowDynamic(
          "❌ Opción inválida. Presiona:\n1️⃣ Para cancelar\n2️⃣ Para mantener tu solicitud"
        );
      }
    }
  );

// Flujo para verificar estado cuando hay timeout
export const checkTimeoutFlow = addKeyword<BaileysProvider, MemoryDB>([
  "estado",
  "status",
  "que paso",
  "mi taxi",
  "taxi",
]).addAction(async (ctx, { flowDynamic, gotoFlow }) => {
  try {
    const clientPhone = ctx.from;

    // Buscar si tiene una solicitud cancelada recientemente por timeout
    const recentRequests = await requestService.getRequestsByFilters({
      clientPhone: clientPhone,
      status: RequestStatus.CANCELLED,
    });

    if (recentRequests.success && recentRequests.data) {
      const timeoutRequest = recentRequests.data.find(
        (req) =>
          req.updatedAt &&
          Date.now() - req.updatedAt.getTime() < 60000 && // Menos de 1 minuto
          req.status === "CANCELLED"
      );

      if (timeoutRequest) {
        await flowDynamic("⏰ Ningún conductor aceptó tu solicitud anterior.");
        await flowDynamic("💡 ¿Te gustaría intentar nuevamente?");

        // Importar y mostrar menú
        const { mainFlow } = await import("./main.flow.js");
        return gotoFlow(mainFlow);
      }
    }
  } catch (error) {
    console.error("Error checking timeout status:", error);
  }
});

// Flujo para consultar estado de solicitud
export const statusFlow = addKeyword<BaileysProvider, MemoryDB>([
  "estado",
  "status",
  "mi solicitud",
]).addAction(async (ctx, { flowDynamic }) => {
  try {
    const clientPhone = ctx.from;

    // Buscar solicitud pendiente o asignada del cliente
    const pendingResult = await requestService.getClientPendingRequest(
      clientPhone
    );

    if (pendingResult.success && pendingResult.data) {
      const request = pendingResult.data;
      const timeElapsed = Math.floor(
        (Date.now() - request.createdAt.getTime()) / 1000 / 60
      );

      if (request.status === "PENDING") {
        await flowDynamic(
          `⏳ Tu solicitud está pendiente (${timeElapsed} min)`
        );
        await flowDynamic("🔍 Aún buscando conductor disponible...");
      } else if (request.status === "ASSIGNED" && request.driver) {
        await flowDynamic(`✅ ¡Taxi asignado!`);
        await flowDynamic(`👤 Conductor: ${request.driver.name}`);
        await flowDynamic(`🚗 Placa: ${request.driver.plate}`);
        await flowDynamic(`📱 Teléfono: ${request.driver.phone}`);
      }
    } else {
      await flowDynamic("ℹ️ No tienes solicitudes activas.");
      await flowDynamic("💡 Escribe *menu* para solicitar un taxi.");
    }
  } catch (error) {
    console.error("Error checking status:", error);
    await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
  }
});

// Flujo para completar carrera (para conductores)
export const completeRideFlow = addKeyword<BaileysProvider, MemoryDB>([
  "completar",
  "terminar",
  "finalizar",
]).addAction(async (ctx, { flowDynamic }) => {
  try {
    const driverPhone = ctx.from;

    // Verificar si es un conductor registrado
    const driverService = new (
      await import("../services/driver.service.js")
    ).DriverService();
    const driverResult = await driverService.getDriverByPhone(driverPhone);

    if (!driverResult.success) {
      await flowDynamic(MESSAGES.VALIDATION.DRIVER_NOT_FOUND);
      return;
    }

    // Buscar carreras asignadas al conductor
    const assignedRequests = await requestService.getRequestsByFilters({
      status: RequestStatus.ASSIGNED,
    });

    if (!assignedRequests.success || !assignedRequests.data) {
      await flowDynamic("ℹ️ No tienes carreras activas para completar.");
      return;
    }

    // Filtrar solicitudes asignadas a este conductor
    const driverRequests = assignedRequests.data.filter(
      (req) =>
        req.driver?.phone === ValidationUtils.cleanPhoneNumber(driverPhone)
    );

    if (driverRequests.length === 0) {
      await flowDynamic("ℹ️ No tienes carreras activas para completar.");
      return;
    }

    // Si hay múltiples, tomar la más antigua
    const requestToComplete = driverRequests[0];

    // Completar la carrera
    const completeResult = await requestService.completeRequest(
      requestToComplete.id
    );

    if (completeResult.success) {
      await flowDynamic("✅ Carrera completada exitosamente.");
      await flowDynamic(`👤 Cliente: ${requestToComplete.clientName}`);

      // Notificar al cliente que la carrera fue completada
      await notificationService.sendToClient(
        requestToComplete.clientPhone,
        "✅ Tu carrera ha sido completada. ¡Gracias por usar Taxi Cooperativa!"
      );
    } else {
      await flowDynamic(
        "❌ Error al completar la carrera. Intenta nuevamente."
      );
    }
  } catch (error) {
    console.error("Error completing ride:", error);
    await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
  }
});

// Flujo simplificado - no necesario con el nuevo sistema de timeout global
// El timeout se maneja ahora directamente en cada verificación de flows
export const idleFlow = addKeyword<BaileysProvider, MemoryDB>(
  "__idle_placeholder__"
).addAction(async (ctx, { flowDynamic, endFlow }) => {
  // Este flow ya no se usa directamente, el timeout se maneja en cada flow
  console.log(
    `ℹ️ idleFlow llamado para ${ctx.from} - redirigiendo a menú principal`
  );
  await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
  // eslint-disable-next-line builderbot/func-prefix-endflow-flowdynamic
  return endFlow();
});
