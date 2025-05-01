
let loaded = false;
let scriptInjected = false;
let currentScript: HTMLScriptElement | null = null;

export function loadPayPal(): Promise<void> {
  // If already loaded successfully, just resolve
  if (loaded) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    try {
      // Clean up any existing PayPal script tags to avoid conflicts, but do it safely
      if (!scriptInjected) {
        const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
        existingScripts.forEach(script => {
          try {
            const parent = script.parentNode;
            if (parent) parent.removeChild(script);
          } catch (err) {
            console.warn("Error removing existing PayPal script:", err);
          }
        });
      }
      
      // Create a new script element
      const script = document.createElement('script');
      currentScript = script;
      
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
        const errorMessage = error instanceof Event 
          ? 'Script loading error' 
          : String(error);
        reject(new Error('Failed to load PayPal SDK: ' + errorMessage));
      };
      
      // Mark that we've attempted to inject the script
      scriptInjected = true;
      document.body.appendChild(script);
      
      // Set a timeout in case the script loads but doesn't properly initialize
      setTimeout(() => {
        if (!loaded) {
          reject(new Error('PayPal SDK initialization timed out'));
        }
      }, 10000);
    } catch (err) {
      console.error("Unexpected error in loadPayPal:", err);
      reject(new Error(`Unexpected error loading PayPal SDK: ${err}`));
    }
  });
}

// Function to safely clean up PayPal resources
export function cleanupPayPal(): void {
  // Reset state but don't remove the script if it's working
  if (!loaded) {
    if (currentScript && currentScript.parentNode) {
      try {
        currentScript.parentNode.removeChild(currentScript);
        currentScript = null;
        scriptInjected = false;
      } catch (err) {
        console.warn("Error removing PayPal script during cleanup:", err);
      }
    }
  }
}
