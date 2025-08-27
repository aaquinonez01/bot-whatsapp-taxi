import { config } from "../config/environments.js";

interface PerformanceMetrics {
  messagesPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
  successfulConnections: number;
  failedConnections: number;
  badMACErrors: number;
  timeouts: number;
  lastResetTime: Date;
}

interface ConnectionHealth {
  isHealthy: boolean;
  lastSuccessfulMessage: Date;
  consecutiveFailures: number;
  totalMessages: number;
  sessionErrors: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    messagesPerMinute: 0,
    averageResponseTime: 0,
    errorRate: 0,
    successfulConnections: 0,
    failedConnections: 0,
    badMACErrors: 0,
    timeouts: 0,
    lastResetTime: new Date()
  };

  private connectionHealth: Map<string, ConnectionHealth> = new Map();
  private responseTimes: number[] = [];
  private messageCount = 0;
  private errorCount = 0;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.generateReport();
      this.resetCounters();
    }, config.performance.healthCheckInterval);
    
    console.log("📊 Performance monitoring started");
  }

  public recordMessageSent(phoneNumber: string, responseTime: number): void {
    this.messageCount++;
    this.responseTimes.push(responseTime);
    this.metrics.successfulConnections++;
    
    // Actualizar salud de conexión
    const health = this.getOrCreateConnectionHealth(phoneNumber);
    health.lastSuccessfulMessage = new Date();
    health.consecutiveFailures = 0;
    health.totalMessages++;
  }

  public recordMessageFailed(phoneNumber: string, error: Error): void {
    this.errorCount++;
    this.metrics.failedConnections++;
    
    // Categorizar errores
    if (error.message.includes('Bad MAC')) {
      this.metrics.badMACErrors++;
      this.recordSessionError(phoneNumber);
    } else if (error.message.includes('timeout') || error.message.includes('Timed Out')) {
      this.metrics.timeouts++;
    }
    
    // Actualizar salud de conexión
    const health = this.getOrCreateConnectionHealth(phoneNumber);
    health.consecutiveFailures++;
    health.totalMessages++;
    
    // Marcar como no saludable si hay muchos fallos consecutivos
    if (health.consecutiveFailures >= 3) {
      health.isHealthy = false;
    }
  }

  private recordSessionError(phoneNumber: string): void {
    const health = this.getOrCreateConnectionHealth(phoneNumber);
    health.sessionErrors++;
    console.warn(`⚠️ Session error recorded for ${phoneNumber} (total: ${health.sessionErrors})`);
  }

  private getOrCreateConnectionHealth(phoneNumber: string): ConnectionHealth {
    if (!this.connectionHealth.has(phoneNumber)) {
      this.connectionHealth.set(phoneNumber, {
        isHealthy: true,
        lastSuccessfulMessage: new Date(),
        consecutiveFailures: 0,
        totalMessages: 0,
        sessionErrors: 0
      });
    }
    return this.connectionHealth.get(phoneNumber)!;
  }

  public getMetrics(): PerformanceMetrics {
    // Calcular métricas en tiempo real
    const timeSinceReset = (new Date().getTime() - this.metrics.lastResetTime.getTime()) / 1000 / 60;
    this.metrics.messagesPerMinute = timeSinceReset > 0 ? this.messageCount / timeSinceReset : 0;
    this.metrics.averageResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0;
    this.metrics.errorRate = this.messageCount > 0 ? (this.errorCount / this.messageCount) * 100 : 0;
    
    return { ...this.metrics };
  }

  public getUnhealthyConnections(): string[] {
    return Array.from(this.connectionHealth.entries())
      .filter(([_, health]) => !health.isHealthy)
      .map(([phone, _]) => phone);
  }

  public getConnectionHealth(phoneNumber: string): ConnectionHealth | null {
    return this.connectionHealth.get(phoneNumber) || null;
  }

  public resetConnectionHealth(phoneNumber: string): void {
    const health = this.getOrCreateConnectionHealth(phoneNumber);
    health.isHealthy = true;
    health.consecutiveFailures = 0;
    health.sessionErrors = 0;
    console.log(`🔄 Connection health reset for ${phoneNumber}`);
  }

  private generateReport(): void {
    const metrics = this.getMetrics();
    const unhealthyConnections = this.getUnhealthyConnections();
    
    console.log(`
📊 === PERFORMANCE REPORT ===
📈 Messages/minute: ${metrics.messagesPerMinute.toFixed(2)}
⏱️  Average response time: ${metrics.averageResponseTime.toFixed(0)}ms
🎯 Success rate: ${(100 - metrics.errorRate).toFixed(1)}%
✅ Successful: ${metrics.successfulConnections}
❌ Failed: ${metrics.failedConnections}
🔐 Bad MAC errors: ${metrics.badMACErrors}
⏰ Timeouts: ${metrics.timeouts}
🚨 Unhealthy connections: ${unhealthyConnections.length}
${unhealthyConnections.length > 0 ? `   - ${unhealthyConnections.join(', ')}` : ''}
========================
    `);

    // Alertas si hay problemas críticos
    if (metrics.errorRate > 20) {
      console.error(`🚨 ALERT: High error rate detected (${metrics.errorRate.toFixed(1)}%)`);
    }
    
    if (metrics.badMACErrors > 5) {
      console.error(`🚨 ALERT: High number of Bad MAC errors (${metrics.badMACErrors})`);
    }
    
    if (metrics.averageResponseTime > 10000) {
      console.error(`🚨 ALERT: High response time (${metrics.averageResponseTime.toFixed(0)}ms)`);
    }
  }

  private resetCounters(): void {
    // Mantener un historial corto para métricas promedio
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-50);
    }
    
    // Reset contadores periódicamente
    const hoursSinceReset = (new Date().getTime() - this.metrics.lastResetTime.getTime()) / 1000 / 60 / 60;
    if (hoursSinceReset >= 1) {
      this.messageCount = 0;
      this.errorCount = 0;
      this.metrics.lastResetTime = new Date();
      this.metrics.successfulConnections = 0;
      this.metrics.failedConnections = 0;
      this.metrics.badMACErrors = 0;
      this.metrics.timeouts = 0;
      console.log("🔄 Performance counters reset");
    }
  }

  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log("🛑 Performance monitoring stopped");
  }

  public exportMetricsForDashboard(): object {
    const metrics = this.getMetrics();
    const unhealthyCount = this.getUnhealthyConnections().length;
    const totalConnections = this.connectionHealth.size;
    
    return {
      timestamp: new Date().toISOString(),
      performance: {
        messagesPerMinute: Number(metrics.messagesPerMinute.toFixed(2)),
        averageResponseTime: Number(metrics.averageResponseTime.toFixed(0)),
        successRate: Number((100 - metrics.errorRate).toFixed(1))
      },
      connections: {
        total: totalConnections,
        healthy: totalConnections - unhealthyCount,
        unhealthy: unhealthyCount
      },
      errors: {
        badMAC: metrics.badMACErrors,
        timeouts: metrics.timeouts,
        total: metrics.failedConnections
      }
    };
  }
}