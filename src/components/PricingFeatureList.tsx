
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingFeatureListProps {
  features: PricingFeature[];
}

export function PricingFeatureList({ features }: PricingFeatureListProps) {
  return (
    <ul className="space-y-2 text-sm">
      {features.map((feature, index) => (
        <li key={index} className="flex items-start">
          <CheckIcon 
            className={cn(
              "h-4 w-4 mr-2 mt-0.5",
              feature.included ? "text-edge-secondary" : "text-muted-foreground/50"
            )} 
          />
          <span 
            className={cn(
              !feature.included && "text-muted-foreground/70 line-through"
            )}
          >
            {feature.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
