import { prisma } from "../config/database.js";
import {
  TaxiRequest,
  CreateTaxiRequestData,
  ServiceResponse,
  RequestFilters,
  RequestStats,
  AssignmentResult,
  RequestStatus,
} from "../types/index.js";
import { ValidationUtils } from "../utils/validation.js";
import { DriverService } from "./driver.service.js";
import { config } from "../config/environments.js";

export class RequestService {
  private driverService: DriverService;

  constructor() {
    this.driverService = new DriverService();
  }

  async createTaxiRequest(
    data: CreateTaxiRequestData
  ): Promise<ServiceResponse<TaxiRequest>> {
    try {
      // Validaciones
      const nameValidation = ValidationUtils.validateName(data.clientName);
      if (!nameValidation.isValid) {
        return { success: false, error: nameValidation.error };
      }
      const phoneValidation = ValidationUtils.validatePhone(data.clientPhone);
      if (!phoneValidation.isValid) {
        console.log("phoneValidation", phoneValidation);
        return { success: false, error: phoneValidation.error };
      }

      const locationValidation = ValidationUtils.validateLocation(
        data.location
      );
      if (!locationValidation.isValid) {
        return { success: false, error: locationValidation.error };
      }

      // Cancelar cualquier solicitud pendiente anterior del mismo cliente
      const existingRequest = await this.getClientPendingRequest(
        data.clientPhone
      );
      if (existingRequest.success && existingRequest.data) {
        await this.cancelRequest(
          existingRequest.data.id,
          "Nueva solicitud del cliente"
        );
      }

      // Crear solicitud
      const cleanPhone = ValidationUtils.cleanPhoneNumber(data.clientPhone);
      console.log("💾 CREANDO SOLICITUD CON SECTOR:", data.sector);
      
      const request = await prisma.taxiRequest.create({
        data: {
          clientName: data.clientName.trim(),
          clientPhone: cleanPhone,
          location: data.location.trim(),
          sector: data.sector || null, // 🆕 AGREGAR SECTOR
          status: RequestStatus.PENDING,
        },
        include: {
          driver: true,
        },
      });
      
      console.log("✅ SOLICITUD CREADA CON SECTOR:", request.sector);

      return {
        success: true,
        data: request as TaxiRequest,
        message: "Solicitud de taxi creada exitosamente",
      };
    } catch (error) {
      console.error("Error creating taxi request:", error);
      return {
        success: false,
        error: "Error interno del servidor al crear la solicitud",
      };
    }
  }

  async assignFirstAvailableDriver(
    requestId: string,
    driverPhone: string
  ): Promise<AssignmentResult> {
    try {
      // Iniciar transacción para evitar condiciones de carrera
      const result = await prisma.$transaction(async (tx) => {
        // 1. Verificar que la solicitud sigue PENDING
        const request = await tx.taxiRequest.findUnique({
          where: { id: requestId },
          include: { driver: true },
        });

        if (!request) {
          throw new Error("Solicitud no encontrada");
        }

        if (request.status !== RequestStatus.PENDING) {
          throw new Error("Esta carrera ya fue asignada a otro conductor");
        }

        // 2. Verificar que el conductor existe y está activo
        const driverResult = await this.driverService.getDriverByPhone(
          driverPhone
        );
        if (!driverResult.success || !driverResult.data) {
          throw new Error("Conductor no encontrado");
        }

        if (!driverResult.data.isActive) {
          throw new Error("Conductor no está activo");
        }

        // 3. Asignar el conductor a la solicitud
        const updatedRequest = await tx.taxiRequest.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.ASSIGNED,
            assignedTo: driverResult.data.id,
          },
          include: {
            driver: true,
          },
        });

        return {
          request: updatedRequest,
          driver: driverResult.data,
        };
      });

      return {
        success: true,
        message: "Carrera asignada exitosamente",
        request: result.request as TaxiRequest,
        driver: result.driver,
      };
    } catch (error) {
      console.error("Error assigning driver:", error);

      if (error instanceof Error) {
        if (error.message.includes("ya fue asignada")) {
          return {
            success: false,
            message: "Esta carrera ya fue tomada por otro conductor",
          };
        }

        return {
          success: false,
          message: error.message,
        };
      }

      return {
        success: false,
        message: "Error interno del servidor al asignar conductor",
      };
    }
  }

  async getRequestById(id: string): Promise<ServiceResponse<TaxiRequest>> {
    try {
      const request = await prisma.taxiRequest.findUnique({
        where: { id },
        include: {
          driver: true,
        },
      });

      if (!request) {
        return { success: false, error: "Solicitud no encontrada" };
      }

      return { success: true, data: request as TaxiRequest };
    } catch (error) {
      console.error("Error getting request by ID:", error);
      return { success: false, error: "Error interno del servidor" };
    }
  }

  async getClientPendingRequest(
    clientPhone: string
  ): Promise<ServiceResponse<TaxiRequest>> {
    try {
      const cleanPhone = ValidationUtils.cleanPhoneNumber(clientPhone);

      const request = await prisma.taxiRequest.findFirst({
        where: {
          clientPhone: cleanPhone,
          status: RequestStatus.PENDING,
        },
        include: {
          driver: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!request) {
        return { success: false, error: "No hay solicitudes pendientes" };
      }

      return { success: true, data: request as TaxiRequest };
    } catch (error) {
      console.error("Error getting client pending request:", error);
      return { success: false, error: "Error interno del servidor" };
    }
  }

  async getAllPendingRequests(): Promise<ServiceResponse<TaxiRequest[]>> {
    try {
      const requests = await prisma.taxiRequest.findMany({
        where: {
          status: RequestStatus.PENDING,
        },
        include: {
          driver: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return {
        success: true,
        data: requests as TaxiRequest[],
        message: `${requests.length} solicitudes pendientes encontradas`,
      };
    } catch (error) {
      console.error("Error getting pending requests:", error);
      return { success: false, error: "Error interno del servidor" };
    }
  }

  async cancelRequest(
    requestId: string,
    reason?: string
  ): Promise<ServiceResponse<TaxiRequest>> {
    try {
      const request = await prisma.taxiRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.CANCELLED,
        },
        include: {
          driver: true,
        },
      });

      return {
        success: true,
        data: request as TaxiRequest,
        message: `Solicitud cancelada${reason ? `: ${reason}` : ""}`,
      };
    } catch (error) {
      console.error("Error cancelling request:", error);
      return { success: false, error: "Error interno del servidor" };
    }
  }

  async completeRequest(
    requestId: string
  ): Promise<ServiceResponse<TaxiRequest>> {
    try {
      const request = await prisma.taxiRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.COMPLETED,
        },
        include: {
          driver: true,
        },
      });

      return {
        success: true,
        data: request as TaxiRequest,
        message: "Carrera completada exitosamente",
      };
    } catch (error) {
      console.error("Error completing request:", error);
      return { success: false, error: "Error interno del servidor" };
    }
  }

  async getRequestsByFilters(
    filters: RequestFilters
  ): Promise<ServiceResponse<TaxiRequest[]>> {
    try {
      const where: any = {};

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.clientPhone) {
        where.clientPhone = ValidationUtils.cleanPhoneNumber(
          filters.clientPhone
        );
      }

      if (filters.createdAfter) {
        where.createdAt = { ...where.createdAt, gte: filters.createdAfter };
      }

      if (filters.createdBefore) {
        where.createdAt = { ...where.createdAt, lte: filters.createdBefore };
      }

      const requests = await prisma.taxiRequest.findMany({
        where,
        include: {
          driver: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return {
        success: true,
        data: requests as TaxiRequest[],
        message: `${requests.length} solicitudes encontradas`,
      };
    } catch (error) {
      console.error("Error getting requests by filters:", error);
      return { success: false, error: "Error interno del servidor" };
    }
  }

  async getRequestStats(): Promise<ServiceResponse<RequestStats>> {
    try {
      const [total, pending, assigned, completed, cancelled] =
        await Promise.all([
          prisma.taxiRequest.count(),
          prisma.taxiRequest.count({
            where: { status: RequestStatus.PENDING },
          }),
          prisma.taxiRequest.count({
            where: { status: RequestStatus.ASSIGNED },
          }),
          prisma.taxiRequest.count({
            where: { status: RequestStatus.COMPLETED },
          }),
          prisma.taxiRequest.count({
            where: { status: RequestStatus.CANCELLED },
          }),
        ]);

      const stats: RequestStats = {
        totalRequests: total,
        pendingRequests: pending,
        assignedRequests: assigned,
        completedRequests: completed,
        cancelledRequests: cancelled,
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error("Error getting request stats:", error);
      return { success: false, error: "Error interno del servidor" };
    }
  }

  async cleanupExpiredRequests(): Promise<ServiceResponse<number>> {
    try {
      const timeoutMinutes = config.taxi.requestTimeoutMinutes;
      const expiredTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

      const result = await prisma.taxiRequest.updateMany({
        where: {
          status: RequestStatus.PENDING,
          createdAt: {
            lt: expiredTime,
          },
        },
        data: {
          status: RequestStatus.CANCELLED,
        },
      });

      return {
        success: true,
        data: result.count,
        message: `${result.count} solicitudes expiradas fueron canceladas`,
      };
    } catch (error) {
      console.error("Error cleaning up expired requests:", error);
      return { success: false, error: "Error interno del servidor" };
    }
  }

  async getOldestPendingRequest(): Promise<ServiceResponse<TaxiRequest>> {
    try {
      const request = await prisma.taxiRequest.findFirst({
        where: {
          status: RequestStatus.PENDING,
        },
        include: {
          driver: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (!request) {
        return { success: false, error: "No hay solicitudes pendientes" };
      }

      return { success: true, data: request as TaxiRequest };
    } catch (error) {
      console.error("Error getting oldest pending request:", error);
      return { success: false, error: "Error interno del servidor" };
    }
  }
}
