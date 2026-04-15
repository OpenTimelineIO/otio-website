import { unified } from "unified";
import remarkParse from "remark-parse";
import { Root, Content, Heading, Paragraph, Image, Text, List } from "mdast";

/**
 * Element extracted from markdown AST
 */
export interface ParsedElement {
  type: "h1" | "h2" | "h3" | "p" | "img" | "embed" | "ul" | "widget";
  content: string;
  node: Content;
  imageUrl?: string;
  alt?: string;
  embedUrl?: string;
  embedType?: "youtube";
  listItems?: string[];
  widgetName?: string;
}

/**
 * Section grouping header and following content
 */
export interface Section {
  header?: { level: 1 | 2 | 3; text: string; node: Heading };
  elements: ParsedElement[];
  duration: number; // milliseconds
  startTime: number; // milliseconds
}

/**
 * Track item for timeline rendering
 */
export interface TrackItem {
  id: string;
  content: string;
  name: string;
  track: number; // 0 = h1, 1 = h2, 2 = h3, 3 = media (img/embed/widget), 4 = p, 5 = ul
  type: "h1" | "h2" | "h3" | "img" | "p" | "embed" | "ul" | "widget";
  start: number; // milliseconds
  end: number; // milliseconds
  node?: Content; // AST node reference
  imageUrl?: string;
  alt?: string;
  embedUrl?: string;
  embedType?: "youtube";
  listItems?: string[];
  widgetName?: string;
}

// Track mapping: h1=0, h2=1, h3=2, media=3 (img/embed/widget), p=4, ul=5
const TRACK_MAP: Record<string, number> = {
  h1: 0,
  h2: 1,
  h3: 2,
  img: 3,
  embed: 3,
  widget: 3,
  p: 4,
  ul: 5,
};

/**
 * Calculate reading time based on word count
 * Uses 250 words per minute as standard reading speed
 */
function calculateReadingTime(wordCount: number): number {
  const wordsPerMinute = 250;
  const minutes = wordCount / wordsPerMinute;
  return minutes * 60 * 1000; // Convert to milliseconds
}

/**
 * Count words in text content
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Extract text content from AST node recursively
 */
function extractText(node: Content): string {
  if (node.type === "text") {
    return (node as Text).value;
  }
  
  // For nodes with children, recursively extract text
  if ("children" in node && Array.isArray(node.children)) {
    return node.children
      .map((child) => extractText(child as Content))
      .join("");
  }
  
  return "";
}

/**
 * Extract YouTube video ID from various YouTube URL formats
 */
function extractYouTubeVideoId(url: string): string | null {
  // Match various YouTube URL patterns:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Check if a paragraph node contains only a YouTube link
 */
function extractYouTubeEmbed(node: Content): ParsedElement | null {
  if (node.type !== "paragraph") return null;
  
  const paragraph = node as Paragraph;
  // Check if paragraph has a single link child (or link with text)
  if (paragraph.children.length === 1 && paragraph.children[0].type === "link") {
    const link = paragraph.children[0] as any;
    const videoId = extractYouTubeVideoId(link.url);
    if (videoId) {
      const linkText = extractText(link);
      return {
        type: "embed",
        content: linkText || "YouTube Video",
        node,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        embedType: "youtube",
      };
    }
  }
  return null;
}

/**
 * Parse markdown AST node to ParsedElement
 */
function parseNode(node: Content): ParsedElement | null {
  // Detect HTML nodes with data-component attribute (widget markers)
  if (node.type === "html") {
    const htmlNode = node as any;
    const value = (htmlNode.value || "") as string;
    const match = value.match(/data-component="([^"]+)"/);
    if (match) {
      return {
        type: "widget",
        content: match[1],
        node,
        widgetName: match[1],
      };
    }
  }

  if (node.type === "heading") {
    const heading = node as Heading;
    const level = heading.depth;
    if (level >= 1 && level <= 3) {
      const text = extractText(node);
      return {
        type: `h${level}` as "h1" | "h2" | "h3",
        content: text,
        node,
      };
    }
  } else if (node.type === "paragraph") {
    // Check if this paragraph contains a YouTube embed
    const youtubeEmbed = extractYouTubeEmbed(node);
    if (youtubeEmbed) {
      return youtubeEmbed;
    }
    // Otherwise treat as regular paragraph
    const text = extractText(node);
    return {
      type: "p",
      content: text,
      node,
    };
  } else if (node.type === "image") {
    const image = node as Image;
    return {
      type: "img",
      content: image.alt || "",
      node,
      imageUrl: image.url,
      alt: image.alt || "",
    };
  } else if (node.type === "list") {
    const list = node as List;
    // Extract text from each list item
    const listItems = list.children.map((item) => {
      // List items contain paragraphs or other content
      return item.children
        .map((child) => extractText(child as Content))
        .join("")
        .trim();
    });
    const content = listItems.join(" • ");
    return {
      type: "ul",
      content,
      node,
      listItems,
    };
  }
  return null;
}

/**
 * Calculate duration for a section based on its content
 */
function calculateSectionDuration(section: Section): number {
  let totalWords = 0;

  // Count words in header
  if (section.header) {
    totalWords += countWords(section.header.text);
  }

  // Count words in all elements
  for (const element of section.elements) {
    if (element.type === "p") {
      totalWords += countWords(element.content);
    } else if (element.type === "h1" || element.type === "h2" || element.type === "h3") {
      // Headers within sections (subheadings) also contribute
      totalWords += countWords(element.content);
    } else if (element.type === "ul" && element.listItems) {
      // Count words in all list items
      for (const item of element.listItems) {
        totalWords += countWords(item);
      }
    }
    // Images get a minimum duration
  }

  // Minimum duration per section (2 seconds)
  const minDuration = 2000;
  // Calculate reading time
  const readingTime = calculateReadingTime(totalWords);
  // Images add extra time (3 seconds per image)
  const imageTime = section.elements.filter((e) => e.type === "img").length * 3000;
  // Embeds add extra time (10 seconds per embed for video preview)
  const embedTime = section.elements.filter((e) => e.type === "embed").length * 10000;
  // Widgets add 5 seconds each
  const widgetTime = section.elements.filter((e) => e.type === "widget").length * 5000;

  return Math.max(minDuration, readingTime + imageTime + embedTime + widgetTime);
}

/**
 * Strip YAML frontmatter from markdown content
 * Frontmatter is delimited by --- at the start of the file
 */
function stripFrontmatter(markdown: string): string {
  // Check if markdown starts with frontmatter delimiter
  if (!markdown.trimStart().startsWith("---")) {
    return markdown;
  }
  
  // Find the closing delimiter
  const lines = markdown.split("\n");
  let inFrontmatter = false;
  let frontmatterEndIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "---") {
      if (!inFrontmatter) {
        inFrontmatter = true;
      } else {
        // Found closing delimiter
        frontmatterEndIndex = i;
        break;
      }
    }
  }
  
  if (frontmatterEndIndex > 0) {
    // Return markdown without frontmatter
    return lines.slice(frontmatterEndIndex + 1).join("\n");
  }
  
  return markdown;
}

/**
 * Check if a node is an HTML comment separator (<!-- -->)
 */
function isCommentSeparator(node: Content): boolean {
  if (node.type === "html") {
    const htmlNode = node as any;
    const value = htmlNode.value || "";
    // Match HTML comments, including empty ones like <!-- -->
    return /<!--\s*-->/.test(value.trim());
  }
  return false;
}

/**
 * Parse markdown string into sections based on HTML comment separators
 */
export function parseMarkdownToSections(markdown: string): Section[] {
  // Strip frontmatter before parsing
  const cleanMarkdown = stripFrontmatter(markdown);
  
  const processor = unified().use(remarkParse);
  const ast = processor.parse(cleanMarkdown) as Root;

  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (const node of ast.children) {
    // Check if this is a comment separator
    if (isCommentSeparator(node)) {
      // Save current section and start a new one
      if (currentSection && (currentSection.header || currentSection.elements.length > 0)) {
        sections.push(currentSection);
      }
      // Start fresh section
      currentSection = {
        elements: [],
        duration: 0,
        startTime: 0,
      };
      continue;
    }

    // If we don't have a section yet, create one
    if (!currentSection) {
      currentSection = {
        elements: [],
        duration: 0,
        startTime: 0,
      };
    }

    // Parse the node and add to current section
    if (node.type === "heading") {
      const heading = node as Heading;
      const level = heading.depth;
      if (level >= 1 && level <= 3) {
        // Store header in section
        currentSection.header = {
          level: level as 1 | 2 | 3,
          text: extractText(node),
          node: heading,
        };
        // Also add as an element for clip generation
        const parsed = parseNode(node);
        if (parsed) {
          currentSection.elements.push(parsed);
        }
      }
    } else {
      const parsed = parseNode(node);
      if (parsed) {
        currentSection.elements.push(parsed);
      }
    }
  }

  // Don't forget the last section
  if (currentSection && (currentSection.header || currentSection.elements.length > 0)) {
    sections.push(currentSection);
  }

  // Calculate durations and start times
  let cumulativeTime = 0;
  for (const section of sections) {
    section.duration = calculateSectionDuration(section);
    section.startTime = cumulativeTime;
    cumulativeTime += section.duration;
  }

  return sections;
}

/**
 * Generate track items from sections
 * All clips in a section have the same start/end times (stacked horizontally)
 */
export function generateClipsFromSections(sections: Section[]): TrackItem[] {
  const clips: TrackItem[] = [];
  let clipId = 0;

  for (const section of sections) {
    // All clips in this section share the same time range
    const sectionStart = section.startTime;
    const sectionEnd = section.startTime + section.duration;

    // Add header clip if present
    if (section.header) {
      const track = TRACK_MAP[`h${section.header.level}`];
      clips.push({
        id: `clip-${clipId++}`,
        content: section.header.text,
        name: section.header.text.substring(0, 30) + (section.header.text.length > 30 ? "..." : ""),
        track,
        type: `h${section.header.level}` as "h1" | "h2" | "h3",
        start: sectionStart,
        end: sectionEnd,
        node: section.header.node,
      });
    }

    // Add element clips (skip headers since we already added them above)
    for (const element of section.elements) {
      // Skip if this element is a header that we already processed
      if (section.header && element.type === `h${section.header.level}` && element.content === section.header.text) {
        continue;
      }

      const track = TRACK_MAP[element.type];
      if (track !== undefined) {
        clips.push({
          id: `clip-${clipId++}`,
          content: element.content,
          name:
            element.type === "img"
              ? element.alt || "Image"
              : element.type === "embed"
              ? element.content || "Embed"
              : element.type === "widget"
              ? element.widgetName || "Widget"
              : element.type === "ul"
              ? `List (${element.listItems?.length || 0} items)`
              : element.content.substring(0, 30) + (element.content.length > 30 ? "..." : ""),
          track,
          type: element.type,
          start: sectionStart, // Same start time for all clips in section
          end: sectionEnd, // Same end time for all clips in section
          node: element.node,
          imageUrl: element.imageUrl,
          alt: element.alt,
          embedUrl: element.embedUrl,
          embedType: element.embedType,
          listItems: element.listItems,
          widgetName: element.widgetName,
        });
      }
    }
  }

  return clips;
}

/**
 * Main function to parse markdown and generate clips
 */
export function parseMarkdownToClips(markdown: string): {
  clips: TrackItem[];
  totalDuration: number;
  sections: Section[];
} {
  const sections = parseMarkdownToSections(markdown);
  const clips = generateClipsFromSections(sections);
  const totalDuration =
    sections.length > 0
      ? sections[sections.length - 1].startTime + sections[sections.length - 1].duration
      : 0;

  return {
    clips,
    totalDuration,
    sections,
  };
}

