import { BaileysProvider } from '@builderbot/provider-baileys'
import { DriverService } from './driver.service.js'
import { ValidationUtils } from '../utils/validation.js'
import { NotificationResult, TaxiRequest, Driver } from '../types/index.js'
import { MESSAGES } from '../constants/messages.js'

export class NotificationService {
  private provider: BaileysProvider
  private driverService: DriverService

  constructor(provider: BaileysProvider) {
    this.provider = provider
    this.driverService = new DriverService()
  }

  async sendToAllActiveDrivers(
    request: TaxiRequest, 
    excludePhone?: string
  ): Promise<NotificationResult> {
    try {
      // Obtener todos los conductores activos
      const driversResult = await this.driverService.getAllActiveDrivers({
        isActive: true,
        excludePhone
      })

      if (!driversResult.success || !driversResult.data) {
        return {
          sent: 0,
          failed: 0,
          errors: ['Error al obtener conductores activos']
        }
      }

      const drivers = driversResult.data
      if (drivers.length === 0) {
        return {
          sent: 0,
          failed: 0,
          errors: ['No hay conductores activos disponibles']
        }
      }

      // Preparar mensaje de notificación
      const message = MESSAGES.TAXI.DRIVER_NOTIFICATION(
        request.clientName,
        request.location,
        request.id
      )

      let sent = 0
      let failed = 0
      const errors: string[] = []

      // Enviar notificación a cada conductor
      for (const driver of drivers) {
        try {
          const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(driver.phone)
          
          // Enviar mensaje
          await this.provider.sendMessage(formattedPhone, message, {})
          
          // Opcional: Enviar presencia de "typing"
          await this.provider.vendor.sendPresenceUpdate('composing', formattedPhone)
          
          sent++
        } catch (error) {
          failed++
          console.error(`Error sending to driver ${driver.phone}:`, error)
          errors.push(`Error enviando a ${driver.name} (${driver.phone})`)
        }
      }

      return { sent, failed, errors: errors.length > 0 ? errors : undefined }

    } catch (error) {
      console.error('Error in sendToAllActiveDrivers:', error)
      return {
        sent: 0,
        failed: 0,
        errors: ['Error interno en el servicio de notificaciones']
      }
    }
  }

  async notifyClientAssignment(
    request: TaxiRequest, 
    driver: Driver
  ): Promise<boolean> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(request.clientPhone)
      
      const message = MESSAGES.TAXI.CLIENT_ASSIGNED(
        driver.name,
        driver.plate,
        driver.phone
      )

      // Enviar presencia de "typing" antes del mensaje
      await this.provider.vendor.sendPresenceUpdate('composing', formattedPhone)
      
      // Esperar un momento para simular escritura
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Enviar mensaje al cliente
      await this.provider.sendMessage(formattedPhone, message, {})

      return true

    } catch (error) {
      console.error('Error notifying client assignment:', error)
      return false
    }
  }

  async notifyDriverAccepted(driverPhone: string): Promise<boolean> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(driverPhone)
      
      const message = MESSAGES.TAXI.DRIVER_ACCEPTED

      await this.provider.sendMessage(formattedPhone, message, {})

      return true

    } catch (error) {
      console.error('Error notifying driver accepted:', error)
      return false
    }
  }

  async notifyDriverTooLate(driverPhone: string): Promise<boolean> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(driverPhone)
      
      const message = MESSAGES.TAXI.DRIVER_TOO_LATE

      await this.provider.sendMessage(formattedPhone, message, {})

      return true

    } catch (error) {
      console.error('Error notifying driver too late:', error)
      return false
    }
  }

  async notifyOtherDriversCareerTaken(
    requestId: string, 
    assignedDriverPhone: string,
    assignedDriverName: string
  ): Promise<NotificationResult> {
    try {
      // Obtener todos los conductores activos excepto el asignado
      const driversResult = await this.driverService.getAllActiveDrivers({
        isActive: true,
        excludePhone: assignedDriverPhone
      })

      if (!driversResult.success || !driversResult.data) {
        return {
          sent: 0,
          failed: 0,
          errors: ['Error al obtener conductores']
        }
      }

      const drivers = driversResult.data
      if (drivers.length === 0) {
        return { sent: 0, failed: 0 }
      }

      const message = MESSAGES.TAXI.OTHER_DRIVERS_NOTIFICATION(assignedDriverName)

      let sent = 0
      let failed = 0
      const errors: string[] = []

      // Notificar a todos los otros conductores
      for (const driver of drivers) {
        try {
          const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(driver.phone)
          await this.provider.sendMessage(formattedPhone, message, {})
          sent++
        } catch (error) {
          failed++
          console.error(`Error notifying driver ${driver.phone}:`, error)
          errors.push(`Error notificando a ${driver.name}`)
        }
      }

      return { sent, failed, errors: errors.length > 0 ? errors : undefined }

    } catch (error) {
      console.error('Error in notifyOtherDriversCareerTaken:', error)
      return {
        sent: 0,
        failed: 0,
        errors: ['Error interno en notificaciones']
      }
    }
  }

  async sendToClient(phone: string, message: string): Promise<boolean> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(phone)
      
      // Enviar presencia antes del mensaje
      await this.provider.vendor.sendPresenceUpdate('composing', formattedPhone)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await this.provider.sendMessage(formattedPhone, message, {})
      return true

    } catch (error) {
      console.error('Error sending to client:', error)
      return false
    }
  }

  async sendToDriver(phone: string, message: string): Promise<boolean> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(phone)
      await this.provider.sendMessage(formattedPhone, message, {})
      return true

    } catch (error) {
      console.error('Error sending to driver:', error)
      return false
    }
  }

  async notifyNoDriversAvailable(clientPhone: string): Promise<boolean> {
    try {
      const message = MESSAGES.TAXI.NO_DRIVERS_AVAILABLE
      return await this.sendToClient(clientPhone, message)

    } catch (error) {
      console.error('Error notifying no drivers available:', error)
      return false
    }
  }

  async notifyRequestTimeout(clientPhone: string): Promise<boolean> {
    try {
      const message = MESSAGES.TAXI.REQUEST_TIMEOUT
      return await this.sendToClient(clientPhone, message)

    } catch (error) {
      console.error('Error notifying request timeout:', error)
      return false
    }
  }

  async broadcastMessage(phones: string[], message: string): Promise<NotificationResult> {
    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const phone of phones) {
      try {
        const success = await this.sendToDriver(phone, message)
        if (success) {
          sent++
        } else {
          failed++
          errors.push(`Error enviando a ${phone}`)
        }
      } catch (error) {
        failed++
        errors.push(`Error enviando a ${phone}: ${error}`)
      }
    }

    return { sent, failed, errors: errors.length > 0 ? errors : undefined }
  }

  async sendPresenceUpdate(phone: string, presence: string): Promise<boolean> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(phone)
      await this.provider.vendor.sendPresenceUpdate(presence as any, formattedPhone)
      return true

    } catch (error) {
      console.error('Error sending presence update:', error)
      return false
    }
  }

  async isPhoneOnWhatsApp(phone: string): Promise<boolean> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(phone)
      const onWhats = await this.provider.vendor.onWhatsApp(formattedPhone)
      return onWhats.length > 0 && onWhats[0].exists

    } catch (error) {
      console.error('Error checking if phone is on WhatsApp:', error)
      return false
    }
  }
}