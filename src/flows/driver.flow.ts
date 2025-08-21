import { addKeyword } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MemoryDB } from "@builderbot/bot";
import { MESSAGES } from "../constants/messages.js";
import { ValidationUtils } from "../utils/validation.js";
import { DriverService } from "../services/driver.service.js";
import { RequestService } from "../services/request.service.js";
import { NotificationService } from "../services/notification.service.js";

// Servicios globales (se inicializarán en app.ts)
let driverService: DriverService;
let requestService: RequestService;
let notificationService: NotificationService;

export const setDriverFlowServices = (
  drvService: DriverService,
  reqService: RequestService,
  notifService: NotificationService
) => {
  driverService = drvService;
  requestService = reqService;
  notificationService = notifService;
};

// Flujo principal para aceptar carreras
export const driverAcceptFlow = addKeyword<BaileysProvider, MemoryDB>([
  "1",
]).addAction(async (ctx, { flowDynamic }) => {
  try {
    const driverPhone = ctx.from;
    
    console.log("🔥 DRIVER ACCEPT FLOW ACTIVATED!");
    console.log(`📱 Driver phone: ${driverPhone}`);
    console.log(`💬 Message received: "${ctx.body}"`);
    console.log(`🕐 Timestamp: ${new Date().toISOString()}`);

    // 1. Verificar si es un conductor registrado
    console.log("🔍 Step 1: Checking if user is a registered driver...");
    const driverResult = await driverService.getDriverByPhone(driverPhone);

    if (!driverResult.success || !driverResult.data) {
      console.log("❌ User is NOT a registered driver - exiting silently");
      console.log(`❌ Driver result: ${JSON.stringify(driverResult)}`);
      // Si el usuario no es un conductor, no interrumpir su flujo.
      // Salir silenciosamente para evitar mensajes confusos a clientes.
      return;
    }

    const driver = driverResult.data;
    console.log(`✅ Driver found: ${driver.name} (ID: ${driver.id})`);

    // 2. Verificar si el conductor está activo
    console.log("🔍 Step 2: Checking if driver is active...");
    if (!driver.isActive) {
      console.log("❌ Driver is INACTIVE");
      await flowDynamic(
        "⚠️ Tu cuenta de conductor está inactiva. Contacta al administrador."
      );
      return;
    }
    console.log("✅ Driver is ACTIVE");

    // 3. Buscar la solicitud pendiente más antigua
    console.log("🔍 Step 3: Looking for oldest pending request...");
    const oldestRequestResult = await requestService.getOldestPendingRequest();

    if (!oldestRequestResult.success || !oldestRequestResult.data) {
      console.log("❌ NO pending requests found");
      console.log(`❌ Request result: ${JSON.stringify(oldestRequestResult)}`);
      
      // Nuevo mensaje más amigable para cuando no hay carreras pendientes
      await flowDynamic(MESSAGES.TAXI.NO_PENDING_REQUESTS);
      return;
    }

    const request = oldestRequestResult.data;
    console.log(`✅ Found pending request: ${request.id}`);
    console.log(`📋 Request details: Client=${request.clientName}, Location=${request.location}`);

    // 4. Intentar asignar la carrera al conductor (con control de concurrencia)
    console.log("🔍 Step 4: Attempting to assign driver to request...");
    const assignmentResult = await requestService.assignFirstAvailableDriver(
      request.id,
      driverPhone
    );

    if (!assignmentResult.success) {
      console.log("❌ Assignment FAILED");
      console.log(`❌ Assignment result: ${JSON.stringify(assignmentResult)}`);
      // La carrera ya fue tomada por otro conductor
      await flowDynamic(assignmentResult.message);
      return;
    }

    console.log("🎉 ASSIGNMENT SUCCESSFUL!");
    console.log(`✅ Assignment result: ${JSON.stringify(assignmentResult)}`);

    // 5. ¡Carrera asignada exitosamente!
    const assignedRequest = assignmentResult.request!;
    const assignedDriver = assignmentResult.driver!;

    console.log("🔍 Step 5: Notifying driver and client...");
    
    // Notificar al cliente con la información del conductor
    console.log("📞 Notifying client about assignment...");
    const clientNotificationSuccess =
      await notificationService.notifyClientAssignment(
        assignedRequest,
        assignedDriver
      );

    if (clientNotificationSuccess) {
      console.log("✅ Client notification SUCCESSFUL");
      // Mensaje único y conciso para el conductor
      await flowDynamic(`✅ Carrera asignada! El cliente recibirá tu información. Este es su número para que puedas comunicarte con él y coordinar la carrera: ${assignedRequest.clientPhone}`);
    } else {
      console.log("❌ Client notification FAILED");
      await flowDynamic(
        "⚠️ Error notificando al cliente. Contacta manualmente."
      );
    }

    // Notificar a todos los otros conductores que la carrera fue tomada
    console.log("📢 Notifying other drivers that ride was taken...");
    const otherDriversResult =
      await notificationService.notifyOtherDriversCareerTaken(
        request.id,
        driverPhone,
        driver.name
      );

    console.log("🎯 FINAL SUMMARY:");
    console.log(`✅ Carrera asignada: ${request.id} -> Driver: ${driver.name} (${driver.phone})`);
    console.log(`📢 Otros conductores notificados: ${otherDriversResult.sent}`);
    console.log("🔥 DRIVER ACCEPT FLOW COMPLETED SUCCESSFULLY!");
  } catch (error) {
    console.error("Error in driver accept flow:", error);
    await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
  }
});

// Flujo para rechazar carreras
export const driverRejectFlow = addKeyword<BaileysProvider, MemoryDB>([
  "rechazo",
  "rechazar",
  "no acepto",
]).addAction(async (ctx, { flowDynamic }) => {
  try {
    const driverPhone = ctx.from;

    // Verificar si es un conductor registrado
    const driverResult = await driverService.getDriverByPhone(driverPhone);

    if (!driverResult.success || !driverResult.data) {
      // Si el usuario no es un conductor, salir silenciosamente
      return;
    }

    await flowDynamic(
      "📝 Carrera rechazada. Será asignada a otro conductor disponible."
    );

    console.log(
      `Driver ${driverResult.data.name} (${driverPhone}) rejected a ride`
    );
  } catch (error) {
    console.error("Error in driver reject flow:", error);
    await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
  }
});

// Flujo para registro de nuevos conductores
export const driverRegisterFlow = addKeyword<BaileysProvider, MemoryDB>([
  "registrar conductor",
  "nuevo conductor",
  "register driver",
])
  .addAnswer(
    "📝 Para registrar un nuevo conductor, proporciona los siguientes datos:",
    { delay: 500 }
  )
  .addAnswer(
    "Nombre completo del conductor:",
    {
      capture: true,
      delay: 300,
    },
    async (ctx, { fallBack, flowDynamic, state }) => {
      const name = ctx.body.trim();

      const validation = ValidationUtils.validateName(name);
      if (!validation.isValid) {
        return fallBack(validation.error || "Nombre inválido");
      }

      await state.update({ driverName: name });
      await flowDynamic("Placa del vehículo (ej: ABC123):");
    }
  )
  .addAction(
    { capture: true },
    async (ctx, { fallBack, flowDynamic, state }) => {
      const plate = ctx.body.trim();

      const validation = ValidationUtils.validatePlate(plate);
      if (!validation.isValid) {
        return fallBack(validation.error || "Placa inválida");
      }

      await state.update({ driverPlate: plate.toUpperCase() });
      await flowDynamic('📍 Ubicación actual (opcional, puedes escribir "skip"):\n\n⚠️ IMPORTANTE: Si proporcionas ubicación, usa el botón 📍 de WhatsApp para mayor precisión');
    }
  )
  .addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
    const location = ctx.body.trim();
    const driverPhone = ctx.from;
    const driverName = state.get("driverName");
    const driverPlate = state.get("driverPlate");

    try {
      const driverLocation =
        location.toLowerCase() === "skip" ? undefined : location;

      if (driverLocation) {
        const validation = ValidationUtils.validateLocation(driverLocation);
        if (!validation.isValid) {
          await flowDynamic(validation.error || "Ubicación inválida");
          return;
        }
      }

      // Crear conductor
      const createResult = await driverService.createDriver({
        name: driverName,
        phone: driverPhone,
        plate: driverPlate,
        location: driverLocation,
      });

      if (createResult.success) {
        await flowDynamic("✅ ¡Conductor registrado exitosamente!");
        await flowDynamic(`👤 Nombre: ${driverName}`);
        await flowDynamic(`🚗 Placa: ${driverPlate}`);
        await flowDynamic(
          `📱 Teléfono: ${ValidationUtils.cleanPhoneNumber(driverPhone)}`
        );
        if (driverLocation) {
          await flowDynamic(`📍 Ubicación: ${driverLocation}`);
        }
        await flowDynamic(
          '\n🚕 Ya puedes aceptar carreras presionando "1" cuando lleguen solicitudes.'
        );
      } else {
        await flowDynamic(`❌ Error: ${createResult.error}`);
      }
    } catch (error) {
      console.error("Error registering driver:", error);
      await flowDynamic(MESSAGES.ERRORS.DRIVER_REGISTRATION_ERROR);
    }
  });

// Flujo para cambiar estado del conductor (activo/inactivo)
export const driverStatusFlow = addKeyword<BaileysProvider, MemoryDB>([
  "activo",
  "inactivo",
  "disponible",
  "no disponible",
  "conectar",
  "desconectar",
]).addAction(async (ctx, { flowDynamic }) => {
  try {
    const driverPhone = ctx.from;
    const command = ctx.body.toLowerCase().trim();

    // Verificar si es un conductor registrado
    const driverResult = await driverService.getDriverByPhone(driverPhone);

    if (!driverResult.success || !driverResult.data) {
      // Si el usuario no es un conductor, salir silenciosamente
      return;
    }

    const isActivating = ["activo", "disponible", "conectar"].includes(command);

    const updateResult = await driverService.updateDriverStatus(
      driverPhone,
      isActivating
    );

    if (updateResult.success) {
      const status = isActivating ? "ACTIVO ✅" : "INACTIVO ⏸️";
      await flowDynamic(`Estado actualizado: ${status}`);

      if (isActivating) {
        await flowDynamic("🚕 Ya puedes recibir solicitudes de carreras.");
      } else {
        await flowDynamic(
          "⏸️ No recibirás nuevas solicitudes hasta que te actives."
        );
      }
    } else {
      await flowDynamic(`❌ Error: ${updateResult.error}`);
    }
  } catch (error) {
    console.error("Error updating driver status:", error);
    await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
  }
});

// Flujo para actualizar ubicación del conductor
export const driverLocationFlow = addKeyword<BaileysProvider, MemoryDB>([
  "ubicacion",
  "ubicación",
  "location",
  "donde estoy",
])
  // Guardar previo para evitar mostrar prompt a usuarios no conductores
  .addAction(async (ctx, { flowDynamic }) => {
    try {
      const driverPhone = ctx.from;
      const driverResult = await driverService.getDriverByPhone(driverPhone);

      // Si NO es conductor, salir silenciosamente para no interferir con flujos de cliente
      if (!driverResult.success || !driverResult.data) {
        return;
      }

      await flowDynamic("📍 Es necesario que envíes tu ubicación usando el botón de ubicación de WhatsApp\n\n⚠️ IMPORTANTE: Usa el botón 📍 de WhatsApp para obtener tu ubicación exacta");
    } catch (error) {
      console.error("Error preparing driver location flow:", error);
    }
  })
  .addAction(
    { capture: true, delay: 300 },
    async (ctx, { fallBack, flowDynamic }) => {
      try {
        const driverPhone = ctx.from;
        const driverResult = await driverService.getDriverByPhone(driverPhone);

        // Si NO es conductor, ignorar
        if (!driverResult.success || !driverResult.data) {
          return;
        }

        const newLocation = ctx.body.trim();

        const validation = ValidationUtils.validateLocation(newLocation);
        if (!validation.isValid) {
          return fallBack(validation.error || "Ubicación inválida");
        }

        const updateResult = await driverService.updateDriverLocation(
          driverPhone,
          newLocation
        );

        if (updateResult.success) {
          await flowDynamic("✅ Ubicación actualizada correctamente.");
          await flowDynamic(`📍 Nueva ubicación: ${newLocation}`);
        } else {
          await flowDynamic(`❌ Error: ${updateResult.error}`);
        }
      } catch (error) {
        console.error("Error updating driver location:", error);
        await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
      }
    }
  );

// Flujo para consultar información del conductor
export const driverInfoFlow = addKeyword<BaileysProvider, MemoryDB>([
  "mi info",
  "mi informacion",
  "mis datos",
  "perfil",
]).addAction(async (ctx, { flowDynamic }) => {
  try {
    const driverPhone = ctx.from;

    const driverResult = await driverService.getDriverByPhone(driverPhone);

    if (!driverResult.success || !driverResult.data) {
      // Si el usuario no es un conductor, salir silenciosamente
      return;
    }

    const driver = driverResult.data;
    const status = driver.isActive ? "ACTIVO ✅" : "INACTIVO ⏸️";

    await flowDynamic("👤 Tu información de conductor:");
    await flowDynamic(`Nombre: ${driver.name}`);
    await flowDynamic(`📱 Teléfono: ${driver.phone}`);
    await flowDynamic(`🚗 Placa: ${driver.plate}`);
    await flowDynamic(`📍 Ubicación: ${driver.location || "No registrada"}`);
    await flowDynamic(`Estado: ${status}`);
    await flowDynamic(
      `📅 Registrado: ${driver.createdAt.toLocaleDateString()}`
    );
  } catch (error) {
    console.error("Error getting driver info:", error);
    await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR);
  }
});
