# 🚕 Taxi Cooperativa Bot

Chatbot de WhatsApp para gestión de solicitudes de taxi con sistema de asignación automatizada a conductores.

## ✨ Características

- **Sistema de menú interactivo** para clientes
- **Asignación automática** de carreras al primer conductor en responder
- **Gestión de conductores** (registro, estado, ubicación)
- **Base de datos PostgreSQL** con Prisma
- **Notificaciones masivas** a conductores
- **API REST** para gestión administrativa
- **Optimización de recursos** con Baileys
- **Validaciones robustas** de datos

## 🏗️ Arquitectura

```
src/
├── config/           # Configuración y variables de entorno
├── database/         # Schema Prisma y configuración BD
├── flows/           # Flujos de conversación del bot
├── services/        # Lógica de negocio
├── constants/       # Mensajes centralizados
├── types/          # Tipos TypeScript
└── utils/          # Utilidades y validaciones
```

## 📋 Requisitos Previos

- Node.js 18+
- PostgreSQL 12+
- Número de WhatsApp Business

## 🚀 Instalación

1. **Clonar e instalar dependencias**
```bash
npm install
```

2. **Instalar dependencias adicionales requeridas**
```bash
npm install prisma @prisma/client uuid @types/uuid
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus datos
```

4. **Configurar base de datos**
```bash
# Generar cliente Prisma
npm run db:generate

# Crear tablas en BD
npm run db:push

# Poblar con datos de prueba (opcional)
npm run db:seed:full
```

5. **Iniciar en desarrollo**
```bash
npm run dev
```

## 🔧 Configuración

### Variables de Entorno (.env)

```env
# Base de datos
DATABASE_URL="postgresql://usuario:password@localhost:5432/taxi_cooperativa"

# WhatsApp
WHATSAPP_PHONE="+573001234567"
USE_PAIRING_CODE=true

# Servidor
PORT=3008

# Configuración de carreras
REQUEST_TIMEOUT_MINUTES=10
CLEANUP_INTERVAL_MINUTES=30
```

### Base de Datos

Estructura de tablas:

- **drivers**: Información de conductores
- **taxi_requests**: Solicitudes de taxi
- **RequestStatus**: PENDING, ASSIGNED, COMPLETED, CANCELLED

## 📱 Uso del Bot

### Para Clientes

1. **Iniciar conversación**: "hola", "menu"
2. **Pedir taxi**: Opción 1 → Nombre → Ubicación
3. **Consultar estado**: "estado", "mi solicitud"
4. **Cancelar**: "cancelar"

### Para Conductores

1. **Aceptar carrera**: "acepto", "si", "ok"
2. **Rechazar carrera**: "no", "ocupado"
3. **Cambiar estado**: "activo", "inactivo"
4. **Actualizar ubicación**: "ubicacion"
5. **Ver perfil**: "mi info"

### Para Administradores

- **Registrar conductor**: "registrar conductor"
- **API REST**: `http://localhost:3008/v1/`

## 🔗 Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/v1/stats` | Estadísticas generales |
| GET | `/v1/drivers` | Lista de conductores |
| POST | `/v1/driver/register` | Registrar conductor |
| POST | `/v1/messages` | Enviar mensaje |
| POST | `/v1/blacklist` | Gestionar blacklist |

## 🎯 Flujo de Asignación

1. **Cliente solicita taxi** → Se crea solicitud PENDING
2. **Notificación masiva** → Todos los conductores activos reciben mensaje
3. **Primer conductor acepta** → Se asigna automáticamente
4. **Cliente recibe info** → Datos del conductor asignado
5. **Otros conductores notificados** → "Carrera ya tomada"

## 📊 Funcionalidades Avanzadas

### Validaciones Implementadas

- ✅ Formato de teléfonos colombianos
- ✅ Nombres (2-50 caracteres)
- ✅ Ubicaciones (5-200 caracteres)
- ✅ Placas vehiculares colombianas
- ✅ Opciones de menú

### Optimizaciones Baileys

- ✅ `experimentalStore: true` (reduce recursos)
- ✅ `timeRelease: 3h` (limpieza automática)
- ✅ Control de presencia (typing indicators)
- ✅ Verificación de números WhatsApp

### Gestión de Estados

- ✅ Control de concurrencia en asignaciones
- ✅ Timeout automático de solicitudes (10 min)
- ✅ Limpieza programada de datos (30 min)
- ✅ Manejo de errores robusto

## 🔧 Scripts Disponibles

```bash
npm run dev          # Desarrollo con hot-reload
npm run build        # Compilar para producción
npm run start        # Ejecutar en producción
npm run lint         # Verificar código

# Base de datos
npm run db:generate  # Generar cliente Prisma
npm run db:push     # Aplicar schema a BD
npm run db:migrate  # Crear migración
npm run db:studio   # Abrir Prisma Studio
npm run db:reset    # Resetear BD
npm run db:seed     # Poblar con conductores
npm run db:seed:full # Poblar con conductores + solicitudes
```

## 📈 Monitoreo

### Logs del Sistema

- ✅ Carreras asignadas
- ✅ Conductores notificados
- ✅ Errores de sistema
- ✅ Limpieza automática

### Métricas Disponibles

- Total de conductores (activos/inactivos)
- Solicitudes (pendientes/asignadas/completadas)
- Estadísticas de asignación
- Tiempo de respuesta

## 🛡️ Seguridad

- ✅ Validación de todos los inputs
- ✅ Control de acceso por roles (cliente/conductor)
- ✅ Rate limiting implícito por WhatsApp
- ✅ Sanitización de datos
- ✅ Logs sin información sensible

## 🚨 Solución de Problemas

### Errores Comunes

1. **Error de permisos npm**: Ejecutar como administrador
2. **Base de datos no conecta**: Verificar DATABASE_URL
3. **QR no aparece**: Verificar configuración WHATSAPP_PHONE
4. **Memoria alta**: Activar experimentalStore

### Mantenimiento

- Reiniciar bot cada 12-24h (recomendado)
- Monitorear uso de memoria
- Limpiar logs antiguos
- Backup de configuración

## 📄 Licencia

MIT License - Ver archivo LICENSE para detalles.

## 🤝 Contribuciones

1. Fork del proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📞 Soporte

Para soporte técnico:
- 📧 Email: soporte@taxicooperativa.com
- 📱 WhatsApp: +57 300 123 4567
- 💬 Issues: GitHub Issues

---

Desarrollado con ❤️ para Taxi Cooperativa