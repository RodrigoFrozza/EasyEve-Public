type LogLevel = 'info' | 'warn' | 'error' | 'debug'

class ServerLogger {
  private format(level: LogLevel, component: string, message: string, context?: any) {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}${contextStr}`
  }

  info(component: string, message: string, context?: any) {
    console.log(this.format('info', component, message, context))
  }

  warn(component: string, message: string, context?: any) {
    console.warn(this.format('warn', component, message, context))
  }

  error(component: string, message: string, error?: any, context?: any) {
    const errorDetails = error instanceof Error ? 
      { message: error.message, stack: error.stack } : 
      error
    
    console.error(this.format('error', component, message, {
      ...context,
      error: errorDetails
    }))
  }

  debug(component: string, message: string, context?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.log(this.format('debug', component, message, context))
    }
  }
}

export const logger = new ServerLogger()
