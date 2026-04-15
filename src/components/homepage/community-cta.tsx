import { Github, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const links = [
  {
    icon: Github,
    label: "GitHub",
    href: "https://github.com/AcademySoftwareFoundation/OpenTimelineIO",
  },
  {
    icon: ExternalLink,
    label: "ASWF Project",
    href: "https://www.aswf.io/projects/opentimelineio/",
  },
  {
    icon: Users,
    label: "Contributing",
    href: "https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/CONTRIBUTING.md",
  },
];

export function CommunityCta() {
  return (
    <div className="flex flex-wrap gap-3 my-6">
      {links.map((link) => (
        <Button key={link.label} variant="outline" asChild>
          <a href={link.href} target="_blank" rel="noopener noreferrer">
            <link.icon className="h-4 w-4" />
            {link.label}
          </a>
        </Button>
      ))}
    </div>
  );
}
