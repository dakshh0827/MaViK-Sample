import dotenv from 'dotenv';
dotenv.config();

/**
 * JWT Configuration
 * Exports the secret and token expiry from environment variables.
 */
export const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
};

if (!jwtConfig.secret) {
  throw new Error('FATAL ERROR: JWT_SECRET is not defined in .env file.');
}