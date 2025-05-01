
let loaded = false;
let scriptInjected = false;

// Client ID from user-provided PayPal credentials
const CLIENT_ID = "BAAatRVr-J8kMeDiDC_MUjCVoKzFSP6EXRRMnDDZ81KyGnPs2tEXwM0lXqp28xxEj4Vcrx79R3fPbM_Tms";

export function loadPayPal(): Promise<void> {
  // If already loaded successfully, just resolve
  if (loaded && window.paypal && window.paypal.HostedButtons) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    try {
      // If script is already in the process of loading, don't add another
      if (scriptInjected) {
        // Check if we can find the script on the page
        const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
        if (existingScript) {
          // Wait for the existing script to load
          const checkPayPal = setInterval(() => {
            if (window.paypal && window.paypal.HostedButtons) {
              clearInterval(checkPayPal);
              loaded = true;
              resolve();
            }
          }, 100);
          
          // Set a timeout to prevent infinite checking
          setTimeout(() => {
            clearInterval(checkPayPal);
            reject(new Error('PayPal SDK initialization timed out'));
          }, 10000);
          
          return;
        }
      }
      
      // Add PayPal script to head as recommended by PayPal
      const script = document.createElement('script');
      // Explicitly disable Venmo to prevent errors
      script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&components=hosted-buttons&currency=USD&disable-funding=venmo`;
      script.async = true;
      
      script.onload = () => {
        console.log("PayPal SDK script loaded successfully");
        
        // Give the SDK a moment to initialize
        setTimeout(() => {
          if (window.paypal && window.paypal.HostedButtons) {
            loaded = true;
            console.log("PayPal HostedButtons component available");
            resolve();
          } else {
            console.error("PayPal SDK loaded but HostedButtons not available");
            reject(new Error('PayPal SDK loaded but HostedButtons component not available'));
          }
        }, 500);
      };
      
      script.onerror = (error) => {
        console.error("PayPal script failed to load:", error);
        reject(new Error(`Failed to load PayPal SDK: ${error instanceof Event ? "[Error loading script]" : String(error)}`));
      };
      
      // Mark that we've attempted to inject the script
      scriptInjected = true;
      document.head.appendChild(script);
      
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

// Check if PayPal is loaded
export function isPayPalLoaded(): boolean {
  return loaded && !!window.paypal && !!window.paypal.HostedButtons;
}

// Safely render PayPal button to container with better error handling
export function renderPayPalButton(containerId: string, buttonId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isPayPalLoaded()) {
      const error = new Error("PayPal not loaded, cannot render button");
      console.error(error);
      reject(error);
      return;
    }
    
    try {
      // Make sure the container exists before trying to render
      const container = document.getElementById(containerId);
      if (!container) {
        const error = new Error(`PayPal container #${containerId} not found`);
        console.error(error);
        reject(error);
        return;
      }
      
      // Clear the container first
      container.innerHTML = '';
      
      // Render the button with the correct button ID and styling
      window.paypal.HostedButtons({
        hostedButtonId: buttonId,
        onInit: function(data: any) {
          // Add custom styling for PayPal buttons after they render
          setTimeout(() => {
            const styles = document.createElement('style');
            styles.innerHTML = `
              /* Style the PayPal button container */
              .paypal-button-container {
                max-width: 300px !important;
                margin: 0 auto !important;
                width: 100% !important;
              }
              
              /* Style the PayPal button itself */
              .paypal-button {
                max-width: 300px !important;
                margin: 0 auto !important;
                width: 100% !important;
              }
            `;
            document.head.appendChild(styles);
            resolve();
          }, 100);
        },
        onError: function(err: any) {
          console.error("PayPal button render error:", err);
          reject(new Error(`PayPal button render error: ${err.message || String(err)}`));
          
          // Show error message in the container
          const container = document.getElementById(containerId);
          if (container) {
            container.innerHTML = `
              <div class="p-4 text-center">
                <div class="text-red-500 mb-2">Failed to load PayPal checkout</div>
                <div class="text-sm text-muted-foreground">Please try again later or contact support</div>
              </div>
            `;
          }
        }
      }).render(`#${containerId}`).catch((err: any) => {
        console.error("PayPal render error:", err);
        reject(new Error(`PayPal render error: ${err.message || String(err)}`));
        
        // Show error message in the container
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = `
            <div class="p-4 text-center">
              <div class="text-red-500 mb-2">Failed to load PayPal checkout</div>
              <div class="text-sm text-muted-foreground">Please try again later or contact support</div>
            </div>
          `;
        }
      });
    } catch (err: any) {
      console.error("Error rendering PayPal button:", err);
      reject(new Error(`Error rendering PayPal button: ${err.message || String(err)}`));
      
      // Show error message in the container
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = `
          <div class="p-4 text-center">
            <div class="text-red-500 mb-2">Failed to load PayPal checkout</div>
            <div class="text-sm text-muted-foreground">Please try again later or contact support</div>
          </div>
        `;
      }
    }
  });
}
