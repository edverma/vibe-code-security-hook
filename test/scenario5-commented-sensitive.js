// Commented out sensitive information (still risky)
function getDatabaseConnection() {
  // Using environment variables for production
  const connectionString = process.env.DB_CONNECTION_STRING;
  
  // For local development:
  // const connectionString = 'postgresql://devuser:devpassword123@localhost:5432/devdb';
  
  // For testing:
  // const connectionString = 'postgresql://testuser:test_pw_9876@testdb:5432/testdb';
  
  return createConnection(connectionString);
}

function createConnection(connString) {
  console.log(`Connecting to database...`);
  // Database connection logic
}