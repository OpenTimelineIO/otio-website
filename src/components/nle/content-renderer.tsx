import { useState, useMemo, memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/nle/utils/markdown-parser";
import { Integration } from "@/types/integrations";
import { FeatureCards } from "@/components/homepage/feature-cards";
import { IntegrationGrid } from "@/components/homepage/integration-grid";
import { CommunityCta } from "@/components/homepage/community-cta";

interface ContentRendererProps {
  markdown: string;
  onAstUpdate?: (ast: any) => void;
  sections?: Section[];
  currentTimeMs?: number;
  syncWithPlayhead?: boolean;
  integrations?: Integration[];
}

// Memoize ContentRenderer to prevent unnecessary re-renders
export const ContentRenderer = memo(function ContentRenderer({
  markdown,
  onAstUpdate,
  sections = [],
  currentTimeMs = 0,
  syncWithPlayhead = false,
  integrations = [],
}: ContentRendererProps) {
  const [ast, setAst] = useState<any>(null);

  // Calculate opacity for each section based on playhead position
  // Optimize: Only recalculate when currentTimeMs changes significantly (rounded to 10ms)
  const roundedTimeMs = useMemo(() => Math.round(currentTimeMs / 10) * 10, [currentTimeMs]);
  
  const sectionOpacities = useMemo(() => {
    if (!syncWithPlayhead || sections.length === 0) {
      return {};
    }

    const opacities: Record<number, number> = {};
    const fadeDuration = 500; // 500ms fade transition

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionStart = section.startTime;
      const sectionEnd = section.startTime + section.duration;

      if (roundedTimeMs < sectionStart - fadeDuration) {
        // Before section - fully transparent
        opacities[i] = 0;
      } else if (roundedTimeMs >= sectionStart - fadeDuration && roundedTimeMs < sectionStart) {
        // Fading in
        const fadeProgress = (roundedTimeMs - (sectionStart - fadeDuration)) / fadeDuration;
        opacities[i] = fadeProgress;
      } else if (roundedTimeMs >= sectionStart && roundedTimeMs <= sectionEnd) {
        // Active section - fully visible
        opacities[i] = 1;
      } else if (roundedTimeMs > sectionEnd && roundedTimeMs <= sectionEnd + fadeDuration) {
        // Fading out
        const fadeProgress = 1 - (roundedTimeMs - sectionEnd) / fadeDuration;
        opacities[i] = Math.max(0, fadeProgress);
      } else {
        // After section - fully transparent
        opacities[i] = 0;
      }
    }

    return opacities;
  }, [sections, roundedTimeMs, syncWithPlayhead]);

  // Strip frontmatter and filter out HTML comment separators from markdown
  const cleanMarkdownContent = (md: string) => {
    let content = md;
    
    // Strip YAML frontmatter if present
    if (content.trimStart().startsWith("---")) {
      const lines = content.split("\n");
      let inFrontmatter = false;
      let frontmatterEndIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === "---") {
          if (!inFrontmatter) {
            inFrontmatter = true;
          } else {
            frontmatterEndIndex = i;
            break;
          }
        }
      }
      
      if (frontmatterEndIndex > 0) {
        content = lines.slice(frontmatterEndIndex + 1).join("\n");
      }
    }
    
    // Filter out HTML comment separators
    return content
      .split('\n')
      .filter(line => !line.trim().match(/^<!--\s*-->$/))
      .join('\n');
  };

  // If sync is enabled and we have sections, render sections with opacity
  if (syncWithPlayhead && sections.length > 0) {
    return (
      <div className="contentRenderer">
        {sections.map((section, index) => {
          const opacity = sectionOpacities[index] ?? 1;
          const isVisible = opacity > 0;

          return (
            <div
              key={index}
              data-section-index={index}
              data-section-start={section.startTime}
              data-section-end={section.startTime + section.duration}
              style={{
                opacity,
                transition: syncWithPlayhead ? "opacity 0.3s ease-in-out" : "none",
                display: syncWithPlayhead && !isVisible ? "none" : "block",
              }}
              className="section-content"
            >
              {section.header && (
                <ReactMarkdown
                  components={{
                    h1: ({ ...props }) => (
                      <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />
                    ),
                    h2: ({ ...props }) => (
                      <h2 className="text-2xl font-semibold mt-6 mb-3" {...props} />
                    ),
                    h3: ({ ...props }) => (
                      <h3 className="text-xl font-semibold mt-5 mb-2" {...props} />
                    ),
                  }}
                >
                  {`${"#".repeat(section.header.level)} ${section.header.text}`}
                </ReactMarkdown>
              )}
              {section.elements.map((element, elemIndex) => {
                if (element.type === "p") {
                  return (
                    <ReactMarkdown key={elemIndex} components={{ p: ({ ...props }) => <p className="mb-4" {...props} /> }}>
                      {element.content}
                    </ReactMarkdown>
                  );
                } else if (element.type === "img" && element.imageUrl) {
                  return (
                    <img
                      key={elemIndex}
                      src={element.imageUrl}
                      alt={element.alt || ""}
                      className="my-4 max-w-full"
                    />
                  );
                } else if (element.type === "embed" && element.embedUrl) {
                  return (
                    <div key={elemIndex} className="my-4 aspect-video max-w-2xl">
                      <iframe
                        src={element.embedUrl}
                        title={element.content || "Embedded video"}
                        className="w-full h-full rounded-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                } else if (element.type === "ul" && element.listItems) {
                  return (
                    <ul key={elemIndex} className="list-disc pl-5 mb-4">
                      {element.listItems.map((item, itemIndex) => (
                        <ReactMarkdown
                          key={itemIndex}
                          components={{
                            p: ({ children }) => <li className="mb-2">{children}</li>,
                          }}
                        >
                          {item}
                        </ReactMarkdown>
                      ))}
                    </ul>
                  );
                } else if (element.type === "widget" && element.widgetName) {
                  if (element.widgetName === "feature-cards") return <FeatureCards key={elemIndex} />;
                  if (element.widgetName === "integration-grid") return <IntegrationGrid key={elemIndex} integrations={integrations} />;
                  if (element.widgetName === "community-cta") return <CommunityCta key={elemIndex} />;
                  return null;
                } else if (element.type.startsWith("h")) {
                  const level = parseInt(element.type[1]);
                  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
                  return (
                    <ReactMarkdown
                      key={elemIndex}
                      components={{
                        [HeadingTag]: ({ ...props }) => {
                          const className =
                            level === 1
                              ? "text-3xl font-bold mt-8 mb-4"
                              : level === 2
                              ? "text-2xl font-semibold mt-6 mb-3"
                              : "text-xl font-semibold mt-5 mb-2";
                          return <HeadingTag className={className} {...props} />;
                        },
                      }}
                    >
                      {`${"#".repeat(level)} ${element.content}`}
                    </ReactMarkdown>
                  );
                }
                return null;
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // Helper to extract YouTube video ID
  const extractYouTubeVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  // Default rendering without sync - clean markdown content
  const cleanMarkdown = cleanMarkdownContent(markdown);
  
  return (
    <div className="contentRenderer">
      <ReactMarkdown
        components={{
          h1: ({ ...props }) => (
            <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="text-2xl font-semibold mt-6 mb-3" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="text-xl font-semibold mt-5 mb-2" {...props} />
          ),
          h4: ({ ...props }) => (
            <h4 className="text-lg font-semibold mt-4 mb-2" {...props} />
          ),
          p: ({ node, children, ...props }) => {
            // Check if paragraph contains only a YouTube link using the rehype AST node
            if (node && node.children && node.children.length === 1) {
              const child = node.children[0] as any;
              // In rehype AST, links have tagName: 'a' and properties.href
              if (child.tagName === 'a' && child.properties?.href) {
                const videoId = extractYouTubeVideoId(child.properties.href);
                if (videoId) {
                  // Extract link text for title
                  const linkText = child.children?.[0]?.value || "YouTube Video";
                  return (
                    <div className="my-4 aspect-video max-w-2xl">
                      <iframe
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title={linkText}
                        className="w-full h-full rounded-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                }
              }
            }
            return <p className="mb-4" {...props}>{children}</p>;
          },
          ul: ({ ...props }) => (
            <ul className="list-disc pl-5 mb-4" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="list-decimal pl-5 mb-4" {...props} />
          ),
          section: ({ ...props }) => (
            <section className="my-12" {...props} />
          ),
          li: ({ ...props }) => <li className="mb-2" {...props} />,
          a: ({ href, children, ...props }) => {
            // Regular link - YouTube links are handled at the paragraph level
            return <a href={href} className="text-primary underline hover:no-underline" {...props}>{children}</a>;
          },
          div: ({ node, ...props }: any) => {
            const component = props["data-component"];
            if (component === "feature-cards") return <FeatureCards />;
            if (component === "integration-grid") return <IntegrationGrid integrations={integrations} />;
            if (component === "community-cta") return <CommunityCta />;
            return <div {...props} />;
          },
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            return match ? (
              <Card className="my-4">
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0 }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </Card>
            ) : (
              <code className="bg-gray-100 rounded px-1" {...props}>
                {children}
              </code>
            );
          },
        }}
        remarkPlugins={[]}
        rehypePlugins={[rehypeRaw]}
      >
        {cleanMarkdown}
      </ReactMarkdown>
    </div>
  );
});
