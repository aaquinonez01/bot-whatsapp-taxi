import { addKeyword, utils } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'
import { MemoryDB } from '@builderbot/bot'
import { MESSAGES } from '../constants/messages.js'
import { ValidationUtils } from '../utils/validation.js'
import { RequestService } from '../services/request.service.js'
import { NotificationService } from '../services/notification.service.js'

// Servicios globales (se inicializarán en app.ts)
let requestService: RequestService
let notificationService: NotificationService

export const setTaxiFlowServices = (reqService: RequestService, notifService: NotificationService) => {
  requestService = reqService
  notificationService = notifService
}

export const taxiFlow = addKeyword<BaileysProvider, MemoryDB>(utils.setEvent('TAXI_FLOW'))
  .addAnswer(
    MESSAGES.TAXI.ASK_NAME,
    { 
      capture: true,
      delay: 500 
    },
    async (ctx, { fallBack, flowDynamic, state }) => {
      const name = ctx.body.trim()
      
      // Validar nombre
      const validation = ValidationUtils.validateName(name)
      
      if (!validation.isValid) {
        return fallBack(validation.error || MESSAGES.VALIDATION.EMPTY_NAME)
      }

      // Guardar nombre en estado
      await state.update({ clientName: name })
      
      // Continuar al siguiente paso
      await flowDynamic(MESSAGES.TAXI.ASK_LOCATION)
    }
  )
  .addAction(
    { capture: true },
    async (ctx, { fallBack, flowDynamic, state }) => {
      const location = ctx.body.trim()
      
      // Validar ubicación
      const validation = ValidationUtils.validateLocation(location)
      
      if (!validation.isValid) {
        return fallBack(validation.error || MESSAGES.VALIDATION.EMPTY_LOCATION)
      }

      // Obtener datos del estado
      const clientName = state.get('clientName')
      const clientPhone = ctx.from
      
      // Guardar ubicación en estado
      await state.update({ 
        clientLocation: location,
        clientPhone: clientPhone
      })

      // Mostrar mensaje de búsqueda
      await flowDynamic(MESSAGES.TAXI.SEARCHING)

      try {
        // Crear solicitud de taxi
        const requestResult = await requestService.createTaxiRequest({
          clientName,
          clientPhone,
          location
        })

        if (!requestResult.success) {
          await flowDynamic(`❌ ${requestResult.error}`)
          
          // Si ya tiene una solicitud pendiente, ofrecer cancelarla
          if (requestResult.error?.includes('solicitud de taxi pendiente')) {
            await flowDynamic('💡 Escribe "cancelar" para cancelar tu solicitud anterior, o espera a que sea asignada.')
          }
          return
        }

        const request = requestResult.data!
        
        // Guardar ID de solicitud en estado
        await state.update({ requestId: request.id })

        // Notificar a todos los conductores activos
        const notificationResult = await notificationService.sendToAllActiveDrivers(request)

        if (notificationResult.sent === 0) {
          // No hay conductores disponibles
          await flowDynamic(MESSAGES.TAXI.NO_DRIVERS_AVAILABLE)
          
          // Cancelar la solicitud automáticamente
          await requestService.cancelRequest(request.id, 'No hay conductores disponibles')
          return
        }

        // Confirmar que se notificó a los conductores
        await flowDynamic(`✅ Se notificó a ${notificationResult.sent} conductores disponibles.`)
        await flowDynamic('⏳ En breve uno de nuestros conductores aceptará tu solicitud...')

        console.log(`Taxi request created: ${request.id} for ${clientName} - Notified ${notificationResult.sent} drivers`)

      } catch (error) {
        console.error('Error in taxi flow:', error)
        await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR)
      }
    }
  )

// Flujo para manejar cancelaciones
export const cancelRequestFlow = addKeyword<BaileysProvider, MemoryDB>(['cancelar', 'cancel'])
  .addAnswer(
    '🤔 ¿Estás seguro de que quieres cancelar tu solicitud de taxi?',
    { 
      capture: true,
      delay: 500
    },
    async (ctx, { flowDynamic, state }) => {
      const response = ctx.body.toLowerCase().trim()
      
      if (['si', 'sí', 'yes', 'ok', 'confirmo', 'seguro'].includes(response)) {
        try {
          const clientPhone = ctx.from
          
          // Buscar solicitud pendiente del cliente
          const pendingResult = await requestService.getClientPendingRequest(clientPhone)
          
          if (!pendingResult.success) {
            await flowDynamic('ℹ️ No tienes solicitudes pendientes para cancelar.')
            return
          }

          // Cancelar solicitud
          const cancelResult = await requestService.cancelRequest(
            pendingResult.data!.id, 
            'Cancelada por el cliente'
          )

          if (cancelResult.success) {
            await flowDynamic('✅ Tu solicitud de taxi ha sido cancelada.')
            await flowDynamic('💡 Escribe *menu* para hacer una nueva solicitud.')
          } else {
            await flowDynamic('❌ Error al cancelar la solicitud. Intenta nuevamente.')
          }

        } catch (error) {
          console.error('Error canceling request:', error)
          await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR)
        }
      } else {
        await flowDynamic('✅ Solicitud mantenida. Esperando asignación de conductor...')
      }
    }
  )

// Flujo para consultar estado de solicitud
export const statusFlow = addKeyword<BaileysProvider, MemoryDB>(['estado', 'status', 'mi solicitud'])
  .addAction(async (ctx, { flowDynamic }) => {
    try {
      const clientPhone = ctx.from
      
      // Buscar solicitud pendiente o asignada del cliente
      const pendingResult = await requestService.getClientPendingRequest(clientPhone)
      
      if (pendingResult.success && pendingResult.data) {
        const request = pendingResult.data
        const timeElapsed = Math.floor((Date.now() - request.createdAt.getTime()) / 1000 / 60)
        
        if (request.status === 'PENDING') {
          await flowDynamic(`⏳ Tu solicitud está pendiente (${timeElapsed} min)`)
          await flowDynamic('🔍 Aún buscando conductor disponible...')
        } else if (request.status === 'ASSIGNED' && request.driver) {
          await flowDynamic(`✅ ¡Taxi asignado!`)
          await flowDynamic(`👤 Conductor: ${request.driver.name}`)
          await flowDynamic(`🚗 Placa: ${request.driver.plate}`)
          await flowDynamic(`📱 Teléfono: ${request.driver.phone}`)
        }
      } else {
        await flowDynamic('ℹ️ No tienes solicitudes activas.')
        await flowDynamic('💡 Escribe *menu* para solicitar un taxi.')
      }

    } catch (error) {
      console.error('Error checking status:', error)
      await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR)
    }
  })

// Flujo para completar carrera (para conductores)
export const completeRideFlow = addKeyword<BaileysProvider, MemoryDB>(['completar', 'terminar', 'finalizar'])
  .addAction(async (ctx, { flowDynamic }) => {
    try {
      const driverPhone = ctx.from
      
      // Verificar si es un conductor registrado
      const driverService = new (await import('../services/driver.service.js')).DriverService()
      const driverResult = await driverService.getDriverByPhone(driverPhone)
      
      if (!driverResult.success) {
        await flowDynamic(MESSAGES.VALIDATION.DRIVER_NOT_FOUND)
        return
      }

      // Buscar carreras asignadas al conductor
      const assignedRequests = await requestService.getRequestsByFilters({
        status: 'ASSIGNED'
      })

      if (!assignedRequests.success || !assignedRequests.data) {
        await flowDynamic('ℹ️ No tienes carreras activas para completar.')
        return
      }

      // Filtrar solicitudes asignadas a este conductor
      const driverRequests = assignedRequests.data.filter(
        req => req.driver?.phone === ValidationUtils.cleanPhoneNumber(driverPhone)
      )

      if (driverRequests.length === 0) {
        await flowDynamic('ℹ️ No tienes carreras activas para completar.')
        return
      }

      // Si hay múltiples, tomar la más antigua
      const requestToComplete = driverRequests[0]
      
      // Completar la carrera
      const completeResult = await requestService.completeRequest(requestToComplete.id)
      
      if (completeResult.success) {
        await flowDynamic('✅ Carrera completada exitosamente.')
        await flowDynamic(`👤 Cliente: ${requestToComplete.clientName}`)
        
        // Notificar al cliente que la carrera fue completada
        await notificationService.sendToClient(
          requestToComplete.clientPhone,
          '✅ Tu carrera ha sido completada. ¡Gracias por usar Taxi Cooperativa!'
        )
      } else {
        await flowDynamic('❌ Error al completar la carrera. Intenta nuevamente.')
      }

    } catch (error) {
      console.error('Error completing ride:', error)
      await flowDynamic(MESSAGES.ERRORS.SYSTEM_ERROR)
    }
  })