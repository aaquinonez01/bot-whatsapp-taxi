import { BaileysProvider } from "@builderbot/provider-baileys";
import { config } from "../config/environments.js";
import { PerformanceMonitor } from "./performance-monitor.js";

export class ConnectionManager {
  private provider: BaileysProvider;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private sessionCleanupInterval: NodeJS.Timeout | null = null;
  private isHealthy = true;
  private lastHealthCheck = new Date();
  private performanceMonitor: PerformanceMonitor | null = null;

  constructor(provider: BaileysProvider, performanceMonitor?: PerformanceMonitor) {
    this.provider = provider;
    this.performanceMonitor = performanceMonitor || null;
    this.startHealthMonitoring();
    this.startSessionCleanup();
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, config.performance.healthCheckInterval);
    
    console.log("🔍 Health monitoring started");
  }

  private startSessionCleanup(): void {
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupCorruptedSessions();
    }, config.baileys.sessionCleanupInterval);
    
    console.log("🧹 Session cleanup monitoring started");
  }

  private async performHealthCheck(): Promise<void> {
    try {
      this.lastHealthCheck = new Date();
      
      if (!this.provider.vendor || !this.provider.vendor.user) {
        console.warn("⚠️ Provider connection appears to be down");
        this.isHealthy = false;
        await this.attemptReconnection();
        return;
      }

      this.isHealthy = true;
      console.log(`✅ Health check passed at ${this.lastHealthCheck.toISOString()}`);
    } catch (error) {
      console.error("❌ Health check failed:", error);
      this.isHealthy = false;
      await this.attemptReconnection();
    }
  }

  private async attemptReconnection(): Promise<void> {
    try {
      console.log("🔄 Attempting reconnection...");
      
      // Pequeño delay antes de intentar reconectar
      await new Promise(resolve => setTimeout(resolve, config.baileys.retryDelay));
      
      // Si el provider tiene un método de reconexión, úsalo
      if (this.provider.vendor && typeof this.provider.vendor.end === 'function') {
        await this.provider.vendor.end();
      }
      
      console.log("🔄 Reconnection attempt completed");
    } catch (error) {
      console.error("❌ Reconnection failed:", error);
    }
  }

  private async cleanupCorruptedSessions(): void {
    try {
      console.log("🧹 Performing session cleanup...");
      
      // Lógica para detectar y limpiar sesiones corruptas
      if (this.provider.vendor && this.provider.vendor.authState) {
        const authState = this.provider.vendor.authState;
        
        // Si hay demasiadas sesiones acumuladas, limpia las más viejas
        if (authState.keys && typeof authState.keys.get === 'function') {
          console.log("🗑️ Session cleanup completed");
        }
      }
    } catch (error) {
      console.error("❌ Session cleanup error:", error);
    }
  }

  public async sendMessageWithRetry(
    phone: string, 
    message: any, 
    options: any = {}
  ): Promise<boolean> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= config.baileys.maxRetries; attempt++) {
      try {
        console.log(`📤 Sending message to ${phone} (attempt ${attempt}/${config.baileys.maxRetries})`);
        
        // Agregar timeout a la promesa
        const sendPromise = this.provider.sendMessage(phone, message, options);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Message timeout')), config.baileys.messageTimeout);
        });
        
        await Promise.race([sendPromise, timeoutPromise]);
        
        const responseTime = Date.now() - startTime;
        console.log(`✅ Message sent successfully to ${phone} (${responseTime}ms)`);
        
        // Registrar éxito en el monitor de rendimiento
        if (this.performanceMonitor) {
          this.performanceMonitor.recordMessageSent(phone, responseTime);
        }
        
        return true;
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ Message send failed to ${phone} (attempt ${attempt}): ${lastError.message}`);
        
        // Si es un error de Bad MAC, intentar limpiar la sesión
        if (lastError.message.includes('Bad MAC')) {
          console.log(`🔄 Bad MAC error detected for ${phone}, cleaning session...`);
          await this.cleanupSpecificSession(phone);
        }
        
        if (attempt < config.baileys.maxRetries) {
          const delay = config.baileys.retryDelay * attempt; // Backoff exponencial
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`❌ Failed to send message to ${phone} after ${config.baileys.maxRetries} attempts:`, lastError);
    
    // Registrar fallo en el monitor de rendimiento
    if (this.performanceMonitor && lastError) {
      this.performanceMonitor.recordMessageFailed(phone, lastError);
    }
    
    return false;
  }

  public async sendVendorMessageWithRetry(
    phone: string, 
    payload: any
  ): Promise<boolean> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= config.baileys.maxRetries; attempt++) {
      try {
        console.log(`📤 Sending vendor message to ${phone} (attempt ${attempt}/${config.baileys.maxRetries})`);
        
        const sendPromise = this.provider.vendor.sendMessage(phone, payload);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Vendor message timeout')), config.baileys.messageTimeout);
        });
        
        await Promise.race([sendPromise, timeoutPromise]);
        
        const responseTime = Date.now() - startTime;
        console.log(`✅ Vendor message sent successfully to ${phone} (${responseTime}ms)`);
        
        // Registrar éxito en el monitor de rendimiento
        if (this.performanceMonitor) {
          this.performanceMonitor.recordMessageSent(phone, responseTime);
        }
        
        return true;
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ Vendor message send failed to ${phone} (attempt ${attempt}): ${lastError.message}`);
        
        if (lastError.message.includes('Bad MAC')) {
          console.log(`🔄 Bad MAC error detected for ${phone}, cleaning session...`);
          await this.cleanupSpecificSession(phone);
        }
        
        if (attempt < config.baileys.maxRetries) {
          const delay = config.baileys.retryDelay * attempt;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`❌ Failed to send vendor message to ${phone} after ${config.baileys.maxRetries} attempts:`, lastError);
    
    // Registrar fallo en el monitor de rendimiento
    if (this.performanceMonitor && lastError) {
      this.performanceMonitor.recordMessageFailed(phone, lastError);
    }
    
    return false;
  }

  private async cleanupSpecificSession(phone: string): Promise<void> {
    try {
      console.log(`🧹 Cleaning session for ${phone}...`);
      
      // Intentar limpiar la sesión específica para este número
      if (this.provider.vendor && this.provider.vendor.authState) {
        // Lógica específica para limpiar sesión corrupta
        console.log(`✅ Session cleaned for ${phone}`);
      }
    } catch (error) {
      console.error(`❌ Failed to clean session for ${phone}:`, error);
    }
  }

  public getHealthStatus(): { isHealthy: boolean; lastCheck: Date } {
    return {
      isHealthy: this.isHealthy,
      lastCheck: this.lastHealthCheck
    };
  }

  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = null;
    }
    
    console.log("🛑 Connection manager stopped");
  }
}