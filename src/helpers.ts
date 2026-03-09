export type SourceType = 'book' | 'paper' | 'article' | 'podcast' | 'video' | 'tweet' | 'unknown';

export interface SourceInfo {
    title: string;
    sourceType: SourceType;
    refs: Set<string>;
    hasHighlights: boolean;
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

export function detectSourceType(content: string, filePath?: string): SourceType {
    // 1. Check Category tag in Metadata section
    const categoryMatch = content.match(/^-\s*Category:\s*#(\w+)/m);
    if (categoryMatch) {
        const cat = categoryMatch[1].toLowerCase();
        if (cat === 'books') return 'book';
        if (cat === 'articles') return 'article';
        if (cat === 'podcasts') return 'podcast';
        if (cat === 'tweets') return 'tweet';
        if (cat === 'papers') return 'paper';
        if (cat === 'videos') return 'video';
    }

    // 2. Check for kindle-sync YAML frontmatter
    if (/^kindle-sync:/m.test(content)) return 'book';

    // 3. Check for DOI (strong paper signal)
    if (/^-\s*DOI:/m.test(content)) return 'paper';

    // 4. Fall back to file path
    if (filePath) {
        const p = filePath.toLowerCase();
        if (p.includes('papers/')) return 'paper';
        if (p.includes('podcasts/')) return 'podcast';
        if (p.includes('videos/')) return 'video';
        if (p.includes('articles/')) return 'article';
        if (p.includes('tweets/')) return 'tweet';
        if (p.includes('books/')) return 'book';
    }

    return 'unknown';
}

export function parseSourceNote(content: string, filePath?: string): SourceInfo {
    const titleMatch = content.match(/^# (.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    const sourceType = detectSourceType(content, filePath);

    // Collect ^ref-XXXXX block IDs (Kindle Sync)
    const refs = new Set<string>();
    const re = /\^(ref-\d+)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        refs.add(m[1]);
    }

    // Detect any highlights
    let hasHighlights = refs.size > 0;
    if (!hasHighlights) {
        hasHighlights =
            /\(\[Location\s+\d+\]\(/.test(content) ||
            /\(\[View Highlight\]\(/.test(content) ||
            /\(\[View Tweet\]\(/.test(content) ||
            /^>\s+.{10,}/m.test(content) ||
            /\n---\n/.test(content);
    }

    return { title, sourceType, refs, hasHighlights };
}

/** @deprecated Use parseSourceNote instead */
export function parseBookNote(content: string) {
    const info = parseSourceNote(content);
    return {
        title: info.title,
        refs: info.refs,
        hasReadwiseHighlights: info.hasHighlights && info.refs.size === 0,
    };
}

export function formatReadingSection(
    sourceTitle: string,
    highlights: Highlight[] | undefined,
    sourceType?: SourceType,
): string {
    const typeAnnotation = sourceType ? ' (' + sourceType + ')' : '';
    if (!highlights || highlights.length === 0) {
        return '### [[' + sourceTitle + ']]' + typeAnnotation + '\n- Mentioned in text\n';
    }
    const lines = highlights.map((h) => {
        if (h.ref) {
            return '- ' + h.summary + ' ![[' + sourceTitle + '#^' + h.ref + ']]';
        }
        return '- ' + h.summary;
    });
    return '### [[' + sourceTitle + ']]' + typeAnnotation + '\n' + lines.join('\n') + '\n';
}

export function buildEntityNote(
    type: string,
    entity: Entity,
    sourceTitle: string,
    sourceType: SourceType = 'book',
): string {
    let aliasYaml = '';
    if (entity.aliases && entity.aliases.length > 0) {
        aliasYaml =
            'aliases:\n' +
            entity.aliases.map((a) => '  - ' + a).join('\n') +
            '\n';
    }

    const readingSection = formatReadingSection(sourceTitle, entity.highlights, sourceType);

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
        'source-types:\n' +
        '  - ' + sourceType + '\n' +
        '---\n' +
        '\n' +
        '# ' + entity.name + '\n' +
        '\n' +
        '## Sources\n' +
        '\n' +
        readingSection +
        '\n' +
        connections +
        '\n' +
        '## Mentioned In\n' +
        '- [[' + sourceTitle + ']] (' + sourceType + ')\n'
    );
}
