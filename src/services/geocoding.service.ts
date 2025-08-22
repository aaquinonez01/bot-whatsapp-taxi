import { ServiceResponse } from "../types/index.js";

export interface GeocodingResult {
  neighborhood?: string;
  district?: string;
  place?: string;
  formatted: string;
}

export class GeocodingService {
  private mapboxToken: string;
  private baseUrl = 'https://api.mapbox.com/search/geocode/v6/reverse';

  constructor(mapboxToken: string) {
    this.mapboxToken = mapboxToken;
  }

  /**
   * Obtiene el sector/barrio usando coordenadas GPS
   */
  async getNeighborhoodFromCoordinates(
    latitude: number,
    longitude: number
  ): Promise<ServiceResponse<GeocodingResult>> {
    try {
      // Validar coordenadas
      if (!this.isValidCoordinate(latitude, longitude)) {
        return {
          success: false,
          error: "Coordenadas inválidas"
        };
      }

      // Hacer petición a Mapbox
      const mapboxResponse = await this.makeMapboxRequest(latitude, longitude);
      
      if (!mapboxResponse.success) {
        return mapboxResponse;
      }

      // Extraer información del barrio/sector
      const geocodingResult = this.extractLocationInfo(mapboxResponse.data);
      
      return {
        success: true,
        data: geocodingResult,
        message: "Ubicación geocodificada exitosamente"
      };

    } catch (error) {
      console.error("❌ Error in geocoding service:", error);
      return {
        success: false,
        error: "Error interno del servicio de geocodificación"
      };
    }
  }

  /**
   * Realiza la petición HTTP a Mapbox
   */
  private async makeMapboxRequest(
    latitude: number,
    longitude: number
  ): Promise<ServiceResponse<any>> {
    try {
      const url = `${this.baseUrl}?longitude=${longitude}&latitude=${latitude}&access_token=${this.mapboxToken}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Mapbox API error: ${response.status} - ${errorText}`);
        
        return {
          success: false,
          error: `Error de API Mapbox: ${response.status}`
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        data: data
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: "Timeout en solicitud a Mapbox"
        };
      }
      
      console.error("❌ Network error calling Mapbox:", error);
      return {
        success: false,
        error: "Error de conexión con Mapbox"
      };
    }
  }

  /**
   * Extrae información de barrio/sector de la respuesta de Mapbox
   */
  private extractLocationInfo(mapboxResponse: any): GeocodingResult {
    try {
      const features = mapboxResponse.features;
      
      if (!features || !Array.isArray(features) || features.length === 0) {
        return {
          formatted: "Ubicación GPS"
        };
      }

      // Buscar simplemente el nombre de la calle
      for (const feature of features) {
        const properties = feature.properties || {};
        const context = properties.context || {};
        
        // Buscar simplemente street o address
        const street = context.street?.name;
        const address = context.address?.name;
        
        // Si encuentra una calle, la devuelve
        if (street) {
          return {
            formatted: street
          };
        }
        
        if (address) {
          return {
            formatted: address
          };
        }
      }

      return {
        formatted: "Ubicación GPS"
      };

    } catch (error) {
      return {
        formatted: "Ubicación GPS"
      };
    }
  }

  /**
   * Valida que las coordenadas sean válidas
   */
  private isValidCoordinate(latitude: number, longitude: number): boolean {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !isNaN(latitude) &&
      !isNaN(longitude)
    );
  }

  /**
   * Método helper para obtener solo el sector como string
   */
  async getSectorFromCoordinates(
    latitude: number,
    longitude: number
  ): Promise<string> {
    try {
      const result = await this.getNeighborhoodFromCoordinates(latitude, longitude);
      
      if (result.success && result.data) {
        return result.data.formatted;
      }
      
      return "Ubicación GPS";
      
    } catch (error) {
      return "Ubicación GPS";
    }
  }
}