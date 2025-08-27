import * as os from 'os';
import { config } from "../config/environments.js";

interface ResourceUsage {
  cpu: {
    usage: number; // Porcentaje
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number; // MB
    used: number; // MB
    free: number; // MB
    usagePercent: number;
  };
  process: {
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number; // segundos
    pid: number;
  };
}

interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  warningMemoryMB: number;
  warningCpuPercent: number;
}

export class ResourceMonitor {
  private limits: ResourceLimits;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastCpuInfo: os.CpuInfo[] = [];
  private alertCooldowns: Map<string, number> = new Map();

  constructor() {
    // Configurar límites basados en VPS de 2 CPUs y 8GB RAM
    this.limits = {
      maxMemoryMB: config.performance.memoryThreshold || 6000, // 6GB límite (75% de 8GB)
      maxCpuPercent: 80, // 80% CPU máximo
      warningMemoryMB: 5000, // 5GB advertencia (62.5% de 8GB)
      warningCpuPercent: 60, // 60% CPU advertencia
    };

    this.lastCpuInfo = os.cpus();
    this.startMonitoring();
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkResourceUsage();
    }, 30000); // Cada 30 segundos

    console.log("🖥️ Resource monitoring started for VPS (2 CPUs, 8GB RAM)");
    console.log(`📊 Limits: Memory ${this.limits.maxMemoryMB}MB, CPU ${this.limits.maxCpuPercent}%`);
  }

  private async checkResourceUsage(): Promise<void> {
    const usage = this.getCurrentUsage();
    
    // Log periódico cada 5 minutos
    const now = Date.now();
    if (!this.alertCooldowns.has('periodic_log') || now - this.alertCooldowns.get('periodic_log')! > 300000) {
      this.logResourceUsage(usage);
      this.alertCooldowns.set('periodic_log', now);
    }

    // Verificar límites críticos
    this.checkMemoryLimits(usage);
    this.checkCpuLimits(usage);
  }

  private getCurrentUsage(): ResourceUsage {
    const totalMem = os.totalmem() / (1024 * 1024); // MB
    const freeMem = os.freemem() / (1024 * 1024); // MB
    const usedMem = totalMem - freeMem;
    
    const processMemory = process.memoryUsage();
    
    // Calcular CPU usage (aproximación)
    const currentCpus = os.cpus();
    const cpuUsage = this.calculateCpuUsage(this.lastCpuInfo, currentCpus);
    this.lastCpuInfo = currentCpus;

    return {
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
        loadAverage: os.loadavg(),
      },
      memory: {
        total: Math.round(totalMem),
        used: Math.round(usedMem),
        free: Math.round(freeMem),
        usagePercent: Math.round((usedMem / totalMem) * 100),
      },
      process: {
        memoryUsage: processMemory,
        uptime: Math.round(process.uptime()),
        pid: process.pid,
      },
    };
  }

  private calculateCpuUsage(oldCpus: os.CpuInfo[], newCpus: os.CpuInfo[]): number {
    let totalIdle = 0;
    let totalTick = 0;

    for (let i = 0; i < newCpus.length; i++) {
      const oldCpu = oldCpus[i];
      const newCpu = newCpus[i];

      const oldTotal = Object.values(oldCpu.times).reduce((a, b) => a + b, 0);
      const newTotal = Object.values(newCpu.times).reduce((a, b) => a + b, 0);

      const totalDiff = newTotal - oldTotal;
      const idleDiff = newCpu.times.idle - oldCpu.times.idle;

      totalTick += totalDiff;
      totalIdle += idleDiff;
    }

    const cpuUsage = totalTick > 0 ? Math.round((1 - totalIdle / totalTick) * 100) : 0;
    return Math.min(cpuUsage, 100); // Limitar a 100%
  }

  private checkMemoryLimits(usage: ResourceUsage): void {
    const processMemMB = usage.process.memoryUsage.rss / (1024 * 1024);
    const now = Date.now();

    // Advertencia de memoria del proceso
    if (processMemMB > this.limits.warningMemoryMB) {
      if (!this.alertCooldowns.has('process_memory_warning') || 
          now - this.alertCooldowns.get('process_memory_warning')! > 600000) { // 10 min cooldown
        console.warn(`⚠️ MEMORY WARNING: Process using ${Math.round(processMemMB)}MB (limit: ${this.limits.maxMemoryMB}MB)`);
        this.alertCooldowns.set('process_memory_warning', now);
      }
    }

    // Alerta crítica de memoria del proceso
    if (processMemMB > this.limits.maxMemoryMB) {
      if (!this.alertCooldowns.has('process_memory_critical') || 
          now - this.alertCooldowns.get('process_memory_critical')! > 300000) { // 5 min cooldown
        console.error(`🚨 MEMORY CRITICAL: Process using ${Math.round(processMemMB)}MB (limit: ${this.limits.maxMemoryMB}MB)`);
        console.error(`💾 Consider restarting the application or increasing memory limits`);
        this.alertCooldowns.set('process_memory_critical', now);
        
        // Forzar garbage collection si está disponible
        if (global.gc) {
          console.log("🗑️ Forcing garbage collection...");
          global.gc();
        }
      }
    }

    // Advertencia de memoria del sistema
    if (usage.memory.usagePercent > 75) {
      if (!this.alertCooldowns.has('system_memory_warning') || 
          now - this.alertCooldowns.get('system_memory_warning')! > 600000) {
        console.warn(`⚠️ SYSTEM MEMORY WARNING: ${usage.memory.usagePercent}% used (${usage.memory.used}/${usage.memory.total}MB)`);
        this.alertCooldowns.set('system_memory_warning', now);
      }
    }
  }

  private checkCpuLimits(usage: ResourceUsage): void {
    const now = Date.now();

    // Advertencia de CPU
    if (usage.cpu.usage > this.limits.warningCpuPercent) {
      if (!this.alertCooldowns.has('cpu_warning') || 
          now - this.alertCooldowns.get('cpu_warning')! > 300000) { // 5 min cooldown
        console.warn(`⚠️ CPU WARNING: ${usage.cpu.usage}% usage (warning: ${this.limits.warningCpuPercent}%)`);
        console.warn(`📊 Load average: ${usage.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}`);
        this.alertCooldowns.set('cpu_warning', now);
      }
    }

    // Alerta crítica de CPU
    if (usage.cpu.usage > this.limits.maxCpuPercent) {
      if (!this.alertCooldowns.has('cpu_critical') || 
          now - this.alertCooldowns.get('cpu_critical')! > 180000) { // 3 min cooldown
        console.error(`🚨 CPU CRITICAL: ${usage.cpu.usage}% usage (limit: ${this.limits.maxCpuPercent}%)`);
        console.error(`⚡ Consider optimizing concurrent operations or scaling resources`);
        this.alertCooldowns.set('cpu_critical', now);
      }
    }
  }

  private logResourceUsage(usage: ResourceUsage): void {
    const processMemMB = Math.round(usage.process.memoryUsage.rss / (1024 * 1024));
    const heapUsedMB = Math.round(usage.process.memoryUsage.heapUsed / (1024 * 1024));
    
    console.log(`
🖥️  === RESOURCE USAGE (VPS: 2 CPUs, 8GB RAM) ===
🔧 CPU: ${usage.cpu.usage}% (${usage.cpu.cores} cores)
📈 Load: ${usage.cpu.loadAverage.map(l => l.toFixed(1)).join(', ')} (1m, 5m, 15m)
💾 System Memory: ${usage.memory.usagePercent}% (${usage.memory.used}/${usage.memory.total}MB)
🔍 Process Memory: ${processMemMB}MB (Heap: ${heapUsedMB}MB)
⏰ Uptime: ${Math.floor(usage.process.uptime / 3600)}h ${Math.floor((usage.process.uptime % 3600) / 60)}m
===========================================
    `);
  }

  public getResourceUsage(): ResourceUsage {
    return this.getCurrentUsage();
  }

  public isResourceHealthy(): boolean {
    const usage = this.getCurrentUsage();
    const processMemMB = usage.process.memoryUsage.rss / (1024 * 1024);
    
    return (
      usage.cpu.usage < this.limits.maxCpuPercent &&
      processMemMB < this.limits.maxMemoryMB &&
      usage.memory.usagePercent < 90
    );
  }

  public getOptimalBatchSize(): number {
    const usage = this.getCurrentUsage();
    const processMemMB = usage.process.memoryUsage.rss / (1024 * 1024);
    
    // Ajustar tamaño de lote basado en recursos disponibles
    if (processMemMB > this.limits.warningMemoryMB || usage.cpu.usage > this.limits.warningCpuPercent) {
      return Math.max(4, config.performance.batchSize - 2); // Reducir lote
    } else if (processMemMB < 3000 && usage.cpu.usage < 40) {
      return Math.min(12, config.performance.batchSize + 2); // Aumentar lote
    }
    
    return config.performance.batchSize; // Mantener configuración
  }

  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log("🛑 Resource monitoring stopped");
  }

  public exportResourceMetrics(): object {
    const usage = this.getCurrentUsage();
    const processMemMB = Math.round(usage.process.memoryUsage.rss / (1024 * 1024));
    
    return {
      timestamp: new Date().toISOString(),
      vps: {
        cpus: 2,
        totalMemoryGB: 8,
        memoryLimitMB: this.limits.maxMemoryMB
      },
      current: {
        cpu: {
          usage: usage.cpu.usage,
          loadAverage: usage.cpu.loadAverage[0]
        },
        memory: {
          systemUsagePercent: usage.memory.usagePercent,
          processMemoryMB: processMemMB,
          heapUsedMB: Math.round(usage.process.memoryUsage.heapUsed / (1024 * 1024))
        }
      },
      health: {
        isHealthy: this.isResourceHealthy(),
        optimalBatchSize: this.getOptimalBatchSize()
      }
    };
  }
}