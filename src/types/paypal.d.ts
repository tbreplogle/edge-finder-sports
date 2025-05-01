
interface PayPalHostedButtonsOptions {
  hostedButtonId: string;
  onInit?: (data: any) => void;
}

interface PayPalHostedButtons {
  (options: PayPalHostedButtonsOptions): {
    render: (containerId: string) => void;
  };
}

interface PayPalNamespace {
  HostedButtons: PayPalHostedButtons;
}

interface Window {
  paypal?: PayPalNamespace;
}
