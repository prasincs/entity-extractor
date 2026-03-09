export interface ParsedBookNote {
    title: string;
    refs: Set<string>;
    hasReadwiseHighlights: boolean;
}

export interface Highlight {
    ref?: string;
    quote?: string;
    summary: string;
}

export interface Connection {
    entity: string;
    relationship: string;
}

export interface Entity {
    name: string;
    aliases?: string[];
    major?: boolean;
    highlights?: Highlight[];
    connections?: Connection[];
}

export function sanitizeFilename(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '-');
}

export function parseBookNote(content: string): ParsedBookNote {
    const titleMatch = content.match(/^# (.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
    const refs = new Set<string>();
    const re = /\^(ref-\d+)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        refs.add(m[1]);
    }

    // Detect Readwise-style highlights: paragraphs separated by --- with ([Location ...]) links,
    // or plain blockquote lines (> ...)
    let hasReadwiseHighlights = false;
    if (refs.size === 0) {
        hasReadwiseHighlights =
            /\(\[Location\s+\d+\]\(/.test(content) ||
            /^>\s+.{10,}/m.test(content) ||
            /\n---\n/.test(content);
    }

    return { title, refs, hasReadwiseHighlights };
}

export function formatReadingSection(
    bookTitle: string,
    highlights: Highlight[] | undefined,
): string {
    if (!highlights || highlights.length === 0) {
        return '### [[' + bookTitle + ']]\n- Mentioned in text\n';
    }
    const lines = highlights.map((h) => {
        if (h.ref) {
            return '- ' + h.summary + ' ![[' + bookTitle + '#^' + h.ref + ']]';
        }
        return '- ' + h.summary;
    });
    return '### [[' + bookTitle + ']]\n' + lines.join('\n') + '\n';
}

export function buildEntityNote(
    type: string,
    entity: Entity,
    bookTitle: string,
): string {
    let aliasYaml = '';
    if (entity.aliases && entity.aliases.length > 0) {
        aliasYaml =
            'aliases:\n' +
            entity.aliases.map((a) => '  - ' + a).join('\n') +
            '\n';
    }

    const readingSection = formatReadingSection(bookTitle, entity.highlights);

    let connections = '';
    if (entity.connections && entity.connections.length > 0) {
        const lines = entity.connections.map(
            (c) => '- [[' + c.entity + ']] \u2014 ' + c.relationship,
        );
        connections = '## Connected To\n' + lines.join('\n') + '\n';
    }

    return (
        '---\n' +
        'type: ' + type + '\n' +
        'tags:\n' +
        '  - ' + type + '\n' +
        aliasYaml +
        '---\n' +
        '\n' +
        '# ' + entity.name + '\n' +
        '\n' +
        '## From My Reading\n' +
        '\n' +
        readingSection +
        '\n' +
        connections +
        '\n' +
        '## Mentioned In\n' +
        '- [[' + bookTitle + ']]\n'
    );
}
