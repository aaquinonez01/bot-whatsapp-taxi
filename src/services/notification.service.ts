import { BaileysProvider } from "@builderbot/provider-baileys";
import { DriverService } from "./driver.service.js";
import { ValidationUtils } from "../utils/validation.js";
import { ConnectionManager } from "../utils/connection-manager.js";
import { NotificationResult, TaxiRequest, Driver, LocationData } from "../types/index.js";
import { MESSAGES } from "../constants/messages.js";
import { config } from "../config/environments.js";

export class NotificationService {
  private provider: BaileysProvider;
  private driverService: DriverService;
  private connectionManager: ConnectionManager;

  constructor(provider: BaileysProvider, performanceMonitor?: any) {
    this.provider = provider;
    this.driverService = new DriverService();
    this.connectionManager = new ConnectionManager(provider, performanceMonitor);
  }

  async sendToAllActiveDrivers(
    request: TaxiRequest,
    excludePhone?: string
  ): Promise<NotificationResult> {
    try {
      // Obtener todos los conductores activos
      const driversResult = await this.driverService.getAllActiveDrivers({
        isActive: true,
        excludePhone,
      });

      if (!driversResult.success || !driversResult.data) {
        return {
          sent: 0,
          failed: 0,
          errors: ["Error al obtener conductores activos"],
        };
      }

      const drivers = driversResult.data;
      if (drivers.length === 0) {
        return {
          sent: 0,
          failed: 0,
          errors: ["No hay conductores activos disponibles"],
        };
      }

      // Preparar mensaje de notificación usando el sector si está disponible
      const locationToShow = request.sector || request.location;
      console.log(`📍 Ubicación que se mostrará al conductor: ${locationToShow}`);
      console.log(`🔍 request.sector: ${request.sector}`);
      console.log(`🔍 request.location: ${request.location}`);
      
      const message = MESSAGES.TAXI.DRIVER_NOTIFICATION(
        request.clientName,
        locationToShow,
        request.id
      );

      // Usar envío paralelo si está habilitado
      if (config.performance.enableParallelNotifications) {
        return await this.sendNotificationsInParallel(drivers, request, message);
      } else {
        return await this.sendNotificationsSequentially(drivers, request, message);
      }
    } catch (error) {
      console.error("Error in sendToAllActiveDrivers:", error);
      return {
        sent: 0,
        failed: 0,
        errors: ["Error interno en el servicio de notificaciones"],
      };
    }
  }

  private async sendNotificationsInParallel(
    drivers: Driver[], 
    request: TaxiRequest, 
    message: string
  ): Promise<NotificationResult> {
    console.log(`🚀 Enviando notificaciones en paralelo a ${drivers.length} conductores (VPS: 2 CPUs, 8GB RAM)`);
    
    let totalSent = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];

    // Con 2 CPUs, podemos procesar múltiples lotes simultáneamente
    const maxParallelBatches = config.performance.maxParallelBatches || 2;
    const batchSize = config.performance.batchSize;
    
    // Dividir todos los conductores en grupos de lotes
    const allBatches: Driver[][] = [];
    for (let i = 0; i < drivers.length; i += batchSize) {
      allBatches.push(drivers.slice(i, i + batchSize));
    }

    console.log(`📊 Configuración optimizada para VPS: ${allBatches.length} lotes, ${maxParallelBatches} lotes simultáneos`);

    // Procesar lotes en grupos paralelos
    for (let i = 0; i < allBatches.length; i += maxParallelBatches) {
      const batchGroup = allBatches.slice(i, i + maxParallelBatches);
      console.log(`🔄 Procesando grupo ${Math.floor(i/maxParallelBatches) + 1}/${Math.ceil(allBatches.length/maxParallelBatches)} (${batchGroup.length} lotes simultáneos)`);

      // Procesar lotes del grupo en paralelo
      const batchPromises = batchGroup.map(async (batch, batchIndex) => {
        const actualBatchNumber = i + batchIndex + 1;
        console.log(`📦 Lote ${actualBatchNumber}: Procesando ${batch.length} conductores`);

        // Enviar mensajes del lote en paralelo
        const promises = batch.map(driver => this.sendToSingleDriver(driver, request, message));
        const results = await Promise.allSettled(promises);

        let batchSent = 0;
        let batchFailed = 0;
        const batchErrors: string[] = [];

        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.success) {
            batchSent++;
          } else {
            batchFailed++;
            const driverName = batch[index].name;
            const error = result.status === 'rejected' ? result.reason : result.value.error;
            batchErrors.push(`Error enviando a ${driverName}: ${error}`);
          }
        });

        console.log(`✅ Lote ${actualBatchNumber} completado: ${batchSent}/${batch.length} enviados`);
        return { sent: batchSent, failed: batchFailed, errors: batchErrors };
      });

      // Esperar que terminen todos los lotes del grupo
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Consolidar resultados
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          totalSent += result.value.sent;
          totalFailed += result.value.failed;
          allErrors.push(...result.value.errors);
        }
      });

      // Delay entre grupos de lotes si no es el último grupo
      if (i + maxParallelBatches < allBatches.length) {
        console.log(`⏳ Esperando ${config.performance.batchDelay}ms antes del siguiente grupo de lotes...`);
        await new Promise(resolve => setTimeout(resolve, config.performance.batchDelay));
      }
    }

    console.log(`✅ Envío paralelo optimizado completado: ${totalSent} enviados, ${totalFailed} fallidos`);
    console.log(`📈 Rendimiento: ${drivers.length} conductores procesados con 2 CPUs en ${Math.ceil(allBatches.length/maxParallelBatches)} grupos`);
    
    return {
      sent: totalSent,
      failed: totalFailed,
      errors: allErrors.length > 0 ? allErrors : undefined
    };
  }

  private async sendNotificationsSequentially(
    drivers: Driver[], 
    request: TaxiRequest, 
    message: string
  ): Promise<NotificationResult> {
    console.log(`🐌 Enviando notificaciones secuencialmente a ${drivers.length} conductores`);
    
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const driver of drivers) {
      const result = await this.sendToSingleDriver(driver, request, message);
      if (result.success) {
        sent++;
      } else {
        failed++;
        errors.push(`Error enviando a ${driver.name}: ${result.error}`);
      }
    }

    console.log(`✅ Envío secuencial completado: ${sent} enviados, ${failed} fallidos`);
    return {
      sent,
      failed,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private async sendToSingleDriver(
    driver: Driver, 
    request: TaxiRequest, 
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(driver.phone);

      // Si hay locationData de WhatsApp, enviar PRIMERO el mapa
      if (request.locationData && request.locationData.type === 'whatsapp_location' && 
          request.locationData.latitude && request.locationData.longitude) {
        
        console.log(`🗺️ SENDING LOCATION MAP FIRST to driver ${driver.name} (${driver.phone})`);
        
        const locationPayload = {
          location: {
            degreesLatitude: request.locationData.latitude,
            degreesLongitude: request.locationData.longitude,
            name: request.locationData.name || "Ubicación del cliente",
            address: request.locationData.address || ""
          }
        };
        
        // Usar ConnectionManager para enviar con retry
        const locationSent = await this.connectionManager.sendVendorMessageWithRetry(
          formattedPhone, 
          locationPayload
        );
        
        if (!locationSent) {
          console.warn(`⚠️ Failed to send location map to ${driver.phone}, continuing with message...`);
        }
        
        // Pequeño delay para asegurar que el mapa se envíe antes del mensaje
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Enviar mensaje de solicitud usando ConnectionManager con retry
      const messageSent = await this.connectionManager.sendMessageWithRetry(
        formattedPhone, 
        message, 
        {}
      );

      if (messageSent) {
        console.log(`✅ Message sent successfully to ${driver.name} (${driver.phone})`);
        return { success: true };
      } else {
        return { success: false, error: "Failed to send after retries" };
      }
    } catch (error) {
      console.error(`❌ Error sending to driver ${driver.phone}:`, error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async notifyClientAssignment(
    request: TaxiRequest,
    driver: Driver
  ): Promise<boolean> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(
        request.clientPhone
      );

      // Generar tiempo aleatorio entre 5 y 12 minutos
      const tiempoEstimado = Math.floor(Math.random() * (12 - 5 + 1)) + 5;
      
      const message =
        "¡Taxi asignado!\n\n" +
        MESSAGES.TAXI.CLIENT_ASSIGNED(driver.name, driver.plate, driver.phone) +
        `\n\n⏰ El taxi estará aproximadamente en ${tiempoEstimado} minutos` +
        "\n\n✅ Tu solicitud ha sido procesada exitosamente.";

      // Enviar presencia de "typing" antes del mensaje
      await this.provider.vendor.sendPresenceUpdate(
        "composing",
        formattedPhone
      );

      // Esperar un momento para simular escritura
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Enviar mensaje al cliente
      await this.provider.sendMessage(formattedPhone, message, {});

      // Enviar mensaje adicional de cancelación disponible
      await new Promise((resolve) => setTimeout(resolve, 500));
      await this.provider.sendMessage(formattedPhone, MESSAGES.TAXI.CLIENT_CANCELLATION_AVAILABLE, {});

      return true;
    } catch (error) {
      console.error("Error notifying client assignment:", error);
      return false;
    }
  }

  async notifyDriverAccepted(driverPhone: string): Promise<boolean> {
    try {
      const formattedPhone =
        ValidationUtils.formatPhoneForWhatsApp(driverPhone);

      const message = MESSAGES.TAXI.DRIVER_ACCEPTED;

      await this.provider.sendMessage(formattedPhone, message, {});

      return true;
    } catch (error) {
      console.error("Error notifying driver accepted:", error);
      return false;
    }
  }

  async notifyDriverTooLate(driverPhone: string): Promise<boolean> {
    try {
      const formattedPhone =
        ValidationUtils.formatPhoneForWhatsApp(driverPhone);

      const message = MESSAGES.TAXI.DRIVER_TOO_LATE;

      await this.provider.sendMessage(formattedPhone, message, {});

      return true;
    } catch (error) {
      console.error("Error notifying driver too late:", error);
      return false;
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
        excludePhone: assignedDriverPhone,
      });

      if (!driversResult.success || !driversResult.data) {
        return {
          sent: 0,
          failed: 0,
          errors: ["Error al obtener conductores"],
        };
      }

      const drivers = driversResult.data;
      if (drivers.length === 0) {
        return { sent: 0, failed: 0 };
      }

      const message =
        MESSAGES.TAXI.OTHER_DRIVERS_NOTIFICATION(assignedDriverName);

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      // Notificar a todos los otros conductores
      for (const driver of drivers) {
        try {
          const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(
            driver.phone
          );
          await this.provider.sendMessage(formattedPhone, message, {});
          sent++;
        } catch (error) {
          failed++;
          console.error(`Error notifying driver ${driver.phone}:`, error);
          errors.push(`Error notificando a ${driver.name}`);
        }
      }

      return { sent, failed, errors: errors.length > 0 ? errors : undefined };
    } catch (error) {
      console.error("Error in notifyOtherDriversCareerTaken:", error);
      return {
        sent: 0,
        failed: 0,
        errors: ["Error interno en notificaciones"],
      };
    }
  }

  async sendToClient(phone: string, message: string): Promise<boolean> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(phone);

      // Enviar presencia antes del mensaje
      await this.provider.vendor.sendPresenceUpdate(
        "composing",
        formattedPhone
      );
      await new Promise((resolve) => setTimeout(resolve, 500));

      await this.provider.sendMessage(formattedPhone, message, {});
      return true;
    } catch (error) {
      console.error("Error sending to client:", error);
      return false;
    }
  }

  async sendToDriver(phone: string, message: string): Promise<boolean> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(phone);
      await this.provider.sendMessage(formattedPhone, message, {});
      return true;
    } catch (error) {
      console.error("Error sending to driver:", error);
      return false;
    }
  }

  async notifyNoDriversAvailable(clientPhone: string): Promise<boolean> {
    try {
      const message = MESSAGES.TAXI.NO_DRIVERS_AVAILABLE;
      return await this.sendToClient(clientPhone, message);
    } catch (error) {
      console.error("Error notifying no drivers available:", error);
      return false;
    }
  }

  async notifyRequestTimeout(clientPhone: string): Promise<boolean> {
    try {
      const message = MESSAGES.TAXI.REQUEST_TIMEOUT;
      return await this.sendToClient(clientPhone, message);
    } catch (error) {
      console.error("Error notifying request timeout:", error);
      return false;
    }
  }

  async broadcastMessage(
    phones: string[],
    message: string
  ): Promise<NotificationResult> {
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const phone of phones) {
      try {
        const success = await this.sendToDriver(phone, message);
        if (success) {
          sent++;
        } else {
          failed++;
          errors.push(`Error enviando a ${phone}`);
        }
      } catch (error) {
        failed++;
        errors.push(`Error enviando a ${phone}: ${error}`);
      }
    }

    return { sent, failed, errors: errors.length > 0 ? errors : undefined };
  }

  async sendPresenceUpdate(phone: string, presence: string): Promise<boolean> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(phone);
      await this.provider.vendor.sendPresenceUpdate(
        presence as any,
        formattedPhone
      );
      return true;
    } catch (error) {
      console.error("Error sending presence update:", error);
      return false;
    }
  }

  async isPhoneOnWhatsApp(phone: string): Promise<boolean> {
    try {
      const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(phone);
      const onWhats = await this.provider.vendor.onWhatsApp(formattedPhone);
      return onWhats.length > 0 && (onWhats[0].exists as boolean);
    } catch (error) {
      console.error("Error checking if phone is on WhatsApp:", error);
      return false;
    }
  }
}
