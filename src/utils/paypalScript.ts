
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
            // Check if the element is still in the DOM and has a parent before removing
            if (script.parentNode && document.body.contains(script)) {
              const parent = script.parentNode;
              parent.removeChild(script);
            }
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
        }, 500); // Increased timeout for slower connections
      };
      
      script.onerror = (error) => {
        console.error("PayPal script failed to load:", error);
        // Better error handling
        let errorMessage = 'Failed to load PayPal SDK';
        if (error instanceof Event) {
          errorMessage += ': Script loading error';
        } else {
          errorMessage += ': ' + String(error);
        }
        reject(new Error(errorMessage));
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
    } catch (err: any) {
      console.error("Unexpected error in loadPayPal:", err);
      reject(new Error(`Unexpected error loading PayPal SDK: ${err.message || String(err)}`));
    }
  });
}

// Function to safely clean up PayPal resources
export function cleanupPayPal(): void {
  // Reset state
  if (!loaded) {
    if (currentScript) {
      try {
        // Check if the script is still in the DOM and has a parent before removing
        if (currentScript.parentNode && document.body.contains(currentScript)) {
          currentScript.parentNode.removeChild(currentScript);
        }
        currentScript = null;
        scriptInjected = false;
      } catch (err) {
        console.warn("Error removing PayPal script during cleanup:", err);
      }
    }
  }
}

// Helper function to safely check if PayPal is loaded
export function isPayPalLoaded(): boolean {
  return loaded && !!window.paypal && !!window.paypal.HostedButtons;
}

// Helper to safely reset container
export function resetPayPalContainer(containerId: string): void {
  const container = document.getElementById(containerId);
  if (container) {
    // Safely clear the container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }
}
