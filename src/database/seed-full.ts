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
    isActive: false
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
  }
]

const sampleRequests = [
  {
    clientName: 'Juan Pérez',
    clientPhone: '3201234567',
    location: 'Universidad Nacional - Entrada Principal',
    status: 'COMPLETED'
  },
  {
    clientName: 'Andrea López',
    clientPhone: '3202345678',
    location: 'Centro Comercial Unicentro - Torre A',
    status: 'COMPLETED'
  },
  {
    clientName: 'Carlos Mendoza',
    clientPhone: '3203456789',
    location: 'Hospital San Juan de Dios - Urgencias',
    status: 'ASSIGNED'
  },
  {
    clientName: 'Lucía Ramírez',
    clientPhone: '3204567890',
    location: 'Aeropuerto El Dorado - Terminal 1',
    status: 'PENDING'
  },
  {
    clientName: 'Pedro García',
    clientPhone: '3205678901',
    location: 'Estación de Transmilenio - Portal Norte',
    status: 'CANCELLED'
  }
]

async function main() {
  console.log('🌱 Iniciando seed completo (conductores + solicitudes)...')

  try {
    // Limpiar datos existentes
    console.log('🧹 Limpiando datos existentes...')
    await prisma.taxiRequest.deleteMany()
    await prisma.driver.deleteMany()

    console.log('👥 Creando conductores...')
    const createdDrivers = []
    
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
        
        createdDrivers.push(driver)
        const status = driver.isActive ? '✅ ACTIVO' : '⏸️ INACTIVO'
        console.log(`   • ${driver.name} (${driver.phone}) - ${driver.plate} - ${status}`)
      } catch (error) {
        console.error(`   ❌ Error creando conductor ${driverData.name}:`, error)
      }
    }

    console.log('\n🚖 Creando solicitudes de ejemplo...')
    const activeDrivers = createdDrivers.filter(d => d.isActive)
    
    for (let i = 0; i < sampleRequests.length; i++) {
      const requestData = sampleRequests[i]
      
      try {
        let assignedTo = null
        
        // Asignar conductor solo si el estado es ASSIGNED o COMPLETED
        if ((requestData.status === 'ASSIGNED' || requestData.status === 'COMPLETED') && activeDrivers.length > 0) {
          assignedTo = activeDrivers[i % activeDrivers.length].id
        }

        const request = await prisma.taxiRequest.create({
          data: {
            id: uuidv4(),
            clientName: requestData.clientName,
            clientPhone: requestData.clientPhone,
            location: requestData.location,
            status: requestData.status as any,
            assignedTo,
            createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000) // Fecha aleatoria última 24h
          }
        })

        const assignedDriver = assignedTo ? activeDrivers.find(d => d.id === assignedTo) : null
        const driverInfo = assignedDriver ? ` → ${assignedDriver.name}` : ''
        const statusEmoji = {
          'PENDING': '⏳',
          'ASSIGNED': '✅',
          'COMPLETED': '🏁',
          'CANCELLED': '❌'
        }[requestData.status] || '❓'

        console.log(`   • ${requestData.clientName} - ${requestData.location} ${statusEmoji} ${requestData.status}${driverInfo}`)
      } catch (error) {
        console.error(`   ❌ Error creando solicitud para ${requestData.clientName}:`, error)
      }
    }

    // Estadísticas finales
    console.log('\n📊 Estadísticas generadas:')
    
    const driverStats = await prisma.driver.groupBy({
      by: ['isActive'],
      _count: { id: true }
    })
    
    console.log('   Conductores:')
    driverStats.forEach(stat => {
      const status = stat.isActive ? 'Activos' : 'Inactivos'
      console.log(`   • ${status}: ${stat._count.id}`)
    })

    const requestStats = await prisma.taxiRequest.groupBy({
      by: ['status'],
      _count: { id: true }
    })
    
    console.log('   Solicitudes:')
    requestStats.forEach(stat => {
      const statusEmoji = {
        'PENDING': '⏳',
        'ASSIGNED': '✅',
        'COMPLETED': '🏁',
        'CANCELLED': '❌'
      }[stat.status] || '❓'
      console.log(`   • ${statusEmoji} ${stat.status}: ${stat._count.id}`)
    })

    console.log('\n✅ Seed completo finalizado exitosamente!')
    
    console.log('\n🔧 Comandos útiles:')
    console.log('   • npm run db:studio  - Abrir Prisma Studio')
    console.log('   • npm run dev         - Iniciar el bot')
    
    console.log('\n📱 Números de conductores activos para testing:')
    activeDrivers.slice(0, 5).forEach(driver => {
      console.log(`   • ${driver.name}: +57${driver.phone}`)
    })

    console.log('\n📱 Números de clientes para testing:')
    sampleRequests.slice(0, 3).forEach(request => {
      console.log(`   • ${request.clientName}: +57${request.clientPhone}`)
    })

  } catch (error) {
    console.error('❌ Error en el seed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('💥 Error fatal en seed:', error)
    process.exit(1)
  })