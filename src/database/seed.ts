import { PrismaClient } from './generated/client/index.js'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

const driversData = [
  {
    name: 'Carlos Rodriguez',
    phone: '3001234567',
    location: 'Centro - Calle 10 con Carrera 15',
    plate: 'ABC123',
    isActive: true
  },
  {
    name: 'María González',
    phone: '3012345678',
    location: 'Norte - Av. Caracas con Calle 80',
    plate: 'DEF456',
    isActive: true
  },
  {
    name: 'Luis Hernández',
    phone: '3023456789',
    location: 'Sur - Portal del Sur',
    plate: 'GHI789',
    isActive: true
  },
  {
    name: 'Ana Martínez',
    phone: '3034567890',
    location: 'Chapinero - Zona Rosa',
    plate: 'JKL012',
    isActive: true
  },
  {
    name: 'Jorge Silva',
    phone: '3045678901',
    location: 'Usaquén - Centro Comercial',
    plate: 'MNO345',
    isActive: false // Conductor inactivo para testing
  },
  {
    name: 'Patricia Ruiz',
    phone: '3056789012',
    location: 'Engativá - Centro',
    plate: 'PQR678',
    isActive: true
  },
  {
    name: 'Roberto Castro',
    phone: '3067890123',
    location: 'Suba - Plaza Central',
    plate: 'STU901',
    isActive: true
  },
  {
    name: 'Diana López',
    phone: '3078901234',
    location: 'Bosa - Portal',
    plate: 'VWX234',
    isActive: true
  },
  {
    name: 'Miguel Torres',
    phone: '3089012345',
    location: 'Kennedy - Biblioteca',
    plate: 'YZA567',
    isActive: true
  },
  {
    name: 'Carmen Vargas',
    phone: '3090123456',
    location: 'Fontibón - Aeropuerto',
    plate: 'BCD890',
    isActive: true
  },
  {
    name: 'Fernando Jiménez',
    phone: '3101234567',
    location: 'Puente Aranda - Centro',
    plate: 'EFG123',
    isActive: false // Otro conductor inactivo
  },
  {
    name: 'Claudia Morales',
    phone: '3112345678',
    location: 'San Cristóbal - Centro',
    plate: 'HIJ456',
    isActive: true
  },
  {
    name: 'Andrés Peña',
    phone: '3123456789',
    location: 'Rafael Uribe - Sur',
    plate: 'KLM789',
    isActive: true
  },
  {
    name: 'Sofía Ramírez',
    phone: '3134567890',
    location: 'Tunjuelito - Centro',
    plate: 'NOP012',
    isActive: true
  },
  {
    name: 'Alejandro Cruz',
    phone: '3145678901',
    location: 'Barrios Unidos - Centro',
    plate: 'QRS345',
    isActive: true
  }
]

async function main() {
  console.log('🌱 Iniciando seed de conductores...')

  try {
    // Limpiar datos existentes (opcional)
    console.log('🧹 Limpiando datos existentes...')
    await prisma.taxiRequest.deleteMany()
    await prisma.driver.deleteMany()

    console.log('👥 Creando conductores...')
    
    // Crear conductores uno por uno para mejor control
    for (const driverData of driversData) {
      try {
        const driver = await prisma.driver.create({
          data: {
            id: uuidv4(),
            name: driverData.name,
            phone: driverData.phone,
            location: driverData.location,
            plate: driverData.plate,
            isActive: driverData.isActive
          }
        })
        
        const status = driver.isActive ? '✅ ACTIVO' : '⏸️ INACTIVO'
        console.log(`   • ${driver.name} (${driver.phone}) - ${driver.plate} - ${status}`)
      } catch (error) {
        console.error(`   ❌ Error creando conductor ${driverData.name}:`, error)
      }
    }

    // Mostrar estadísticas finales
    const stats = await prisma.driver.groupBy({
      by: ['isActive'],
      _count: {
        id: true
      }
    })

    console.log('\n📊 Estadísticas de conductores creados:')
    stats.forEach(stat => {
      const status = stat.isActive ? 'Activos' : 'Inactivos'
      console.log(`   • ${status}: ${stat._count.id}`)
    })

    const totalDrivers = await prisma.driver.count()
    console.log(`   • Total: ${totalDrivers}`)

    console.log('\n✅ Seed completado exitosamente!')
    
    // Mostrar algunos comandos útiles
    console.log('\n🔧 Comandos útiles:')
    console.log('   • npm run db:studio  - Abrir Prisma Studio')
    console.log('   • npm run dev         - Iniciar el bot')
    console.log('\n📱 Teléfonos de prueba para WhatsApp:')
    driversData
      .filter(d => d.isActive)
      .slice(0, 5)
      .forEach(driver => {
        console.log(`   • ${driver.name}: +57${driver.phone}`)
      })

  } catch (error) {
    console.error('❌ Error en el seed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar seed
main()
  .catch((error) => {
    console.error('💥 Error fatal en seed:', error)
    process.exit(1)
  })