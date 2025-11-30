const { fetchRates } = require('../src/services/currencyMonitor');

async function testCurrency() {
  console.log('🔍 Testing Currency Monitor (Updated to JPY/KRW)...');

  const results = await fetchRates();
  
  for (const result of results) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Testing: ${result.name}`);
    console.log(`Target URL: ${result.targetUrl}`);
    
    console.log(`Result Status: ${result.success ? 'SUCCESS ✅' : 'FAILED ❌'}`);
    if (result.success) {
      console.log(`Price: ${result.price}`);
      console.log(`Unit: ${result.unit}`);
    } else {
      console.error(`Error: ${result.error}`);
    }
  }
  console.log(`\n--------------------------------------------------`);
  console.log('Test Completed.');
}

testCurrency();
