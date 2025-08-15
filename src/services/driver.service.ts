import { prisma } from '../config/database.js'
import { 
  Driver, 
  CreateDriverData, 
  ServiceResponse, 
  DriverFilters,
  DriverStats
} from '../types/index.js'
import { ValidationUtils } from '../utils/validation.js'

export class DriverService {
  
  async createDriver(data: CreateDriverData): Promise<ServiceResponse<Driver>> {
    try {
      // Validaciones
      const nameValidation = ValidationUtils.validateName(data.name)
      if (!nameValidation.isValid) {
        return { success: false, error: nameValidation.error }
      }

      const phoneValidation = ValidationUtils.validatePhone(data.phone)
      if (!phoneValidation.isValid) {
        return { success: false, error: phoneValidation.error }
      }

      const plateValidation = ValidationUtils.validatePlate(data.plate)
      if (!plateValidation.isValid) {
        return { success: false, error: plateValidation.error }
      }

      if (data.location) {
        const locationValidation = ValidationUtils.validateLocation(data.location)
        if (!locationValidation.isValid) {
          return { success: false, error: locationValidation.error }
        }
      }

      // Verificar si ya existe un conductor con ese teléfono
      const existingDriver = await this.getDriverByPhone(data.phone)
      if (existingDriver.success && existingDriver.data) {
        return { 
          success: false, 
          error: 'Ya existe un conductor registrado con este número de teléfono' 
        }
      }

      // Crear conductor
      const cleanPhone = ValidationUtils.cleanPhoneNumber(data.phone)
      const driver = await prisma.driver.create({
        data: {
          name: data.name.trim(),
          phone: cleanPhone,
          location: data.location?.trim(),
          plate: data.plate.toUpperCase().trim(),
          isActive: true
        }
      })

      return { 
        success: true, 
        data: driver as Driver,
        message: 'Conductor registrado exitosamente'
      }

    } catch (error) {
      console.error('Error creating driver:', error)
      return { 
        success: false, 
        error: 'Error interno del servidor al crear conductor' 
      }
    }
  }

  async getDriverByPhone(phone: string): Promise<ServiceResponse<Driver>> {
    try {
      const cleanPhone = ValidationUtils.cleanPhoneNumber(phone)
      
      const driver = await prisma.driver.findUnique({
        where: { phone: cleanPhone }
      })

      if (!driver) {
        return { success: false, error: 'Conductor no encontrado' }
      }

      return { success: true, data: driver as Driver }

    } catch (error) {
      console.error('Error getting driver by phone:', error)
      return { success: false, error: 'Error interno del servidor' }
    }
  }

  async getDriverById(id: string): Promise<ServiceResponse<Driver>> {
    try {
      const driver = await prisma.driver.findUnique({
        where: { id },
        include: {
          assignedRequests: {
            where: {
              status: 'ASSIGNED'
            }
          }
        }
      })

      if (!driver) {
        return { success: false, error: 'Conductor no encontrado' }
      }

      return { success: true, data: driver as Driver }

    } catch (error) {
      console.error('Error getting driver by ID:', error)
      return { success: false, error: 'Error interno del servidor' }
    }
  }

  async getAllActiveDrivers(filters?: DriverFilters): Promise<ServiceResponse<Driver[]>> {
    try {
      const where: any = {
        isActive: filters?.isActive ?? true
      }

      if (filters?.location) {
        where.location = {
          contains: filters.location,
          mode: 'insensitive'
        }
      }

      if (filters?.excludePhone) {
        where.phone = {
          not: ValidationUtils.cleanPhoneNumber(filters.excludePhone)
        }
      }

      const drivers = await prisma.driver.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        }
      })

      return { 
        success: true, 
        data: drivers as Driver[],
        message: `${drivers.length} conductores encontrados`
      }

    } catch (error) {
      console.error('Error getting active drivers:', error)
      return { success: false, error: 'Error interno del servidor' }
    }
  }

  async updateDriverStatus(phone: string, isActive: boolean): Promise<ServiceResponse<Driver>> {
    try {
      const cleanPhone = ValidationUtils.cleanPhoneNumber(phone)
      
      const driver = await prisma.driver.update({
        where: { phone: cleanPhone },
        data: { isActive }
      })

      return { 
        success: true, 
        data: driver as Driver,
        message: `Estado del conductor actualizado: ${isActive ? 'Activo' : 'Inactivo'}`
      }

    } catch (error) {
      console.error('Error updating driver status:', error)
      return { success: false, error: 'Error interno del servidor' }
    }
  }

  async updateDriverLocation(phone: string, location: string): Promise<ServiceResponse<Driver>> {
    try {
      const locationValidation = ValidationUtils.validateLocation(location)
      if (!locationValidation.isValid) {
        return { success: false, error: locationValidation.error }
      }

      const cleanPhone = ValidationUtils.cleanPhoneNumber(phone)
      
      const driver = await prisma.driver.update({
        where: { phone: cleanPhone },
        data: { location: location.trim() }
      })

      return { 
        success: true, 
        data: driver as Driver,
        message: 'Ubicación actualizada exitosamente'
      }

    } catch (error) {
      console.error('Error updating driver location:', error)
      return { success: false, error: 'Error interno del servidor' }
    }
  }

  async deleteDriver(phone: string): Promise<ServiceResponse<void>> {
    try {
      const cleanPhone = ValidationUtils.cleanPhoneNumber(phone)
      
      // Verificar si tiene carreras asignadas activas
      const activeRequests = await prisma.taxiRequest.count({
        where: {
          driver: { phone: cleanPhone },
          status: 'ASSIGNED'
        }
      })

      if (activeRequests > 0) {
        return { 
          success: false, 
          error: 'No se puede eliminar un conductor con carreras activas asignadas' 
        }
      }

      await prisma.driver.delete({
        where: { phone: cleanPhone }
      })

      return { 
        success: true, 
        message: 'Conductor eliminado exitosamente'
      }

    } catch (error) {
      console.error('Error deleting driver:', error)
      return { success: false, error: 'Error interno del servidor' }
    }
  }

  async getDriverStats(): Promise<ServiceResponse<DriverStats>> {
    try {
      const [totalDrivers, activeDrivers] = await Promise.all([
        prisma.driver.count(),
        prisma.driver.count({ where: { isActive: true } })
      ])

      const stats: DriverStats = {
        totalDrivers,
        activeDrivers,
        inactiveDrivers: totalDrivers - activeDrivers
      }

      return { success: true, data: stats }

    } catch (error) {
      console.error('Error getting driver stats:', error)
      return { success: false, error: 'Error interno del servidor' }
    }
  }

  async isDriverRegistered(phone: string): Promise<boolean> {
    try {
      const result = await this.getDriverByPhone(phone)
      return result.success && !!result.data
    } catch (error) {
      console.error('Error checking driver registration:', error)
      return false
    }
  }

  async getDriversForNotification(excludePhone?: string): Promise<string[]> {
    try {
      const result = await this.getAllActiveDrivers({ 
        isActive: true, 
        excludePhone 
      })
      
      if (!result.success || !result.data) {
        return []
      }

      return result.data.map(driver => driver.phone)
    } catch (error) {
      console.error('Error getting drivers for notification:', error)
      return []
    }
  }
}