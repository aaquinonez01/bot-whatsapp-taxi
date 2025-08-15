// Tipos base de la aplicación
export interface Driver {
  id: string
  name: string
  phone: string
  location?: string
  plate: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TaxiRequest {
  id: string
  clientName: string
  clientPhone: string
  location: string
  status: RequestStatus
  assignedTo?: string
  createdAt: Date
  updatedAt: Date
  driver?: Driver
}

export enum RequestStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// Tipos para el contexto del bot
export interface BotContext {
  body: string
  from: string
  name?: string
  pushName?: string
  key: {
    remoteJid: string
    fromMe: boolean
    id: string
  }
}

// Tipos para los flujos
export interface UserSession {
  step?: string
  name?: string
  location?: string
  requestId?: string
  isDriver?: boolean
}

// Tipos para servicios
export interface CreateDriverData {
  name: string
  phone: string
  location?: string
  plate: string
}

export interface CreateTaxiRequestData {
  clientName: string
  clientPhone: string
  location: string
}

export interface AssignmentResult {
  success: boolean
  message: string
  request?: TaxiRequest
  driver?: Driver
}

export interface NotificationResult {
  sent: number
  failed: number
  errors?: string[]
}

// Tipos para validaciones
export interface ValidationResult {
  isValid: boolean
  error?: string
}

// Tipos para respuestas de servicios
export interface ServiceResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Tipos para filtros y consultas
export interface DriverFilters {
  isActive?: boolean
  location?: string
  excludePhone?: string
}

export interface RequestFilters {
  status?: RequestStatus
  clientPhone?: string
  createdAfter?: Date
  createdBefore?: Date
}

// Tipos para estadísticas
export interface DriverStats {
  totalDrivers: number
  activeDrivers: number
  inactiveDrivers: number
}

export interface RequestStats {
  totalRequests: number
  pendingRequests: number
  assignedRequests: number
  completedRequests: number
  cancelledRequests: number
}