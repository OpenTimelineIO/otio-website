import { ArrowLeftRight, Code, Puzzle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: ArrowLeftRight,
    title: "Interchange Format",
    description:
      "Effortlessly exchange timeline data across editing, compositing, and review platforms.",
  },
  {
    icon: Code,
    title: "Developer APIs",
    description:
      "Robust Python and C++ APIs for building pipeline tools and custom integrations.",
  },
  {
    icon: Puzzle,
    title: "Extensible Adapters",
    description:
      "Write custom adapters for any editorial format — flexible, open, and community-driven.",
  },
];

export function FeatureCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
      {features.map((feature) => (
        <Card key={feature.title} className="flex flex-col">
          <CardHeader className="pb-2">
            <feature.icon className="h-8 w-8 mb-2 text-primary" />
            <CardTitle className="text-lg">{feature.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              {feature.description}
            </CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
