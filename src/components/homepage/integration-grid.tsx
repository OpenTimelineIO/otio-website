import Image from "next/image";
import Link from "next/link";
import { Integration } from "@/types/integrations";

interface IntegrationGridProps {
  integrations: Integration[];
}

export function IntegrationGrid({ integrations }: IntegrationGridProps) {
  return (
    <div className="my-6">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6">
        {integrations.map((integration) => (
          <div
            key={integration.id ?? integration.name}
            className="flex flex-col items-center gap-2"
          >
            <div className="relative w-12 h-12">
              <Image
                src={integration.logo}
                alt={integration.name}
                fill
                className="object-contain"
              />
            </div>
            <span className="text-xs text-center text-muted-foreground leading-tight">
              {integration.name}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Link
          href="/apps-and-tools"
          className="text-primary text-sm font-medium hover:underline"
        >
          View All Apps & Tools &rarr;
        </Link>
      </div>
    </div>
  );
}
