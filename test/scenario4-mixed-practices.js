// Mixed practices - some good, some bad (partially risky)
const config = {
  // Good: Environment variable
  databaseUrl: process.env.DATABASE_URL,
  
  // Bad: Hardcoded secret
  temporarySecret: 'temp_sk_1234abcdef5678',
  
  // Good: Environment variable
  apiTimeout: process.env.API_TIMEOUT || 3000,
  
  // Good: Non-sensitive data
  debug: true,
  
  // Bad: Hardcoded credential
  backupCredentials: {
    username: 'backup_user',
    password: 'backup_pw_1234!'
  }
};

function initializeApp() {
  console.log('Initializing app with config...');
  // Application logic
}