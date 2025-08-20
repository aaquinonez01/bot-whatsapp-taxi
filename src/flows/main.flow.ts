import { addKeyword, utils } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { MemoryDB } from "@builderbot/bot";
import { MESSAGES } from "../constants/messages.js";
import { ValidationUtils } from "../utils/validation.js";
import { taxiFlow } from "./taxi.flow.js";

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
])
  .addAnswer([MESSAGES.GREETING, MESSAGES.MENU].join("\n\n"), {
    delay: 800,
  })
  .addAnswer(
    "",
    {
      capture: true,
      delay: 300,
    },
    async (ctx, { gotoFlow, fallBack, state }) => {
      const option = ctx.body.trim();

      // Verificar si el usuario ya está esperando una respuesta de conductor
      const isWaiting = state.get("isWaitingForDriver");
      
      if (isWaiting) {
        // Usuario está en espera, solo permitir comandos específicos
        return fallBack("⏳ Estás esperando respuesta de los conductores. Presiona '2' para cancelar tu solicitud.");
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

        case "2":
          // Soporte - redirigir al flujo de soporte
          return gotoFlow(supportFlow);

        case "3":
          // Información - redirigir al flujo de información
          return gotoFlow(infoFlow);

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
]).addAction(async (ctx, { gotoFlow, state }) => {
  // Verificar si el usuario ya está esperando una respuesta de conductor
  const isWaiting = state.get("isWaitingForDriver");
  
  if (isWaiting) {
    // Usuario está en espera, no procesar nueva solicitud
    return;
  }
  
  return gotoFlow(taxiFlow);
});

export const supportFlow = addKeyword<BaileysProvider, MemoryDB>(
  utils.setEvent("SUPPORT_FLOW")
).addAnswer(
  MESSAGES.SUPPORT.MENU,
  {
    capture: true,
    delay: 500,
  },
  async (ctx, { gotoFlow, fallBack, flowDynamic, state }) => {
    const option = ctx.body.trim();

    // Verificar si el usuario ya está esperando una respuesta de conductor
    const isWaiting = state.get("isWaitingForDriver");
    
    if (isWaiting) {
      return fallBack("⏳ Estás esperando respuesta de los conductores. Puedes escribir 'cancelar' para cancelar tu solicitud.");
    }

    const validation = ValidationUtils.validateSupportOption(option);

    if (!validation.isValid) {
      return fallBack(MESSAGES.VALIDATION.INVALID_OPTION);
    }

    switch (option) {
      case "1":
        await flowDynamic(
          "🚕 Describe tu problema con la carrera y te ayudaremos lo antes posible."
        );
        await flowDynamic(
          "También puedes contactar directamente: +57 300 123 4567"
        );
        break;

      case "2":
        await flowDynamic(MESSAGES.SUPPORT.OPERATOR_CONTACT);
        break;

      case "3":
        await flowDynamic(MESSAGES.SUPPORT.FAQ);
        break;
    }

    // Después de manejar soporte, mostrar opción de volver al menú
    setTimeout(async () => {
      await flowDynamic("\n💡 Escribe *menu* para volver al menú principal");
    }, 2000);
  }
);

export const infoFlow = addKeyword<BaileysProvider, MemoryDB>(
  utils.setEvent("INFO_FLOW")
)
  .addAnswer(MESSAGES.INFO.COOPERATIVE, { delay: 500 })
  .addAnswer("💡 Escribe *menu* para volver al menú principal", {
    delay: 1000,
  });

// Flujo para manejar comandos específicos no reconocidos
export const fallbackFlow = addKeyword<BaileysProvider, MemoryDB>([
  "ayuda",
  "help",
]).addAnswer(
  MESSAGES.VALIDATION.INVALID_COMMAND,
  null,
  async (ctx, { gotoFlow, state, flowDynamic }) => {
    // Verificar si el usuario ya está esperando una respuesta de conductor
    const isWaiting = state.get("isWaitingForDriver");
    
    if (isWaiting) {
      await flowDynamic("⏳ Estás esperando respuesta de los conductores. Presiona '2' para cancelar tu solicitud.");
      return;
    }
    
    // Si el usuario escribe "menu", llevarlo al flujo principal
    if (ctx.body.toLowerCase().includes("menu")) {
      return gotoFlow(mainFlow);
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
