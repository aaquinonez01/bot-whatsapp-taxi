interface UserTimer {
  timerId: NodeJS.Timeout;
  phone: string;
  startTime: number;
  expired: boolean;
}

const userTimers = new Map<string, UserTimer>();

/**
 * Inicia un timer de inactividad para un usuario específico
 * Este timer solo marca el estado del usuario como expirado, no intenta interrumpir flows
 * @param ctx Contexto del usuario
 * @param timeoutMs Tiempo en milisegundos antes del timeout
 */
export const start = (ctx: any, timeoutMs: number = 300000): void => {
  const phone = ctx.from;
  
  // Limpiar timer existente si existe
  stop(ctx);
  
  console.log(`🕐 Iniciando timer global de ${timeoutMs/1000}s para usuario ${phone}`);
  
  const startTime = Date.now();
  
  const timerId = setTimeout(async () => {
    try {
      console.log(`⏰ Timeout global ejecutado para usuario ${phone} - marcando como expirado`);
      
      // Marcar que el usuario ha expirado pero no interrumpir flows activos
      const timer = userTimers.get(phone);
      if (timer) {
        timer.expired = true;
        console.log(`✅ Usuario ${phone} marcado como expirado - será limpiado en próxima interacción`);
      }
      
    } catch (error) {
      console.error(`❌ Error en timeout global para usuario ${phone}:`, error);
    }
  }, timeoutMs);
  
  // Guardar timer en el mapa
  userTimers.set(phone, { timerId, phone, startTime, expired: false });
};

/**
 * Reinicia el timer de inactividad para un usuario
 * @param ctx Contexto del usuario
 * @param timeoutMs Tiempo en milisegundos antes del timeout
 */
export const reset = (ctx: any, timeoutMs: number = 300000): void => {
  const phone = ctx.from;
  
  console.log(`🔄 Reiniciando timer global para usuario ${phone}`);
  
  // Parar el timer actual y iniciar uno nuevo
  stop(ctx);
  start(ctx, timeoutMs);
};

/**
 * Detiene y limpia el timer de inactividad para un usuario
 * @param ctx Contexto del usuario
 */
export const stop = (ctx: any): void => {
  const phone = ctx.from;
  const userTimer = userTimers.get(phone);
  
  if (userTimer) {
    console.log(`⏹️ Deteniendo timer para usuario ${phone}`);
    clearTimeout(userTimer.timerId);
    userTimers.delete(phone);
  }
};

/**
 * Verifica si un usuario tiene un timer activo
 * @param ctx Contexto del usuario
 * @returns boolean
 */
export const hasActiveTimer = (ctx: any): boolean => {
  return userTimers.has(ctx.from);
};

/**
 * Verifica si el timer de un usuario ha expirado
 * @param ctx Contexto del usuario
 * @returns boolean
 */
export const isExpired = (ctx: any): boolean => {
  const timer = userTimers.get(ctx.from);
  return timer ? timer.expired : false;
};

/**
 * Obtiene información del timer de un usuario
 * @param ctx Contexto del usuario
 * @returns UserTimer | undefined
 */
export const getTimer = (ctx: any): UserTimer | undefined => {
  return userTimers.get(ctx.from);
};

/**
 * Limpia el estado expirado de un usuario y cancela solicitudes pendientes
 * @param ctx Contexto del usuario
 * @param state Estado del usuario
 * @returns boolean - true si se limpió por expiración
 */
export const cleanExpiredUser = async (ctx: any, state: any): Promise<boolean> => {
  const timer = userTimers.get(ctx.from);
  
  if (timer && timer.expired) {
    console.log(`🧹 Limpiando usuario expirado ${ctx.from}`);
    
    try {
      // Cancelar solicitud pendiente si existe
      const { RequestService } = await import("../services/request.service.js");
      const requestService = new RequestService();
      const pendingResult = await requestService.getClientPendingRequest(ctx.from);
      
      if (pendingResult.success && pendingResult.data) {
        console.log(`🗑️ Cancelando solicitud pendiente ${pendingResult.data.id} por expiración`);
        await requestService.cancelRequest(
          pendingResult.data.id, 
          "Cancelada por inactividad del cliente (5+ minutos sin respuesta)"
        );
      }
      
      // Limpiar estado del usuario
      await state.clear();
      
      // Limpiar timer
      stop(ctx);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Error limpiando usuario expirado ${ctx.from}:`, error);
      // Aún así limpiar timer y estado básico
      await state.clear();
      stop(ctx);
      return true;
    }
  }
  
  return false;
};