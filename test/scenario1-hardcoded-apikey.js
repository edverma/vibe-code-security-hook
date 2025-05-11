// Bad: Hardcoded API key (should be caught)
function authenticateService() {
  const apiKey = 'ak_live_45gHs982jJdKLkm12345abcdef8283kLLsGh11';
  return callExternalService(apiKey);
}

function callExternalService(key) {
  // Make API call with key
  return fetch('https://api.example.com/data', {
    headers: {
      'Authorization': `Bearer ${key}`
    }
  });
}