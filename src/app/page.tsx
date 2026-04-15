import type { Metadata } from "next";
import { EditorialInterfaceComponent } from "@/components/nle/index";
import { NavWidthSetter } from "@/components/layout/nav-width-setter";
import { getSiteUrl } from "@/lib/site-config";
import { getIntegrations } from "@/lib/integrations";
import { promises as fs } from "fs";
import path from "path";

async function getMarkdownContent() {
  const filePath = path.join(process.cwd(), "content", "homepage", "timelines", "introduction.md");
  const markdown = await fs.readFile(filePath, "utf8");
  return markdown;
}

export const metadata: Metadata = {
  title: "Interactive Timeline Editor | OpenTimelineIO",
  description: "Explore OpenTimelineIO's powerful editorial timeline features. Build, edit, and manage timelines with our interactive interface.",
  openGraph: {
    title: "Interactive Timeline Editor | OpenTimelineIO",
    description: "Explore OpenTimelineIO's powerful editorial timeline features with our interactive editor.",
    type: "website",
    url: getSiteUrl(),
    siteName: "OpenTimelineIO",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interactive Timeline Editor | OpenTimelineIO",
    description: "Explore OpenTimelineIO's powerful editorial timeline features.",
  },
};

export default async function NonLinearEditor() {
  const markdown = await getMarkdownContent();
  const integrations = getIntegrations().filter((i) => i.logo);

  return (
    <NavWidthSetter width="full">
      <EditorialInterfaceComponent markdown={markdown} integrations={integrations} />
    </NavWidthSetter>
  );
}
