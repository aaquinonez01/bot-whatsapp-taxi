import { BaileysProvider } from "@builderbot/provider-baileys";
import { DriverService } from "./driver.service.js";
import { ValidationUtils } from "../utils/validation.js";
import { NotificationResult, TaxiRequest, Driver, LocationData } from "../types/index.js";
import { MESSAGES } from "../constants/messages.js";

export class NotificationService {
  private provider: BaileysProvider;
  private driverService: DriverService;

  constructor(provider: BaileysProvider) {
    this.provider = provider;
    this.driverService = new DriverService();
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

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      // Enviar notificación a cada conductor
      for (const driver of drivers) {
        try {
          const formattedPhone = ValidationUtils.formatPhoneForWhatsApp(
            driver.phone
          );

          // Si hay locationData de WhatsApp, enviar PRIMERO el mapa
          if (request.locationData && request.locationData.type === 'whatsapp_location' && 
              request.locationData.latitude && request.locationData.longitude) {
            
            console.log(`🗺️ SENDING LOCATION MAP FIRST to driver ${driver.name} (${driver.phone})`);
            console.log(`📍 Coordinates: ${request.locationData.latitude}, ${request.locationData.longitude}`);
            console.log(`📍 Name: ${request.locationData.name}`);
            console.log(`📍 Address: ${request.locationData.address}`);
            
            // Enviar ubicación como mapa PRIMERO
            const locationPayload = {
              location: {
                degreesLatitude: request.locationData.latitude,
                degreesLongitude: request.locationData.longitude,
                name: request.locationData.name || "Ubicación del cliente",
                address: request.locationData.address || ""
              }
            };
            
            console.log(`📤 Location payload:`, JSON.stringify(locationPayload, null, 2));
            
            try {
              await this.provider.vendor.sendMessage(formattedPhone, locationPayload);
              console.log(`✅ Location map sent successfully to ${driver.phone}`);
              
              // Pequeño delay para asegurar que el mapa se envíe antes del mensaje
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (locationError) {
              console.error(`❌ Error sending location map to ${driver.phone}:`, locationError);
            }
          } else {
            console.log(`📍 No location data to send as map for driver ${driver.phone}`);
            if (request.locationData) {
              console.log(`📍 LocationData type: ${request.locationData.type}`);
              console.log(`📍 Has coordinates: lat=${!!request.locationData.latitude}, lng=${!!request.locationData.longitude}`);
            }
          }

          // Enviar mensaje de solicitud AL FINAL para que sea el último contexto
          await this.provider.sendMessage(formattedPhone, message, {});

          sent++;
        } catch (error) {
          failed++;
          console.error(`Error sending to driver ${driver.phone}:`, error);
          errors.push(`Error enviando a ${driver.name} (${driver.phone})`);
        }
      }

      return { sent, failed, errors: errors.length > 0 ? errors : undefined };
    } catch (error) {
      console.error("Error in sendToAllActiveDrivers:", error);
      return {
        sent: 0,
        failed: 0,
        errors: ["Error interno en el servicio de notificaciones"],
      };
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
