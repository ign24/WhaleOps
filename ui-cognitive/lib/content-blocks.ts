import type { ContentBlock } from "@/types/chat";

/**
 * Extract text from content that may be a string or ContentBlock array.
 */
export const extractTextFromContent = (content: string | ContentBlock[]): string => {
  if (typeof content === "string") {
    return content;
  }

  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join(" ");
};

/**
 * Build a multimodal content array from text and image data URI.
 */
export const buildVisionContent = (text: string, imageDataUri: string): ContentBlock[] => {
  const blocks: ContentBlock[] = [];

  if (text) {
    blocks.push({ type: "text", text });
  }

  blocks.push({ type: "image_url", image_url: { url: imageDataUri } });

  return blocks;
};
