import { logger } from './server-logger'

describe('server-logger', () => {
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('info', () => {
    it('should log info message', () => {
      logger.info('test', 'Info message')
      expect(console.log).toHaveBeenCalled()
    })

    it('should include component and message', () => {
      logger.info('component', 'message')
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[component]')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('message')
      )
    })

    it('should include context when provided', () => {
      logger.info('component', 'message', { userId: '123' })
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('userId')
      )
    })
  })

  describe('warn', () => {
    it('should log warning message', () => {
      logger.warn('test', 'Warning message')
      expect(console.warn).toHaveBeenCalled()
    })
  })

  describe('error', () => {
    it('should log error message', () => {
      logger.error('test', 'Error message')
      expect(console.error).toHaveBeenCalled()
    })

    it('should include error details when Error is passed', () => {
      const err = new Error('test error')
      logger.error('component', 'message', err)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('test error')
      )
    })

    it('should handle non-Error objects', () => {
      logger.error('component', 'message', { code: 'ERR_001' })
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('ERR_001')
      )
    })
  })

  describe('debug', () => {
    it('should exist', () => {
      expect(typeof logger.debug).toBe('function')
    })
  })
})