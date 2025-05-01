
interface PayPalHostedButtonsOptions {
  hostedButtonId: string;
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
