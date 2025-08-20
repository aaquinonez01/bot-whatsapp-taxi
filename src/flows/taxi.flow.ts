import { addKeyword, utils } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MemoryDB } from "@builderbot/bot";
import { MESSAGES } from "../constants/messages.js";
import { ValidationUtils } from "../utils/validation.js";
import { RequestService } from "../services/request.service.js";
import { NotificationService } from "../services/notification.service.js";
import { RequestStatus } from "~/types/index.js";

// Flujo especial para limpiar estado cuando se asigna taxi
export const taxiAssignedFlow = addKeyword<BaileysProvider, MemoryDB>([
  "¡Taxi asignado!"
]).addAction(async (ctx, { state }) => {
  // Este flujo se activa cuando el cliente recibe el mensaje de asignación
  // Limpiar completamente el estado del cliente
  await state.clear();
  console.log(`✅ Estado limpiado para cliente ${ctx.from} después de asignación de taxi`);
});

// Flujo especial para manejar interacciones después de timeout
export const postTimeoutFlow = addKeyword<BaileysProvider, MemoryDB>([
  "1", "2", "3"
]).addAction(async (ctx, { state, gotoFlow }) => {
  const hadTimeout = state.get("hadTimeout");
  
  if (hadTimeout) {
    // Limpiar el flag de timeout
    await state.clear();
    
    const option = ctx.body.trim();
    
    // Procesar la opción seleccionada
    if (option === "1") {
      return gotoFlow(taxiFlow);
    } else if (option === "2") {
      const { supportFlow } = await import("./main.flow.js");
      return gotoFlow(supportFlow);
    } else if (option === "3") {
      const { infoFlow } = await import("./main.flow.js");
      return gotoFlow(infoFlow);
    }
  }
  // Si no había timeout, no hacer nada (dejar que otros flujos manejen)
});

// Servicios globales (se inicializarán en app.ts)
let requestService: RequestService;
let notificationService: NotificationService;

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

      // Validar ubicación
      const validation = ValidationUtils.validateLocation(location);

      if (!validation.isValid) {
        return fallBack(validation.error || MESSAGES.VALIDATION.EMPTY_LOCATION);
      }

      // Obtener datos del estado
      const clientName = state.get("clientName");
      const clientPhone = ctx.from;

      // Guardar ubicación en estado
      await state.update({
        clientLocation: location,
        clientPhone: clientPhone,
      });

      try {
        // Crear solicitud de taxi
        const requestResult = await requestService.createTaxiRequest({
          clientName,
          clientPhone,
          location,
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

        // Configurar timeout de 20 segundos usando el contexto del flujo
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

              // Enviar mensaje de timeout y menú usando flowDynamic
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

        // Guardar el timeout ID en el estado para poder cancelarlo si es necesario
        await state.update({ timeoutId: timeoutId });
      } catch (error) {
        console.error("Error in taxi flow:", error);
        await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
      }
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
