
let loaded = false;
let scriptInjected = false;

export function loadPayPal(): Promise<void> {
  // If already loaded successfully, just resolve
  if (loaded) return Promise.resolve();
  
  // Clean up any existing PayPal script tags to avoid conflicts
  if (!scriptInjected) {
    const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
    existingScripts.forEach(script => script.remove());
  }
  
  return new Promise((resolve, reject) => {
    // Mark that we've attempted to inject the script
    scriptInjected = true;
    
    const script = document.createElement('script');
    // Use a sandbox client ID for development
    script.src = 'https://www.paypal.com/sdk/js?client-id=sb&components=hosted-buttons&enable-funding=venmo&currency=USD';
    script.async = true;
    
    script.onload = () => {
      console.log("PayPal SDK script loaded successfully");
      
      // Give the SDK a moment to initialize
      setTimeout(() => {
        // Check if PayPal and HostedButtons are actually available
        if (window.paypal && window.paypal.HostedButtons) {
          loaded = true;
          console.log("PayPal HostedButtons component available");
          resolve();
        } else {
          console.error("PayPal SDK loaded but HostedButtons not available");
          reject(new Error('PayPal SDK loaded but HostedButtons component not available'));
        }
      }, 300);
    };
    
    script.onerror = (error) => {
      console.error("PayPal script failed to load:", error);
      // Convert the error event to a more useful message
      const errorMessage = error instanceof Event ? 'Script loading error' : String(error);
      reject(new Error('Failed to load PayPal SDK: ' + errorMessage));
    };
    
    document.body.appendChild(script);
    
    // Set a timeout in case the script loads but doesn't properly initialize
    setTimeout(() => {
      if (!loaded) {
        reject(new Error('PayPal SDK initialization timed out'));
      }
    }, 10000);
  });
}
