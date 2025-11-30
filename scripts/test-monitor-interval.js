const { startCurrencyMonitoring, stopCurrencyMonitoring } = require('../src/services/currencyMonitor');

console.log('Starting currency monitor test...');
console.log('It should send an initial notification, and then only if values change.');

// Start monitoring
startCurrencyMonitoring();

// Simulate a run after 5 seconds (simulating the interval)
// We can't easily simulate the interval firing without waiting, but we can check logs.
// For this test, we'll let it run for a bit to see the initial fetch.

setTimeout(() => {
  console.log('Stopping monitor test...');
  stopCurrencyMonitoring();
}, 10000);
