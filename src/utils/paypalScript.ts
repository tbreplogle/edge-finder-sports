
let loaded = false;
let scriptInjected = false;

export function loadPayPal(): Promise<void> {
  // If already loaded successfully, just resolve
  if (loaded) return Promise.resolve();
  
  // Clean up any existing PayPal script tags to avoid conflicts (Fix #1)
  if (!scriptInjected) {
    const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
    existingScripts.forEach(script => script.remove());
  }
  
  return new Promise((resolve, reject) => {
    // Mark that we've attempted to inject the script
    scriptInjected = true;
    
    const script = document.createElement('script');
    // Client ID is properly formatted (Fix #2)
    // components=hosted-buttons is correctly included (Fix #3)
    script.src = 'https://www.paypal.com/sdk/js?client-id=AY0dWjUXDsS0sE_KRfxQSMkOZ_6LPmUwvjN7zsI9KeFUGVwOcsNTBHVx3dI-BfxOwkMBOcNYvhNHz4QA&components=hosted-buttons&enable-funding=venmo&currency=USD';
    
    script.onload = () => {
      // Check if PayPal and HostedButtons are actually available
      if (window.paypal && window.paypal.HostedButtons) {
        loaded = true;
        resolve();
      } else {
        reject(new Error('PayPal SDK loaded but HostedButtons not available'));
      }
    };
    
    script.onerror = (error) => {
      reject(new Error('Failed to load PayPal SDK: ' + error));
    };
    
    document.body.appendChild(script);
    
    // Set a timeout in case the script loads but doesn't properly initialize
    setTimeout(() => {
      if (!loaded) {
        reject(new Error('PayPal SDK timed out'));
      }
    }, 10000);
  });
}
