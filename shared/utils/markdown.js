const MarkdownIt = require('markdown-it');
const TurndownService = require('turndown');

const md = new MarkdownIt({ html: true, breaks: true, linkify: true });
const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

function markdownToHtml(markdown) {
  if (!markdown) return '';
  return md.render(markdown);
}

function htmlToMarkdown(html) {
  if (!html) return '';
  try {
    let markdown = turndownService.turndown(html);
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    return markdown.trim();
  } catch (err) {
    console.error('Error converting HTML to Markdown:', err);
    return html.replace(/<[^>]*>/g, '').trim();
  }
}

module.exports = { markdownToHtml, htmlToMarkdown };
