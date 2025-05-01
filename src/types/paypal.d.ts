
interface PayPalHostedButtonsOptions {
  hostedButtonId: string;
  onInit?: (data: any) => void;
  onError?: (error: any) => void;
}

interface PayPalHostedButtonsRenderer {
  render: (containerId: string) => Promise<void>;
}

interface PayPalHostedButtons {
  (options: PayPalHostedButtonsOptions): PayPalHostedButtonsRenderer;
}

interface PayPalNamespace {
  HostedButtons: PayPalHostedButtons;
}

interface Window {
  paypal?: PayPalNamespace;
}
