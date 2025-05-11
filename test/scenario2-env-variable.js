// Good: Using environment variable (should be safe)
function authenticateService() {
  // API key stored in environment variable
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error('API_KEY environment variable is not set');
  }
  return callExternalService(apiKey);
}

function callExternalService(key) {
  return fetch('https://api.example.com/data', {
    headers: {
      'Authorization': `Bearer ${key}`
    }
  });
}