import { addKeyword, utils } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'
import { MemoryDB } from '@builderbot/bot'
import { MESSAGES } from '../constants/messages.js'
import { ValidationUtils } from '../utils/validation.js'

export const mainFlow = addKeyword<BaileysProvider, MemoryDB>([
  'hola', 'hi', 'hello', 'menu', 'inicio', 'start', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches'
])
  .addAnswer(
    [MESSAGES.GREETING, MESSAGES.MENU].join('\n\n'),
    { 
      capture: true,
      delay: 800 
    },
    async (ctx, { gotoFlow, fallBack, state }) => {
      const option = ctx.body.trim()
      
      // Validar opción seleccionada
      const validation = ValidationUtils.validateMenuOption(option)
      
      if (!validation.isValid) {
        return fallBack(MESSAGES.VALIDATION.INVALID_OPTION)
      }

      // Guardar la opción seleccionada en el estado
      await state.update({ selectedOption: option })

      // Redirigir según la opción
      switch (option) {
        case '1':
          // Pedir taxi - redirigir al flujo de taxi
          return gotoFlow('TAXI_FLOW')
        
        case '2':
          // Soporte - redirigir al flujo de soporte
          return gotoFlow('SUPPORT_FLOW')
        
        case '3':
          // Información - redirigir al flujo de información
          return gotoFlow('INFO_FLOW')
        
        default:
          return fallBack(MESSAGES.VALIDATION.INVALID_OPTION)
      }
    }
  )

export const supportFlow = addKeyword<BaileysProvider, MemoryDB>(utils.setEvent('SUPPORT_FLOW'))
  .addAnswer(
    MESSAGES.SUPPORT.MENU,
    { 
      capture: true,
      delay: 500 
    },
    async (ctx, { gotoFlow, fallBack, flowDynamic }) => {
      const option = ctx.body.trim()
      
      const validation = ValidationUtils.validateSupportOption(option)
      
      if (!validation.isValid) {
        return fallBack(MESSAGES.VALIDATION.INVALID_OPTION)
      }

      switch (option) {
        case '1':
          await flowDynamic('🚕 Describe tu problema con la carrera y te ayudaremos lo antes posible.')
          await flowDynamic('También puedes contactar directamente: +57 300 123 4567')
          break
        
        case '2':
          await flowDynamic(MESSAGES.SUPPORT.OPERATOR_CONTACT)
          break
        
        case '3':
          await flowDynamic(MESSAGES.SUPPORT.FAQ)
          break
      }

      // Después de manejar soporte, mostrar opción de volver al menú
      setTimeout(async () => {
        await flowDynamic('\n💡 Escribe *menu* para volver al menú principal')
      }, 2000)
    }
  )

export const infoFlow = addKeyword<BaileysProvider, MemoryDB>(utils.setEvent('INFO_FLOW'))
  .addAnswer(
    MESSAGES.INFO.COOPERATIVE,
    { delay: 500 }
  )
  .addAnswer(
    '💡 Escribe *menu* para volver al menú principal',
    { delay: 1000 }
  )

// Flujo para manejar comandos no reconocidos
export const fallbackFlow = addKeyword<BaileysProvider, MemoryDB>([''])
  .addAnswer(
    MESSAGES.VALIDATION.INVALID_COMMAND,
    null,
    async (ctx, { gotoFlow }) => {
      // Si el usuario escribe "menu", llevarlo al flujo principal
      if (ctx.body.toLowerCase().includes('menu')) {
        return gotoFlow(mainFlow)
      }
    }
  )

// Flujo para manejar despedidas
export const goodbyeFlow = addKeyword<BaileysProvider, MemoryDB>([
  'gracias', 'chao', 'bye', 'adiós', 'adios', 'hasta luego', 'nos vemos'
])
  .addAnswer(
    '👋 ¡Gracias por usar Taxi Cooperativa! Que tengas un excelente día.',
    { delay: 500 }
  )
  .addAnswer(
    '💡 Escribe *menu* cuando necesites un taxi.',
    { delay: 1000 }
  )