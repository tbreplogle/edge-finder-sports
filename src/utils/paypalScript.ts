
let loaded = false;

export function loadPayPal(): Promise<void> {
  if (loaded) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.paypal.com/sdk/js?client-id=AY0dWjUXDsS0sE_KRfxQSMkOZ_6LPmUwvjN7zsI9KeFUGVwOcsNTBHVx3dI-BfxOwkMBOcNYvhNHz4QA&components=hosted-buttons&enable-funding=venmo&currency=USD';
    script.onload = () => {
      loaded = true;
      resolve();
    };
    script.onerror = (error) => {
      reject(new Error('Failed to load PayPal SDK: ' + error));
    };
    document.body.appendChild(script);
  });
}
