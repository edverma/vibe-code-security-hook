// Using environment variables for database connection (should be safe)
function connectToDatabase() {
  const connection = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  };

  // Verify all required environment variables are present
  const requiredEnvVars = ['DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set`);
    }
  }
  
  return createPoolConnection(connection);
}

function createPoolConnection(config) {
  console.log(`Connecting to database at ${config.host}:${config.port}/${config.database}`);
  // Database connection pool creation logic
}