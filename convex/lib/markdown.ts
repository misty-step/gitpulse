import { marked } from "marked";

/**
 * Convert markdown string to HTML suitable for rendering inside the dashboard.
 *
 * Uses `marked` with conservative options and no document wrapper—React page
 * already wraps content in a styled container.
 */
export function markdownToHtml(markdown: string): string {
  const parsed = marked.parse(markdown);

  if (typeof parsed !== "string") {
    throw new Error("Markdown parsing returned a Promise unexpectedly");
  }

  return parsed;
}
