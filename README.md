# Entity Extractor

An Obsidian plugin that extracts people and concepts from book highlights using Claude AI, creating interconnected entity notes automatically.

## What it does

Run the command on a book note and the plugin will:

1. Send the highlights to Claude for entity extraction
2. Create notes in `People/` and `Concepts/` folders with structured frontmatter
3. Link entities back to the source book with embedded highlight references
4. Merge into existing entity notes if they already exist (e.g., a person mentioned across multiple books)
5. Append an `## Entities` summary section to the source book note

## Supported formats

| Source | Format | Output |
|--------|--------|--------|
| Kindle Sync plugin (`Sources/Books/`) | `^ref-XXXXX` block IDs | `- summary ![[Book#^ref-XXXXX]]` embeds |
| Readwise Official plugin (`Readwise/Books/`) | `([Location XXX](url))` links, blockquotes, `---` separators | `- summary` text descriptions |

## Setup

1. Copy the plugin folder to `.obsidian/plugins/entity-extractor/`
2. Enable the plugin in Settings → Community Plugins
3. Go to Settings → Entity Extractor and add your [Anthropic API key](https://console.anthropic.com/)
4. Use the "Test connection" button to verify it works

Your API key is encrypted at rest using AES-256-GCM.

## Usage

1. Open a book note with highlights
2. Open the Command Palette (`Ctrl/Cmd + P`)
3. Run **Entity Extractor: Extract entities from current book note**

Use **Extract entities (dry run)** to preview what would be created without writing any files.

## Generated note structure

```markdown
---
type: person
tags:
  - person
aliases:
  - Nickname
---

# Entity Name

## From My Reading

### [[Book Title]]
- Brief description of highlight ![[Book Title#^ref-12345]]

## Connected To
- [[Other Entity]] — relationship description

## Mentioned In
- [[Book Title]]
```

## Models

Configurable in settings:

- **Claude Sonnet 4** — recommended balance of speed and quality
- **Claude Haiku 4.5** — faster and cheaper
- **Claude Opus 4.6** — most capable

## License

MIT
