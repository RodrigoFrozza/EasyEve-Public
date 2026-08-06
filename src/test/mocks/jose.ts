/**
 * Jest-safe stub for `jose`. The published package ships ESM that Jest does not
 * transform by default (`Unexpected token 'export'`). Real code imports `jose`;
 * tests map `^jose$` here via `moduleNameMapper` in jest.config.js.
 */
export const SignJWT = jest.fn(function SignJWT() {
  return {
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEyMyIsImNoYXJhY3RlcklkIjoxMjM0NTYsIm93bmVySGFzaCI6Im93bmVyLWhhc2gtYWJjIiwiaWF0IjoxNzA0MDY3MjAwLCJleHAiOjE3MDQwNzA4MDB9.mock-signature'
    ),
  }
})

export const jwtVerify = jest.fn()
