import { ServiceResponse } from "../types/index.js";

export interface GeocodingResult {
  formatted: string; // "Calle, Barrio, Sector" todo en un string
}

interface GoogleMapsComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleMapsResponse {
  results: Array<{
    address_components: GoogleMapsComponent[];
    formatted_address: string;
  }>;
  status: string;
}

export class GeocodingService {
  private apiKey: string;
  private baseUrl = "https://maps.googleapis.com/maps/api/geocode/json";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Obtiene información detallada de ubicación usando coordenadas GPS
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
          error: "Coordenadas inválidas",
        };
      }

      // Hacer petición a Google Maps
      const googleResponse = await this.makeGoogleMapsRequest(
        latitude,
        longitude
      );

      if (!googleResponse.success) {
        return {
          success: false,
          error: googleResponse.error,
        };
      }

      // Extraer información detallada de ubicación
      const geocodingResult = this.extractLocationInfo(googleResponse.data);

      return {
        success: true,
        data: geocodingResult,
        message: "Ubicación geocodificada exitosamente",
      };
    } catch (error) {
      console.error("❌ Error in geocoding service:", error);
      return {
        success: false,
        error: "Error interno del servicio de geocodificación",
      };
    }
  }

  /**
   * Realiza la petición HTTP a Google Maps Geocoding API
   */
  private async makeGoogleMapsRequest(
    latitude: number,
    longitude: number
  ): Promise<ServiceResponse<GoogleMapsResponse>> {
    try {
      const url = `${this.baseUrl}?latlng=${latitude},${longitude}&key=${this.apiKey}&language=es&region=ec`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `❌ Google Maps API error: ${response.status} - ${errorText}`
        );

        return {
          success: false,
          error: `Error de API Google Maps: ${response.status}`,
        };
      }

      const data = (await response.json()) as GoogleMapsResponse;

      // 🔍 RESPUESTA COMPLETA DE GOOGLE MAPS API
      console.log("🔍 ===== RESPUESTA COMPLETA DE GOOGLE MAPS API =====");
      console.log(JSON.stringify(data, null, 2));
      console.log("🔍 ===== FIN RESPUESTA GOOGLE MAPS API =====");

      if (data.status !== "OK") {
        console.error(`❌ Google Maps API status: ${data.status}`);
        return {
          success: false,
          error: `Error de Google Maps: ${data.status}`,
        };
      }

      console.log(`✅ Google Maps response: ${data.results.length} resultados`);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("🚨 CATCH activado en makeGoogleMapsRequest");
      console.error("🚨 Error name:", error?.name);
      console.error("🚨 Error message:", error?.message);
      console.error("🚨 Error stack:", error?.stack);

      if (error?.name === "AbortError") {
        console.error("⏰ Request abortado por timeout");
        return {
          success: false,
          error: "Timeout en solicitud a Google Maps",
        };
      }

      console.error("❌ Network/Other error calling Google Maps:", error);
      return {
        success: false,
        error: "Error de conexión con Google Maps",
      };
    }
  }

  /**
   * Extrae información detallada de ubicación de la respuesta de Google Maps
   * Formato: "Calle Principal, Barrio, Sector"
   */
  private extractLocationInfo(
    googleResponse: GoogleMapsResponse
  ): GeocodingResult {
    try {
      console.log("🔍 ===== INICIANDO EXTRACCIÓN DE UBICACIÓN =====");

      if (!googleResponse.results || googleResponse.results.length === 0) {
        console.log("❌ No hay resultados en la respuesta");
        return {
          formatted: "Ubicación GPS",
        };
      }

      console.log(
        `🔍 Buscando en ${googleResponse.results.length} resultados de Google Maps`
      );

      // Buscar en todos los resultados y clasificarlos por calidad
      let bestResult = null;
      let bestComponents = null;
      let bestScore = -1;

      for (let i = 0; i < googleResponse.results.length; i++) {
        const result = googleResponse.results[i];
        const components = result.address_components;

        if (!components || components.length === 0) continue;

        // Calcular puntuación de calidad del resultado
        let score = 0;
        let hasStreetNumber = false;
        let hasRoute = false;
        let hasNeighborhood = false;
        let hasLocality = false;

        for (const comp of components) {
          if (comp.types.includes("street_number")) {
            score += 10;
            hasStreetNumber = true;
          }
          if (comp.types.includes("route")) {
            score += 8;
            hasRoute = true;
          }
          if (comp.types.includes("neighborhood")) {
            score += 6;
            hasNeighborhood = true;
          }
          if (comp.types.includes("sublocality_level_1")) {
            score += 5;
          }
          if (comp.types.includes("sublocality")) {
            score += 4;
          }
          if (comp.types.includes("locality")) {
            score += 3;
            hasLocality = true;
          }
          if (comp.types.includes("administrative_area_level_3")) {
            score += 2;
          }
          if (comp.types.includes("administrative_area_level_2")) {
            score += 1;
          }
        }

        // BONUS: Direcciones con referencias específicas (metros, referencias de lugares)
        const formattedAddr = result.formatted_address || "";
        if (
          formattedAddr.includes("metros") ||
          formattedAddr.includes("referencia") ||
          formattedAddr.includes("frente a") ||
          formattedAddr.includes("cerca de") ||
          formattedAddr.includes("al Sur de") ||
          formattedAddr.includes("al Norte de") ||
          formattedAddr.includes("al Este de") ||
          formattedAddr.includes("al Oeste de")
        ) {
          score += 25; // BONUS MUY ALTO para direcciones con referencias (era 15, ahora 25)
          console.log(`   🎯 BONUS +25: Dirección con referencia específica`);
        }

        // BONUS: Direcciones que mencionan intersecciones (y, &, con)
        if (
          formattedAddr.includes(" y ") ||
          formattedAddr.includes(" & ") ||
          formattedAddr.includes(" con ")
        ) {
          score += 5;
          console.log(`   🎯 BONUS +5: Dirección con intersección`);
        }

        const hasStreetInfo =
          hasStreetNumber ||
          hasRoute ||
          hasNeighborhood ||
          formattedAddr.includes("metros");

        console.log(
          `🔍 Resultado ${i + 1} (Score: ${score}): ${
            hasStreetInfo ? "✅" : "❌"
          }`
        );
        console.log(`   📍 Dirección: ${result.formatted_address}`);
        console.log(
          `   🏠 Componentes: Street(${hasStreetNumber}) Route(${hasRoute}) Neighborhood(${hasNeighborhood}) Locality(${hasLocality})`
        );

        // Seleccionar el resultado con mayor puntuación
        if (score > bestScore && hasStreetInfo) {
          bestResult = result;
          bestComponents = components;
          bestScore = score;
          console.log(`⭐ Nuevo mejor resultado: ${i + 1} con score ${score}`);
        }
      }

      // Si no encontramos un resultado con información de calle, usar el primero
      if (!bestResult) {
        console.log(
          "⚠️ No se encontró resultado con información de calle, usando el primero"
        );
        bestResult = googleResponse.results[0];
        bestComponents = bestResult.address_components;
      }

      console.log(
        "🔍 Resultado seleccionado:",
        JSON.stringify(bestResult, null, 2)
      );
      console.log(
        `🔍 Procesando ${bestComponents.length} componentes del resultado seleccionado`
      );
      console.log(
        "🔍 Componentes completos:",
        JSON.stringify(bestComponents, null, 2)
      );

      // Extraer componentes específicos
      let streetNumber = "";
      let route = "";
      let neighborhood = "";
      let sublocality = "";
      let sublocalityLevel1 = "";
      let locality = "";
      let administrativeLevel2 = "";
      let administrativeLevel3 = "";

      for (const component of bestComponents) {
        const types = component.types;

        if (types.includes("street_number")) {
          streetNumber = component.long_name;
        } else if (types.includes("route")) {
          route = component.long_name;
        } else if (types.includes("neighborhood")) {
          neighborhood = component.long_name;
        } else if (types.includes("sublocality_level_1")) {
          sublocalityLevel1 = component.long_name;
        } else if (types.includes("sublocality")) {
          sublocality = component.long_name;
        } else if (types.includes("locality")) {
          locality = component.long_name;
        } else if (types.includes("administrative_area_level_2")) {
          administrativeLevel2 = component.long_name;
        } else if (types.includes("administrative_area_level_3")) {
          administrativeLevel3 = component.long_name;
        }
      }

      // Construir calle principal
      const mainStreet = `${streetNumber} ${route}`.trim();

      // Priorizar barrio: neighborhood > administrative_area_level_3 > sublocality_level_1 > sublocality
      const barrio =
        neighborhood ||
        administrativeLevel3 ||
        sublocalityLevel1 ||
        sublocality ||
        "";

      // Usar locality como sector más amplio, con fallback a administrative_area_level_2
      const sector = locality || administrativeLevel2 || "Sector";

      console.log(
        `🏠 Componentes extraídos: calle="${mainStreet}", barrio="${barrio}", sector="${sector}"`
      );

      // Verificar si el formatted_address tiene referencias específicas y es mejor
      const originalFormatted = bestResult.formatted_address || "";
      const hasReference =
        originalFormatted.includes("metros") ||
        originalFormatted.includes("referencia") ||
        originalFormatted.includes("frente a") ||
        originalFormatted.includes("cerca de") ||
        originalFormatted.includes("al Sur de") ||
        originalFormatted.includes("al Norte de") ||
        originalFormatted.includes("al Este de") ||
        originalFormatted.includes("al Oeste de");

      let formatted;

      if (hasReference) {
        // Usar la dirección formateada original porque tiene referencias específicas
        formatted = originalFormatted.replace(", Ecuador", ""); // Quitar "Ecuador" del final
        console.log(`🎯 Usando dirección con referencia: "${formatted}"`);
      } else {
        // Formar string desde componentes: "Calle, Barrio, Sector"
        const parts = [];
        if (mainStreet) parts.push(mainStreet);
        if (barrio) parts.push(barrio);
        if (sector && sector !== "Sector") parts.push(sector);
        formatted = parts.length > 0 ? parts.join(", ") : "Ubicación GPS";
        console.log(`🏠 Construyendo desde componentes: "${formatted}"`);
      }

      console.log(`✅ Resultado final: "${formatted}"`);

      return {
        formatted: formatted,
      };
    } catch (error) {
      console.error("❌ Error extrayendo información de ubicación:", error);
      return {
        formatted: "Ubicación GPS",
      };
    }
  }

  /**
   * Valida que las coordenadas sean válidas
   */
  private isValidCoordinate(latitude: number, longitude: number): boolean {
    return (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !isNaN(latitude) &&
      !isNaN(longitude)
    );
  }

  /**
   * Método helper para obtener información de ubicación completa como string
   * Formato: "Calle Principal, Barrio, Sector"
   */
  async getSectorFromCoordinates(
    latitude: number,
    longitude: number
  ): Promise<string> {
    try {
      const result = await this.getNeighborhoodFromCoordinates(
        latitude,
        longitude
      );

      if (result.success && result.data) {
        return result.data.formatted;
      }

      return "Ubicación GPS";
    } catch (error) {
      console.error("❌ Error obteniendo sector:", error);
      return "Ubicación GPS";
    }
  }
}
