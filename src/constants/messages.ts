export const MESSAGES = {
  GREETING: "¡Hola! Bienvenido a Taxi Cooperativa 🚕",
  DRIVER_WELCOME: "Hola conductor, Espero que tenga un buen día, estaré pendiente de todas las solicitudes de los clientes.",
  MENU: `Selecciona una opción:
1️⃣ Pedir un taxi`,
  
  TAXI: {
    ASK_NAME: "Por favor, dime tu nombre:",
    ASK_LOCATION: "📍 Es necesario que envíes tu ubicación usando la opción de WhatsApp\n\n⚠️ IMPORTANTE: Usa el botón de ubicación 📍 de WhatsApp para obtener tu ubicación exacta",
    SEARCHING: "🔍 Buscando taxi disponible, por favor espera un momento...",
    
    CLIENT_ASSIGNED: (driverName: string, plate: string, driverPhone: string) => 
      `✅ ¡Taxi asignado!\n👤 Conductor: ${driverName}\n🚗 Placa: ${plate}\n📱 Teléfono: ${driverPhone}`,
    
    DRIVER_NOTIFICATION: (clientName: string, location: string, requestId: string) => 
      `🚕 Nueva solicitud de taxi:\n👤 Cliente: ${clientName}\n📍 Ubicación: ${location}\n\n1️⃣ Presiona "1" para aceptar esta carrera`,
    
    DRIVER_ACCEPTED: "✅ ¡Carrera asignada! El cliente recibirá tu información.",
    
    DRIVER_TOO_LATE: "❌ Esta carrera ya fue tomada por otro conductor.",
    
    NO_PENDING_REQUESTS: "No hay carreras pendientes en este momento. Te notificaremos cuando lleguen solicitudes.",
    
    OTHER_DRIVERS_NOTIFICATION: (driverName: string) => 
      `❌ La carrera fue tomada por ${driverName}`,
      
    NO_DRIVERS_AVAILABLE: "😔 Lo siento, no hay conductores disponibles en este momento. Por favor intenta más tarde.",
    
    REQUEST_TIMEOUT: "⏰ Tu solicitud de taxi ha expirado. Por favor, solicita un nuevo taxi si aún lo necesitas."
  },
  
  SUPPORT: {
    MENU: `🛠️ Soporte al Cliente:
1️⃣ Problema con mi carrera
2️⃣ Hablar con operador
3️⃣ Preguntas frecuentes`,
    
    OPERATOR_CONTACT: "👥 Un operador se comunicará contigo pronto. Nuestro número directo es: +57 300 123 4567",
    
    FAQ: `❓ Preguntas Frecuentes:
• ¿Cuánto demora un taxi? Entre 5-15 minutos
• ¿Cómo pago? Efectivo o transferencia
• ¿Horarios? 24/7 todos los días
• ¿Tarifas? Según taxímetro + $2000 banderazo`
  },
  
  INFO: {
    COOPERATIVE: `🏢 Taxi Cooperativa
📞 Teléfono: +57 300 123 4567
📧 Email: info@taxicooperativa.com
🌐 Web: www.taxicooperativa.com

🕐 Horarios: 24 horas, 7 días a la semana
💰 Tarifas: Según taxímetro oficial + banderazo
🚗 Flota: 150 vehículos disponibles`
  },
  
  VALIDATION: {
    INVALID_OPTION: "Por favor selecciona la opción 1 para pedir un taxi",
    EMPTY_NAME: "Por favor ingresa tu nombre",
    EMPTY_LOCATION: "Por favor ingresa tu ubicación",
    DRIVER_NOT_FOUND: "No estás registrado como conductor de la cooperativa",
    INVALID_COMMAND: "No entiendo ese comando. Escribe 'menu' para ver las opciones disponibles."
  },
  
  ERRORS: {
    SYSTEM_ERROR: "🔧 Ha ocurrido un error del sistema. Por favor intenta nuevamente.",
    DATABASE_ERROR: "📊 Error de conexión a la base de datos. Contacta soporte.",
    DRIVER_REGISTRATION_ERROR: "❌ Error al registrar conductor. Verifica tus datos."
  }
}