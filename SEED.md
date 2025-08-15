# 🌱 Database Seeding - Taxi Cooperativa

Archivos de seed para poblar la base de datos con datos de prueba.

## 📋 Archivos Disponibles

### 1. `seed.ts` - Seed Básico
- **15 conductores** con datos realistas
- **13 activos**, 2 inactivos
- Diferentes ubicaciones de Ecuador
- Placas vehiculares válidas

### 2. `seed-full.ts` - Seed Completo
- **10 conductores** + **5 solicitudes de ejemplo**
- Estados variados: PENDING, ASSIGNED, COMPLETED, CANCELLED
- Datos relacionales (solicitudes asignadas a conductores)
- Fechas aleatorias en las últimas 24 horas

## 🚀 Uso

### Preparación Inicial
```bash
# 1. Configurar base de datos
npm run db:generate
npm run db:push

# 2. Ejecutar seed básico
npm run db:seed

# O seed completo
npm run db:seed:full
```

### Scripts Disponibles
```bash
npm run db:seed       # Solo conductores
npm run db:seed:full  # Conductores + solicitudes
npm run db:studio     # Abrir Prisma Studio
npm run db:reset      # Resetear BD completamente
```

## 👥 Conductores Generados

### Conductores Activos (disponibles para carreras)

| Nombre | Teléfono | Placa | Ubicación |
|--------|----------|--------|-----------|
| Carlos Rodriguez | 3001234567 | ABC123 | Centro - Calle 10 con Carrera 15 |
| María González | 3012345678 | DEF456 | Norte - Av. Caracas con Calle 80 |
| Luis Hernández | 3023456789 | GHI789 | Sur - Portal del Sur |
| Ana Martínez | 3034567890 | JKL012 | Chapinero - Zona Rosa |
| Patricia Ruiz | 3056789012 | PQR678 | Engativá - Centro |
| Roberto Castro | 3067890123 | STU901 | Suba - Plaza Central |
| Diana López | 3078901234 | VWX234 | Bosa - Portal |
| Miguel Torres | 3089012345 | YZA567 | Kennedy - Biblioteca |
| Carmen Vargas | 3090123456 | BCD890 | Fontibón - Aeropuerto |
| Claudia Morales | 3112345678 | HIJ456 | San Cristóbal - Centro |
| Andrés Peña | 3123456789 | KLM789 | Rafael Uribe - Sur |
| Sofía Ramírez | 3134567890 | NOP012 | Tunjuelito - Centro |
| Alejandro Cruz | 3145678901 | QRS345 | Barrios Unidos - Centro |

### Conductores Inactivos (para testing de estados)

| Nombre | Teléfono | Placa | Ubicación |
|--------|----------|--------|-----------|
| Jorge Silva | 3045678901 | MNO345 | Usaquén - Centro Comercial |
| Fernando Jiménez | 3101234567 | EFG123 | Puente Aranda - Centro |

## 🚖 Solicitudes de Ejemplo (seed-full.ts)

| Cliente | Teléfono | Ubicación | Estado |
|---------|----------|-----------|---------|
| Juan Pérez | 3201234567 | Universidad Nacional | ✅ COMPLETED |
| Andrea López | 3202345678 | Centro Comercial Unicentro | ✅ COMPLETED |
| Carlos Mendoza | 3203456789 | Hospital San Juan de Dios | 🔄 ASSIGNED |
| Lucía Ramírez | 3204567890 | Aeropuerto El Dorado | ⏳ PENDING |
| Pedro García | 3205678901 | Estación Transmilenio | ❌ CANCELLED |

## 🧪 Testing del Sistema

### 1. Probar Flujo de Cliente
```
Usar cualquier número no registrado como conductor
→ "hola" → "1" → "Tu nombre" → "Tu ubicación"
```

### 2. Probar Flujo de Conductor
```
Usar número de conductor registrado (ej: +573001234567)
→ "acepto" (para aceptar carrera)
→ "activo" / "inactivo" (cambiar estado)
→ "mi info" (ver perfil)
```

### 3. Probar Asignación "Primer en Responder"
```
1. Cliente solicita taxi
2. Múltiples conductores escriben "acepto"
3. Solo el primero obtiene la carrera
4. Otros reciben "carrera ya tomada"
```

## 📊 Verificar Datos

### Usando Prisma Studio
```bash
npm run db:studio
# Abre http://localhost:5555
```

### Usando API Endpoints
```bash
# Estadísticas
curl http://localhost:3008/v1/stats

# Lista de conductores
curl http://localhost:3008/v1/drivers
```

## 🔄 Limpiar y Recrear

### Resetear Todo
```bash
npm run db:reset
npm run db:push
npm run db:seed:full
```

### Solo Nuevos Datos
```bash
# El seed automáticamente limpia datos existentes
npm run db:seed:full
```

## 🛠️ Personalización

### Agregar Más Conductores
Editar `driversData` en `seed.ts`:
```typescript
{
  name: 'Nuevo Conductor',
  phone: '3151234567',
  location: 'Nueva Ubicación',
  plate: 'XYZ999',
  isActive: true
}
```

### Cambiar Teléfonos
- Usar formato colombiano: 10 dígitos iniciando en 3
- Números únicos (no duplicados)
- Para Ecuador: cambiar prefijo en ValidationUtils

### Personalizar Ubicaciones
- Cambiar ubicaciones por zonas reales de tu ciudad
- Incluir referencias conocidas (centros comerciales, hospitales)
- Mantener descripciones cortas pero descriptivas

## ⚠️ Importante

1. **Números Reales**: Los números generados son ficticios
2. **WhatsApp**: Para testing, usar números reales registrados en WhatsApp
3. **Limpieza**: El seed borra datos existentes automáticamente
4. **Backup**: Hacer backup antes de ejecutar en producción

## 🔍 Troubleshooting

### Error: "Phone already exists"
- Los números están duplicados
- Verificar unicidad en `driversData`

### Error: "Prisma client not generated"
```bash
npm run db:generate
```

### Error: "Database connection"
- Verificar DATABASE_URL en .env
- Confirmar que PostgreSQL esté ejecutándose

### Números de WhatsApp No Válidos
- Cambiar números a formato real de tu país
- Verificar que estén registrados en WhatsApp Business

---

💡 **Tip**: Usar `seed.ts` para desarrollo y `seed-full.ts` para demos completas.