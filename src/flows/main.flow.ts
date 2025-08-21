import { addKeyword, utils, EVENTS } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MemoryDB } from "@builderbot/bot";
import { MESSAGES } from "../constants/messages.js";
import { ValidationUtils } from "../utils/validation.js";
import { DriverService } from "../services/driver.service.js";
import { taxiFlow } from "./taxi.flow.js";

// Servicios globales (se inicializarán en app.ts)
let driverService: DriverService;

export const setMainFlowServices = (drvService: DriverService) => {
  driverService = drvService;
};

export const mainFlow = addKeyword<BaileysProvider, MemoryDB>([
  "hola",
  "hi",
  "hello",
  "menu",
  "inicio",
  "start",
  "buenas",
  "buenos dias",
  "buenas tardes",
  "buenas noches",
]).addAction(async (ctx, { flowDynamic, endFlow, state }) => {
  try {
    const userPhone = ctx.from;
    
    console.log(`📞 MainFlow triggered by: ${userPhone} with message: "${ctx.body}"`);
    
    // Verificar si había un timeout previo y limpiar
    const hadTimeout = state.get("hadTimeout");
    if (hadTimeout) {
      await state.clear();
      console.log(`🧹 Timeout state cleared for user ${userPhone} in mainFlow`);
    }

    // Verificar si el usuario es un conductor registrado
    console.log("🔍 MainFlow: Checking if user is a registered driver...");
    const driverResult = await driverService.getDriverByPhone(userPhone);
    
    if (driverResult.success && driverResult.data) {
      // Es un conductor registrado - mostrar mensaje personalizado y terminar
      console.log(`✅ MainFlow: Driver found: ${driverResult.data.name} (${driverResult.data.phone})`);
      return endFlow(MESSAGES.DRIVER_WELCOME);
    }
    
    // No es conductor - mostrar menú normal para clientes
    console.log("👤 MainFlow: User is not a driver, showing client menu");
    await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
  } catch (error) {
    console.error("Error in mainFlow driver check:", error);
    // En caso de error, mostrar menú normal
    await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
  }
})
  .addAnswer(
    "",
    {
      capture: true,
      delay: 300,
    },
    async (ctx, { gotoFlow, fallBack, state }) => {
      const option = ctx.body.trim();

      // Verificar si había un timeout previo y limpiar
      const hadTimeout = state.get("hadTimeout");
      if (hadTimeout) {
        await state.clear();
        console.log(`🧹 Timeout state cleared for user ${ctx.from}`);
      }

      // Verificar si el usuario ya está esperando una respuesta de conductor
      const isWaiting = state.get("isWaitingForDriver");

      if (isWaiting) {
        // Usuario está en espera, solo permitir comandos específicos
        return fallBack(
          "⏳ Estás esperando respuesta de los conductores. Presiona '2' para cancelar tu solicitud."
        );
      }

      // Validar opción seleccionada
      const validation = ValidationUtils.validateMenuOption(option);

      if (!validation.isValid) {
        return fallBack(MESSAGES.VALIDATION.INVALID_OPTION);
      }

      // Guardar la opción seleccionada en el estado
      await state.update({ selectedOption: option });

      // Redirigir según la opción
      switch (option) {
        case "1":
          // Pedir taxi - redirigir al flujo de taxi
          return gotoFlow(taxiFlow);

        default:
          return fallBack(MESSAGES.VALIDATION.INVALID_OPTION);
      }
    }
  );

// Flujo rápido para empezar una solicitud de taxi sin decir "hola"
export const quickTaxiFlow = addKeyword<BaileysProvider, MemoryDB>([
  "taxi",
  "quiero taxi",
  "necesito taxi",
  "pido taxi",
  "solicitar taxi",
  "servicio taxi",
]).addAction(async (ctx, { gotoFlow, state, endFlow }) => {
  try {
    const userPhone = ctx.from;
    
    console.log(`📞 QuickTaxiFlow triggered by: ${userPhone} with message: "${ctx.body}"`);
    
    // Verificar si el usuario es un conductor registrado
    console.log("🔍 QuickTaxiFlow: Checking if user is a registered driver...");
    const driverResult = await driverService.getDriverByPhone(userPhone);
    
    if (driverResult.success && driverResult.data) {
      // Es un conductor registrado - mostrar mensaje personalizado y terminar
      console.log(`✅ QuickTaxiFlow: Driver found: ${driverResult.data.name} (${driverResult.data.phone})`);
      return endFlow(MESSAGES.DRIVER_WELCOME);
    }
    
    // No es conductor - continuar con lógica normal de cliente
    console.log("👤 QuickTaxiFlow: User is not a driver, proceeding with taxi flow");
    
    // Verificar si el usuario ya está esperando una respuesta de conductor
    const isWaiting = state.get("isWaitingForDriver");

    if (isWaiting) {
      // Usuario está en espera, no procesar nueva solicitud
      return;
    }

    return gotoFlow(taxiFlow);
  } catch (error) {
    console.error("Error in quickTaxiFlow driver check:", error);
    // En caso de error, continuar con flujo normal
    const isWaiting = state.get("isWaitingForDriver");
    if (!isWaiting) {
      return gotoFlow(taxiFlow);
    }
  }
});

// Flujo modificado que ahora muestra el menú automáticamente
export const fallbackFlow = addKeyword<BaileysProvider, MemoryDB>([
  "ayuda",
  "help",
]).addAnswer(
  "", // Sin mensaje automático
  null,
  async (ctx, { gotoFlow, state, flowDynamic }) => {
    // Verificar si el usuario ya está esperando una respuesta de conductor
    const isWaiting = state.get("isWaitingForDriver");

    if (isWaiting) {
      await flowDynamic(
        "⏳ Estás esperando respuesta de los conductores. Presiona '2' para cancelar tu solicitud."
      );
      return;
    }

    // Verificar si había un timeout previo
    const hadTimeout = state.get("hadTimeout");
    if (hadTimeout) {
      await state.clear();
    }

    // Mostrar automáticamente el saludo y menú
    await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
  }
);

// Flujo WELCOME que captura CUALQUIER mensaje que no coincida con otros flujos
export const welcomeFlow = addKeyword<BaileysProvider, MemoryDB>(EVENTS.WELCOME)
  .addAction(async (ctx, { flowDynamic, endFlow, state }) => {
    try {
      const userPhone = ctx.from;

      console.log(`📞 New message from: ${userPhone}`);

      // Verificar si había un timeout previo y limpiar
      const hadTimeout = state.get("hadTimeout");
      if (hadTimeout) {
        await state.clear();
        console.log(
          `🧹 Timeout state cleared for user ${userPhone} in welcomeFlow`
        );
      }

      // Verificar si el usuario está en medio de un flujo de taxi
      const clientName = state.get("clientName");
      const isWaitingForDriver = state.get("isWaitingForDriver");
      
      if (clientName || isWaitingForDriver) {
        console.log(`🚕 User is in the middle of taxi flow - ignoring welcomeFlow (clientName: ${clientName}, waiting: ${isWaitingForDriver})`);
        return; // No interrumpir el flujo de taxi
      }

      // Limpiar el número de teléfono usando la utilidad
      const cleanPhone = ValidationUtils.cleanPhoneNumber(userPhone);
      console.log(`🧽 Cleaned phone: ${userPhone} -> ${cleanPhone}`);

      // Verificar si el usuario es un conductor registrado
      console.log("🔍 Checking if user is a registered driver...");
      const driverResult = await driverService.getDriverByPhone(userPhone);
      console.log(driverResult);
      if (driverResult.success && driverResult.data) {
        // Es un conductor registrado - mostrar mensaje personalizado y terminar
        console.log(
          `✅ Driver found: ${driverResult.data.name} (${driverResult.data.phone})`
        );
        return endFlow(MESSAGES.DRIVER_WELCOME);
      }

      // No es conductor - mostrar menú normal para clientes
      console.log("👤 User is not a driver, showing client menu");
      await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
    } catch (error) {
      console.error("Error in welcomeFlow driver check:", error);
      // En caso de error, mostrar menú normal
      await flowDynamic([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"));
    }
  })
  .addAnswer(
    "",
    {
      capture: true,
      delay: 300,
    },
    async (ctx, { gotoFlow, fallBack, state }) => {
      const option = ctx.body.trim();
      const userPhone = ctx.from;

      // Verificar si el usuario ya está esperando una respuesta de conductor
      const isWaiting = state.get("isWaitingForDriver");

      if (isWaiting) {
        return fallBack(
          "⏳ Estás esperando respuesta de los conductores. Presiona '2' para cancelar tu solicitud."
        );
      }

      // Verificar nuevamente si es conductor (por si acaso llegara aquí)
      try {
        const driverResult = await driverService.getDriverByPhone(userPhone);
        if (driverResult.success && driverResult.data) {
          // Si es conductor, ignorar la captura completamente
          console.log(
            `🚫 Driver ${driverResult.data.name} somehow reached option capture - ignoring`
          );
          return;
        }
      } catch (error) {
        console.error("Error checking driver in option capture:", error);
      }

      // Validar opción seleccionada para clientes
      const validation = ValidationUtils.validateMenuOption(option);

      if (!validation.isValid) {
        return fallBack(MESSAGES.VALIDATION.INVALID_OPTION);
      }

      // Guardar la opción seleccionada en el estado
      await state.update({ selectedOption: option });

      // Redirigir según la opción
      switch (option) {
        case "1":
          // Pedir taxi - redirigir al flujo de taxi
          return gotoFlow(taxiFlow);

        default:
          return fallBack(MESSAGES.VALIDATION.INVALID_OPTION);
      }
    }
  );

// Flujo para manejar despedidas
export const goodbyeFlow = addKeyword<BaileysProvider, MemoryDB>([
  "gracias",
  "chao",
  "bye",
  "adiós",
  "adios",
  "hasta luego",
  "nos vemos",
])
  .addAnswer(
    "👋 ¡Gracias por usar Taxi Cooperativa! Que tengas un excelente día.",
    { delay: 500 }
  )
  .addAnswer("💡 Escribe *menu* cuando necesites un taxi.", { delay: 1000 });
