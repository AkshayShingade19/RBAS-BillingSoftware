export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  database: { uri: string };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  corsOrigins: string[];
  mail: { transport: 'console' | 'smtp'; from: string };
  throttler: { ttlSeconds: number; limit: number };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  database: {
    uri:
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/ledgerly',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  mail: {
    transport: (process.env.MAIL_TRANSPORT as 'console' | 'smtp') || 'console',
    from: process.env.MAIL_FROM || 'Ledgerly <no-reply@ledgerly.dev>',
  },
  throttler: {
    ttlSeconds: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },
});