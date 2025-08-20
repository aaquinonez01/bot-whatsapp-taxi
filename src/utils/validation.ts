import { ValidationResult, LocationData } from "../types/index.js";

export class ValidationUtils {
  static validateName(name: string): ValidationResult {
    if (!name || name.trim().length === 0) {
      return { isValid: false, error: "El nombre no puede estar vacío" };
    }

    if (name.trim().length < 2) {
      return {
        isValid: false,
        error: "El nombre debe tener al menos 2 caracteres",
      };
    }

    if (name.trim().length > 50) {
      return {
        isValid: false,
        error: "El nombre no puede tener más de 50 caracteres",
      };
    }

    return { isValid: true };
  }

  static validateLocation(location: string): ValidationResult {
    if (!location || location.trim().length === 0) {
      return { isValid: false, error: "La ubicación no puede estar vacía" };
    }

    if (location.trim().length < 5) {
      return {
        isValid: false,
        error: "La ubicación debe ser más específica (mínimo 5 caracteres)",
      };
    }

    if (location.trim().length > 200) {
      return {
        isValid: false,
        error: "La ubicación es demasiado larga (máximo 200 caracteres)",
      };
    }

    return { isValid: true };
  }

  static validateLocationData(locationData: LocationData): ValidationResult {
    if (!locationData) {
      return { isValid: false, error: "Los datos de ubicación no pueden estar vacíos" };
    }

    if (!locationData.formatted || locationData.formatted.trim().length === 0) {
      return { isValid: false, error: "La ubicación formateada no puede estar vacía" };
    }

    if (locationData.type === 'whatsapp_location') {
      if (typeof locationData.latitude !== 'number' || typeof locationData.longitude !== 'number') {
        return { isValid: false, error: "Las coordenadas de ubicación deben ser números válidos" };
      }

      if (locationData.latitude < -90 || locationData.latitude > 90) {
        return { isValid: false, error: "La latitud debe estar entre -90 y 90 grados" };
      }

      if (locationData.longitude < -180 || locationData.longitude > 180) {
        return { isValid: false, error: "La longitud debe estar entre -180 y 180 grados" };
      }
    }

    if (locationData.formatted.length > 300) {
      return { isValid: false, error: "La ubicación es demasiado larga (máximo 300 caracteres)" };
    }

    return { isValid: true };
  }

  static createLocationData(location: string): LocationData {
    return {
      type: 'text_address',
      formatted: location.trim()
    };
  }

  static validatePhone(phone: string): ValidationResult {
    if (!phone || phone.trim().length === 0) {
      return { isValid: false, error: "El teléfono no puede estar vacío" };
    }

    // Normalizar distintos formatos (JID WhatsApp, E.164, etc.) a 09XXXXXXXX
    const cleanPhone = ValidationUtils.cleanPhoneNumber(phone);

    // Validar formato ecuatoriano (10 dígitos que inician con 09)
    const phoneRegex = /^09\d{8}$/;

    if (!phoneRegex.test(cleanPhone)) {
      return {
        isValid: false,
        error:
          "El teléfono debe ser un número válido de 10 dígitos que inicie con 09",
      };
    }

    return { isValid: true };
  }

  static validatePlate(plate: string): ValidationResult {
    if (!plate || plate.trim().length === 0) {
      return { isValid: false, error: "La placa no puede estar vacía" };
    }

    // Formato ecuatoriano: 3 letras + 4 números
    const plateRegex = /^[A-Z]{3}\d{4}$/;

    if (!plateRegex.test(plate.toUpperCase())) {
      return {
        isValid: false,
        error: "La placa debe tener formato válido ecuatoriano (ej: ABC1234)",
      };
    }

    return { isValid: true };
  }

  static validateMenuOption(option: string): ValidationResult {
    const validOptions = ["1", "2", "3"];

    if (!validOptions.includes(option.trim())) {
      return {
        isValid: false,
        error: "Por favor selecciona una opción válida (1, 2 o 3)",
      };
    }

    return { isValid: true };
  }

  static validateSupportOption(option: string): ValidationResult {
    const validOptions = ["1", "2", "3"];

    if (!validOptions.includes(option.trim())) {
      return {
        isValid: false,
        error: "Por favor selecciona una opción válida (1, 2 o 3)",
      };
    }

    return { isValid: true };
  }

  static isAcceptCommand(message: string): boolean {
    const acceptCommands = [
      "acepto",
      "acepto",
      "si",
      "sí",
      "ok",
      "vale",
      "listo",
      "tomo",
      "yo",
      "acetar",
      "aceptar",
      "accept",
      "yes",
    ];

    return acceptCommands.some((cmd) =>
      message.toLowerCase().trim().includes(cmd)
    );
  }

  static isRejectCommand(message: string): boolean {
    const rejectCommands = [
      "no",
      "rechazar",
      "rechazo",
      "ocupado",
      "no puedo",
      "imposible",
      "muy lejos",
      "reject",
      "busy",
    ];

    return rejectCommands.some((cmd) =>
      message.toLowerCase().trim().includes(cmd)
    );
  }

  static cleanPhoneNumber(phone: string): string {
    // Quitar dominio de WhatsApp y dejar solo dígitos
    const digitsOnly = phone.replace(/\D/g, "");

    // 1) Local: 09XXXXXXXX (10 dígitos)
    if (/^09\d{8}$/.test(digitsOnly)) {
      return digitsOnly;
    }

    // 2) E.164/JID: 5939XXXXXXXX (12 dígitos: 593 + 9XXXXXXXX)
    if (/^5939\d{8}$/.test(digitsOnly)) {
      return `0${digitsOnly.slice(3)}`; // 0 + 9XXXXXXXX -> 09XXXXXXXX
    }

    // 3) Con sufijo de dispositivo u otros prefijos: tomar los últimos 9 dígitos si empiezan en 9
    const tailNine = digitsOnly.slice(-9);
    if (/^9\d{8}$/.test(tailNine)) {
      return `0${tailNine}`;
    }

    // 4) Sin cero inicial: 9XXXXXXXX (exactamente 9 dígitos)
    if (/^9\d{8}$/.test(digitsOnly)) {
      return `0${digitsOnly}`;
    }

    // Fallback seguro: devolver solo dígitos (evita strings con @s.whatsapp.net)
    return digitsOnly || phone;
  }

  static formatPhoneForWhatsApp(phone: string): string {
    const cleanedLocal = ValidationUtils.cleanPhoneNumber(phone);

    // Si tenemos formato local 09XXXXXXXX, convertir a JID 5939XXXXXXXX@s.whatsapp.net
    if (/^09\d{8}$/.test(cleanedLocal)) {
      const e164 = `593${cleanedLocal.slice(1)}`; // quitar el 0
      return `${e164}@s.whatsapp.net`;
    }

    // Fallback: si viene ya en E.164 (solo dígitos) 5939XXXXXXXX
    const digitsOnly = phone.replace(/\D/g, "");
    if (/^593\d{9,}$/.test(digitsOnly)) {
      return `${digitsOnly}@s.whatsapp.net`;
    }

    // Último recurso: intentar forzar como ECU móvil
    if (/^9\d{8}$/.test(digitsOnly)) {
      return `593${digitsOnly}@s.whatsapp.net`;
    }

    // Como fallback final, devolver el input con sufijo JID para evitar romper el flujo
    return `${digitsOnly || cleanedLocal}@s.whatsapp.net`;
  }
}
