import axios, { AxiosInstance } from 'axios'
import { logger } from './server-logger'
import { AppError } from './app-error'
import { ErrorCodes } from './error-codes'

export const ESI_BASE_URL = 'https://esi.evetech.net/latest'
export const USER_AGENT = 'EasyEve (https://easyeve.cloud)'

// ESI Error Limit Monitoring
let esiErrorLimitRemain = 100
let esiErrorLimitReset = 60

// Concurrency Control
const MAX_CONCURRENT_REQUESTS = 20
let activeRequests = 0
const requestQueue: (() => void)[] = []

const processQueue = () => {
  while (activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
    const next = requestQueue.shift()
    if (next) {
      activeRequests++
      next()
    }
  }
}

// Axios Client
export const esiClient: AxiosInstance = axios.create({
  baseURL: ESI_BASE_URL,
  headers: {
    ...(typeof window === 'undefined' ? { 'User-Agent': USER_AGENT } : {}),
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// Request Interceptor to check error limit and handle concurrency before sending
esiClient.interceptors.request.use(async (config) => {
  // Wait if we have too many active requests
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    await new Promise<void>(resolve => requestQueue.push(resolve))
  } else {
    activeRequests++
  }

  if (esiErrorLimitRemain < 10) {
    logger.warn('ESI', `Low error limit: ${esiErrorLimitRemain}. Waiting for reset in ${esiErrorLimitReset}s`)
    // If we are extremely low, we should wait or throw
    if (esiErrorLimitRemain <= 1) {
      activeRequests--
      processQueue()
      throw new AppError(ErrorCodes.ESI_ERROR_LIMIT_EXCEEDED, `ESI Error Limit reached. Reset in ${esiErrorLimitReset}s`, 420)
    }
  }
  return config
})

// Response Interceptor for retries, logging and error limit tracking
esiClient.interceptors.response.use(
  (response) => {
    // Update error limits from headers
    const remain = response.headers['x-esi-error-limit-remain']
    const reset = response.headers['x-esi-error-limit-reset']
    
    if (remain) esiErrorLimitRemain = parseInt(remain as string)
    if (reset) esiErrorLimitReset = parseInt(reset as string)

    activeRequests--
    processQueue()

    return response
  },
  (error) => {
    // Ensure we always decrement active requests even on failure
    activeRequests--
    processQueue()

    if (error.response) {
      const remain = error.response.headers['x-esi-error-limit-remain']
      const reset = error.response.headers['x-esi-error-limit-reset']
      
      if (remain) esiErrorLimitRemain = parseInt(remain as string)
      if (reset) esiErrorLimitReset = parseInt(reset as string)
      
      if (error.response.status === 420) {
        logger.error('ESI', '420 Enhance Your Calm - Error limit reached!', error)
        return Promise.reject(new AppError(ErrorCodes.ESI_ERROR_LIMIT_EXCEEDED, 'ESI Error Limit reached', 420))
      }
    }

    logger.error('ESI', `HTTP Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    })
    return Promise.reject(error)
  }
)

