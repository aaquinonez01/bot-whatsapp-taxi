import { addKeyword, utils, EVENTS } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MemoryDB } from "@builderbot/bot";
import { MESSAGES } from "../constants/messages.js";
import { ValidationUtils } from "../utils/validation.js";
import { RequestService } from "../services/request.service.js";
import { NotificationService } from "../services/notification.service.js";
import { LocationData, RequestStatus } from "~/types/index.js";

// Flujo especial para limpiar estado cuando se asigna taxi
export const taxiAssignedFlow = addKeyword<BaileysProvider, MemoryDB>([
  "¡Taxi asignado!"
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
  console.log(`✅ Estado limpiado para cliente ${ctx.from} después de asignación de taxi`);
});

// ELIMINADO postTimeoutFlow que causaba conflictos con driverAcceptFlow
// La lógica de timeout se maneja ahora en welcomeFlow y mainFlow

// Flujo para manejar ubicación de WhatsApp
export const taxiLocationFlow = addKeyword<BaileysProvider, MemoryDB>(
  EVENTS.LOCATION
).addAction(async (ctx, { flowDynamic, state, gotoFlow }) => {
  try {
    console.log("🗺️ LOCATION FLOW ACTIVATED");
    console.log("📱 ctx.body:", ctx.body);
    console.log("📍 ctx.message:", JSON.stringify(ctx.message, null, 2));
    
    // Verificar si el usuario está en proceso de solicitar taxi
    const clientName = state.get("clientName");
    console.log("👤 clientName from state:", clientName);
    
    if (!clientName) {
      console.log("❌ No client name in state, ignoring location");
      // Usuario no está en proceso de solicitar taxi, ignorar ubicación
      return;
    }

    // Extraer datos de ubicación de WhatsApp
    const locationMessage = ctx.message?.locationMessage;
    console.log("📍 locationMessage:", JSON.stringify(locationMessage, null, 2));
    
    if (!locationMessage) {
      await flowDynamic("❌ No se pudo procesar la ubicación. Intenta nuevamente.");
      return;
    }

    const latitude = locationMessage.degreesLatitude;
    const longitude = locationMessage.degreesLongitude;
    const name = locationMessage.name || "Ubicación compartida";
    const address = locationMessage.address || `${latitude}, ${longitude}`;

    // Confirmar ubicación recibida
    await flowDynamic(`✅ Ubicación recibida: ${name}`);
    if (address !== name) {
      await flowDynamic(`📍 Dirección: ${address}`);
    }

    // Crear formato de ubicación que incluye coordenadas y texto
    const locationData = {
      type: 'whatsapp_location',
      latitude,
      longitude,
      name,
      address,
      formatted: `${name} - ${address}`
    };

    // Guardar ubicación en estado
    const clientPhone = ctx.from;
    await state.update({
      clientLocation: locationData.formatted,
      clientLocationData: locationData,
      clientPhone: clientPhone,
    });

    try {
      // Crear solicitud de taxi
      const requestResult = await requestService.createTaxiRequest({
        clientName,
        clientPhone,
        location: locationData.formatted,
        locationData: locationData as LocationData
      });

      if (!requestResult.success) {
        await flowDynamic(`❌ ${requestResult.error}`);
        return;
      }

      const request = requestResult.data!;

      // Guardar ID de solicitud en estado y marcar como esperando
      await state.update({ 
        requestId: request.id,
        isWaitingForDriver: true 
      });

      // Notificar a todos los conductores activos
      const notificationResult =
        await notificationService.sendToAllActiveDrivers(request);

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
        `🔍 Buscando taxi disponible...\n✅ Se notificó a ${notificationResult.sent} conductores disponibles.\n⏳ Esperando respuesta de los conductores (máximo 20 segundos)...\n\n❌ Presiona "2" para cancelar tu solicitud`
      );

      console.log(
        `Taxi request created: ${request.id} for ${clientName} - Notified ${notificationResult.sent} drivers`
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
      console.error("Error in taxi location flow:", error);
      await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
    }
  } catch (error) {
    console.error("Error processing WhatsApp location:", error);
    await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
  }
});

// Servicios globales (se inicializarán en app.ts)
let requestService: RequestService;
let notificationService: NotificationService;

// Función helper para procesar datos de ubicación
async function processLocationData(
  locationData: LocationData, 
  ctx: any, 
  state: any, 
  flowDynamic: any
) {
  try {
    console.log("🔄 PROCESSING LOCATION DATA:");
    console.log("📍 LocationData received:", JSON.stringify(locationData, null, 2));
    
    const clientName = state.get("clientName");
    const clientPhone = ctx.from;

    console.log(`👤 Client: ${clientName}, Phone: ${clientPhone}`);

    // Guardar ubicación en estado
    await state.update({
      clientLocation: locationData.formatted,
      clientLocationData: locationData,
      clientPhone: clientPhone,
    });

    console.log("💾 State updated with location data");

    // Crear solicitud de taxi
    const requestPayload = {
      clientName,
      clientPhone,
      location: locationData.formatted,
      locationData: locationData
    };
    
    console.log("📤 Creating taxi request with payload:", JSON.stringify(requestPayload, null, 2));
    
    const requestResult = await requestService.createTaxiRequest(requestPayload);

    if (!requestResult.success) {
      await flowDynamic(`❌ ${requestResult.error}`);
      return;
    }

    const request = requestResult.data!;
    
    // IMPORTANTE: Adjuntar locationData al request ya que no se guarda en DB
    request.locationData = locationData;
    
    console.log("🗺️ Request with locationData:", JSON.stringify({
      id: request.id,
      location: request.location,
      locationData: request.locationData
    }, null, 2));

    // Guardar ID de solicitud en estado y marcar como esperando
    await state.update({ 
      requestId: request.id,
      isWaitingForDriver: true 
    });

    // Notificar a todos los conductores activos
    const notificationResult = await notificationService.sendToAllActiveDrivers(request);

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
      `🔍 Buscando taxi disponible...\n✅ Se notificó a ${notificationResult.sent} conductores disponibles.\n⏳ Esperando respuesta de los conductores (máximo 20 segundos)...\n\n❌ Presiona "2" para cancelar tu solicitud`
    );

    console.log(
      `Taxi request created: ${request.id} for ${clientName} - Notified ${notificationResult.sent} drivers`
    );

    // Configurar timeout de 20 segundos
    const timeoutId = setTimeout(async () => {
      try {
        // Verificar si la solicitud sigue pendiente
        const currentRequest = await requestService.getRequestById(request.id);

        if (currentRequest.success && currentRequest.data?.status === "PENDING") {
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
            await flowDynamic("⏰ Ningún conductor ha aceptado tu solicitud en este momento.");
            await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
          } catch (flowError) {
            console.error("Error sending timeout message via flowDynamic:", flowError);
            // Fallback: usar notificationService
            await notificationService.sendToClient(
              clientPhone,
              "⏰ Ningún conductor ha aceptado tu solicitud en este momento.\n\n" +
                MESSAGES.GREETING + "\n\n" + MESSAGES.MENU
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
    console.error("Error in processLocationData:", error);
    await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
  }
}

export const setTaxiFlowServices = (
  reqService: RequestService,
  notifService: NotificationService
) => {
  requestService = reqService;
  notificationService = notifService;
};

export const taxiFlow = addKeyword<BaileysProvider, MemoryDB>(
  utils.setEvent("TAXI_FLOW")
)
  .addAnswer(
    MESSAGES.TAXI.ASK_NAME,
    {
      capture: true,
      delay: 500,
    },
    async (ctx, { fallBack, flowDynamic, state }) => {
      const name = ctx.body.trim();

      // Validar nombre
      const validation = ValidationUtils.validateName(name);

      if (!validation.isValid) {
        return fallBack(validation.error || MESSAGES.VALIDATION.EMPTY_NAME);
      }

      // Guardar nombre en estado
      await state.update({ clientName: name });

      // Continuar al siguiente paso
      await flowDynamic(MESSAGES.TAXI.ASK_LOCATION);
    }
  )
  .addAction(
    { capture: true },
    async (ctx, { fallBack, flowDynamic, state }) => {
      const location = ctx.body.trim();
      
      console.log("📝 TEXT FLOW RECEIVED:");
      console.log("📱 ctx.body:", ctx.body);
      console.log("📍 ctx.message exists:", !!ctx.message);
      
      // Detectar si es un evento de ubicación de WhatsApp
      if (location.includes("event_location_")) {
        console.log("🗺️ Detected event_location in TEXT FLOW");
        console.log("📍 Full ctx.message:", JSON.stringify(ctx.message, null, 2));
        
        // Esto es un evento de ubicación de WhatsApp pero no se procesó correctamente
        // Intentar extraer datos de ubicación del contexto
        const locationMessage = ctx.message?.locationMessage;
        console.log("📍 locationMessage in text flow:", JSON.stringify(locationMessage, null, 2));
        
        if (locationMessage) {
          console.log("✅ LocationMessage found! Processing coordinates...");
          
          // Procesar como ubicación de WhatsApp
          const latitude = locationMessage.degreesLatitude;
          const longitude = locationMessage.degreesLongitude;
          const name = locationMessage.name || "Ubicación compartida";
          const address = locationMessage.address || `${latitude}, ${longitude}`;

          console.log(`📍 Extracted coordinates: lat=${latitude}, lng=${longitude}`);
          console.log(`📍 Name: ${name}`);
          console.log(`📍 Address: ${address}`);

          // Confirmar ubicación recibida
          await flowDynamic(`✅ Ubicación recibida: ${name}`);
          if (address !== name) {
            await flowDynamic(`📍 Dirección: ${address}`);
          }

          // Crear formato de ubicación que incluye coordenadas y texto
          const locationData = {
            type: 'whatsapp_location' as const,
            latitude,
            longitude,
            name,
            address,
            formatted: `${name} - ${address}`
          };

          // Continuar con el procesamiento usando los datos de ubicación
          await processLocationData(locationData, ctx, state, flowDynamic);
          return;
        } else {
          console.log("❌ LocationMessage NOT found in ctx.message");
          console.log("🔍 Available keys in ctx.message:", Object.keys(ctx.message || {}));
          
          // Intentar buscar en otras propiedades posibles
          if (ctx.message) {
            console.log("🔍 Searching for location data in other properties...");
            for (const [key, value] of Object.entries(ctx.message)) {
              if (typeof value === 'object' && value !== null) {
                console.log(`🔍 ${key}:`, JSON.stringify(value, null, 2));
              }
            }
          }
          
          // No se pudo extraer la ubicación, solicitar nuevamente
          return fallBack("❌ No se pudo procesar la ubicación de WhatsApp. Por favor, envía tu ubicación nuevamente usando el botón de ubicación 📍 de WhatsApp.");
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
]).addAnswer(
  "🤔 ¿Estás seguro de que quieres cancelar tu solicitud de taxi?\n\n1️⃣ Sí, cancelar\n2️⃣ No, mantener solicitud",
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
          await flowDynamic(
            [MESSAGES.GREETING, MESSAGES.MENU].join("\n\n")
          );
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
