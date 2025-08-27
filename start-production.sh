#!/bin/bash

echo "🚀 Iniciando Bot WhatsApp Taxi en modo producción (VPS: 2 CPUs, 8GB RAM)"

# Configuración de Node.js optimizada para VPS
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=6144 --optimize-for-size --gc-interval=100"

# Verificar que el archivo .env existe
if [ ! -f .env ]; then
    echo "❌ Error: Archivo .env no encontrado"
    echo "📝 Copia .env.example a .env y configura las variables necesarias"
    exit 1
fi

# Verificar que las dependencias están instaladas
if [ ! -d node_modules ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Compilar el proyecto
echo "🔧 Compilando proyecto TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Error en compilación"
    exit 1
fi

# Verificar conexión a base de datos
echo "🔍 Verificando conexión a base de datos..."
npm run db:check 2>/dev/null || echo "⚠️ No se pudo verificar la conexión a BD (continuando...)"

# Mostrar configuración del sistema
echo "
🖥️  === CONFIGURACIÓN DEL SISTEMA ===
💾 Memoria disponible: $(free -h | awk '/^Mem:/ {print $2}')
🔧 CPUs disponibles: $(nproc)
📊 Carga del sistema: $(uptime | awk -F'load average:' '{print $2}')
🗂️ Espacio en disco: $(df -h . | awk 'NR==2 {print $4 " disponibles"}')
=====================================
"

echo "
⚙️  === CONFIGURACIÓN DEL BOT ===
🔋 Paralelización: ACTIVADA (2 lotes simultáneos)
📦 Tamaño de lote: 8 conductores
💾 Límite memoria: 6GB
⏱️ Timeout mensajes: 25s
🧹 Limpieza sesiones: cada 3 minutos
==================================
"

# Función para manejar señales de cierre
cleanup() {
    echo "
🛑 Cerrando Bot WhatsApp Taxi..."
    kill $BOT_PID 2>/dev/null
    wait $BOT_PID 2>/dev/null
    echo "✅ Bot cerrado correctamente"
    exit 0
}

# Configurar manejo de señales
trap cleanup SIGTERM SIGINT

# Iniciar el bot en segundo plano
echo "🚀 Iniciando bot..."
node dist/app.js &
BOT_PID=$!

echo "
✅ Bot WhatsApp Taxi iniciado
🔢 PID: $BOT_PID
📋 Para ver logs: tail -f logs/bot.log (si está configurado)
🛑 Para detener: kill $BOT_PID o presiona Ctrl+C
"

# Monitoreo básico cada 60 segundos
while kill -0 $BOT_PID 2>/dev/null; do
    sleep 60
    
    # Mostrar uso de recursos cada 10 minutos (10 * 60 = 600s)
    if [ $(($(date +%s) % 600)) -eq 0 ]; then
        echo "📊 $(date): Memoria: $(free -h | awk '/^Mem:/ {print $3 "/" $2}'), CPU: $(uptime | awk -F'load average:' '{print $2}')"
    fi
done

echo "❌ El bot se ha detenido inesperadamente"
exit 1