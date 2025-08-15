import { ValidationResult } from '../types/index.js'

export class ValidationUtils {
  static validateName(name: string): ValidationResult {
    if (!name || name.trim().length === 0) {
      return { isValid: false, error: 'El nombre no puede estar vacío' }
    }
    
    if (name.trim().length < 2) {
      return { isValid: false, error: 'El nombre debe tener al menos 2 caracteres' }
    }
    
    if (name.trim().length > 50) {
      return { isValid: false, error: 'El nombre no puede tener más de 50 caracteres' }
    }
    
    return { isValid: true }
  }

  static validateLocation(location: string): ValidationResult {
    if (!location || location.trim().length === 0) {
      return { isValid: false, error: 'La ubicación no puede estar vacía' }
    }
    
    if (location.trim().length < 5) {
      return { isValid: false, error: 'La ubicación debe ser más específica (mínimo 5 caracteres)' }
    }
    
    if (location.trim().length > 200) {
      return { isValid: false, error: 'La ubicación es demasiado larga (máximo 200 caracteres)' }
    }
    
    return { isValid: true }
  }

  static validatePhone(phone: string): ValidationResult {
    if (!phone || phone.trim().length === 0) {
      return { isValid: false, error: 'El teléfono no puede estar vacío' }
    }
    
    // Remover espacios y caracteres especiales
    const cleanPhone = phone.replace(/[\s\-()]/g, '')
    
    // Validar formato colombiano (10 dígitos que inician con 3)
    const phoneRegex = /^3\d{9}$/
    
    if (!phoneRegex.test(cleanPhone)) {
      return { isValid: false, error: 'El teléfono debe ser un número válido de 10 dígitos que inicie con 3' }
    }
    
    return { isValid: true }
  }

  static validatePlate(plate: string): ValidationResult {
    if (!plate || plate.trim().length === 0) {
      return { isValid: false, error: 'La placa no puede estar vacía' }
    }
    
    // Formato colombiano: 3 letras + 3 números o nuevo formato
    const plateRegex = /^[A-Z]{3}\d{3}$|^[A-Z]{3}\d{2}[A-Z]$/
    
    if (!plateRegex.test(plate.toUpperCase())) {
      return { isValid: false, error: 'La placa debe tener formato válido (ej: ABC123 o ABC12D)' }
    }
    
    return { isValid: true }
  }

  static validateMenuOption(option: string): ValidationResult {
    const validOptions = ['1', '2', '3']
    
    if (!validOptions.includes(option.trim())) {
      return { isValid: false, error: 'Por favor selecciona una opción válida (1, 2 o 3)' }
    }
    
    return { isValid: true }
  }

  static validateSupportOption(option: string): ValidationResult {
    const validOptions = ['1', '2', '3']
    
    if (!validOptions.includes(option.trim())) {
      return { isValid: false, error: 'Por favor selecciona una opción válida (1, 2 o 3)' }
    }
    
    return { isValid: true }
  }

  static isAcceptCommand(message: string): boolean {
    const acceptCommands = [
      'acepto', 'acepto', 'si', 'sí', 'ok', 'vale', 'listo', 
      'tomo', 'yo', 'acetar', 'aceptar', 'accept', 'yes'
    ]
    
    return acceptCommands.some(cmd => 
      message.toLowerCase().trim().includes(cmd)
    )
  }

  static isRejectCommand(message: string): boolean {
    const rejectCommands = [
      'no', 'rechazar', 'rechazo', 'ocupado', 'no puedo', 
      'imposible', 'muy lejos', 'reject', 'busy'
    ]
    
    return rejectCommands.some(cmd => 
      message.toLowerCase().trim().includes(cmd)
    )
  }

  static cleanPhoneNumber(phone: string): string {
    // Remover códigos de país y formatear a número colombiano estándar
    let cleaned = phone.replace(/[\s\-()]/g, '')
    
    // Si tiene código de país +57, removerlo
    if (cleaned.startsWith('+57')) {
      cleaned = cleaned.substring(3)
    } else if (cleaned.startsWith('57')) {
      cleaned = cleaned.substring(2)
    }
    
    // Asegurar que tenga 10 dígitos
    if (cleaned.length === 10 && cleaned.startsWith('3')) {
      return cleaned
    }
    
    return phone // Retornar original si no se puede limpiar
  }

  static formatPhoneForWhatsApp(phone: string): string {
    const cleaned = ValidationUtils.cleanPhoneNumber(phone)
    return `57${cleaned}@s.whatsapp.net`
  }
}