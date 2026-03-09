import { describe, expect, test } from 'bun:test';
import {
    sanitizeFilename,
    detectSourceType,
    parseSourceNote,
    parseBookNote,
    formatReadingSection,
    buildEntityNote,
} from '../src/helpers';

describe('sanitizeFilename', () => {
    test('replaces forbidden characters with dashes', () => {
        expect(sanitizeFilename('a\\b/c:d*e?f"g<h>i|j')).toBe(
            'a-b-c-d-e-f-g-h-i-j',
        );
    });

    test('leaves normal characters untouched', () => {
        expect(sanitizeFilename('Hello World 123')).toBe('Hello World 123');
    });

    test('handles empty string', () => {
        expect(sanitizeFilename('')).toBe('');
    });

    test('handles consecutive forbidden characters', () => {
        expect(sanitizeFilename('a:/b')).toBe('a--b');
    });
});

describe('detectSourceType', () => {
    test('detects #books category', () => {
        expect(detectSourceType('## Metadata\n- Category: #books\n')).toBe('book');
    });

    test('detects #articles category', () => {
        expect(detectSourceType('## Metadata\n- Category: #articles\n')).toBe('article');
    });

    test('detects #podcasts category', () => {
        expect(detectSourceType('## Metadata\n- Category: #podcasts\n')).toBe('podcast');
    });

    test('detects #tweets category', () => {
        expect(detectSourceType('## Metadata\n- Category: #tweets\n')).toBe('tweet');
    });

    test('detects #papers category', () => {
        expect(detectSourceType('## Metadata\n- Category: #papers\n')).toBe('paper');
    });

    test('detects #videos category', () => {
        expect(detectSourceType('## Metadata\n- Category: #videos\n')).toBe('video');
    });

    test('detects kindle-sync frontmatter', () => {
        expect(detectSourceType('---\nkindle-sync:\n  bookId: 123\n---\n')).toBe('book');
    });

    test('detects DOI as paper', () => {
        expect(detectSourceType('## Metadata\n- DOI: 10.1234/test\n')).toBe('paper');
    });

    test('falls back to file path — Papers/', () => {
        expect(detectSourceType('# Title\nSome content', 'Papers/my-paper.md')).toBe('paper');
    });

    test('falls back to file path — Readwise/Articles/', () => {
        expect(detectSourceType('# Title\nContent', 'Readwise/Articles/article.md')).toBe('article');
    });

    test('falls back to file path — Sources/Books/', () => {
        expect(detectSourceType('# Title\nContent', 'Sources/Books/book.md')).toBe('book');
    });

    test('returns unknown for unrecognized content', () => {
        expect(detectSourceType('# Just a note\nSome text')).toBe('unknown');
    });

    test('category tag takes priority over file path', () => {
        expect(detectSourceType('- Category: #podcasts\n', 'Readwise/Articles/podcast.md')).toBe('podcast');
    });
});

describe('parseSourceNote', () => {
    test('extracts title from # heading', () => {
        const result = parseSourceNote('# My Book Title\n\nSome content');
        expect(result.title).toBe('My Book Title');
    });

    test('returns Untitled when no heading', () => {
        const result = parseSourceNote('Just some text without a heading');
        expect(result.title).toBe('Untitled');
    });

    test('detects source type from content', () => {
        const content = '# Article\n## Metadata\n- Category: #articles\n## Highlights\n- text ([View Highlight](url))';
        const result = parseSourceNote(content);
        expect(result.sourceType).toBe('article');
    });

    test('detects source type from file path', () => {
        const result = parseSourceNote('# Paper\nContent', 'Papers/my-paper.md');
        expect(result.sourceType).toBe('paper');
    });

    test('collects ^ref- block IDs', () => {
        const content = '# Book\n\nHighlight one ^ref-12345\n\nHighlight two ^ref-67890';
        const result = parseSourceNote(content);
        expect(result.refs.size).toBe(2);
        expect(result.refs.has('ref-12345')).toBe(true);
    });

    test('hasHighlights true for refs', () => {
        const content = '# Book\n\nText ^ref-12345';
        const result = parseSourceNote(content);
        expect(result.hasHighlights).toBe(true);
    });

    test('hasHighlights true for View Highlight links', () => {
        const content = '# Article\n- text ([View Highlight](url))';
        const result = parseSourceNote(content);
        expect(result.hasHighlights).toBe(true);
    });

    test('hasHighlights true for Location links', () => {
        const content = '# Book\n- text ([Location 123](url))';
        const result = parseSourceNote(content);
        expect(result.hasHighlights).toBe(true);
    });

    test('hasHighlights false for plain text', () => {
        const result = parseSourceNote('# Note\n\nJust plain text');
        expect(result.hasHighlights).toBe(false);
    });
});

describe('parseBookNote (deprecated wrapper)', () => {
    test('still works for backward compatibility', () => {
        const content = '# Book\n\nHighlight ^ref-123\nMore text';
        const result = parseBookNote(content);
        expect(result.title).toBe('Book');
        expect(result.refs.has('ref-123')).toBe(true);
        expect(result.hasReadwiseHighlights).toBe(false);
    });

    test('detects readwise highlights when no refs', () => {
        const content = '# Book\n- text ([Location 123](url))';
        const result = parseBookNote(content);
        expect(result.hasReadwiseHighlights).toBe(true);
    });
});

describe('formatReadingSection', () => {
    test('formats highlights with ref as embedded links', () => {
        const result = formatReadingSection('My Book', [
            { ref: 'ref-123', summary: 'Key insight about X' },
        ]);
        expect(result).toBe(
            '### [[My Book]]\n- Key insight about X ![[My Book#^ref-123]]\n',
        );
    });

    test('formats highlights without ref as plain summary', () => {
        const result = formatReadingSection('My Book', [
            { summary: 'Key insight about X' },
        ]);
        expect(result).toBe('### [[My Book]]\n- Key insight about X\n');
    });

    test('includes source type annotation', () => {
        const result = formatReadingSection('Article Title', [
            { summary: 'Key insight' },
        ], 'article');
        expect(result).toBe('### [[Article Title]] (article)\n- Key insight\n');
    });

    test('includes source type on stub', () => {
        const result = formatReadingSection('Podcast Ep', [], 'podcast');
        expect(result).toBe('### [[Podcast Ep]] (podcast)\n- Mentioned in text\n');
    });

    test('no annotation when source type omitted', () => {
        const result = formatReadingSection('My Book', [{ summary: 'text' }]);
        expect(result).toBe('### [[My Book]]\n- text\n');
    });

    test('returns stub when highlights is empty', () => {
        const result = formatReadingSection('My Book', []);
        expect(result).toBe('### [[My Book]]\n- Mentioned in text\n');
    });

    test('returns stub when highlights is undefined', () => {
        const result = formatReadingSection('My Book', undefined);
        expect(result).toBe('### [[My Book]]\n- Mentioned in text\n');
    });
});

describe('buildEntityNote', () => {
    test('generates correct frontmatter for person type', () => {
        const result = buildEntityNote(
            'person',
            { name: 'John Doe', highlights: [], connections: [] },
            'My Book',
            'book',
        );
        expect(result).toContain('type: person');
        expect(result).toContain('  - person');
    });

    test('includes source-types in frontmatter', () => {
        const result = buildEntityNote(
            'person',
            { name: 'John Doe', highlights: [], connections: [] },
            'Article Title',
            'article',
        );
        expect(result).toContain('source-types:');
        expect(result).toContain('  - article');
    });

    test('uses ## Sources heading', () => {
        const result = buildEntityNote(
            'person',
            { name: 'John Doe', highlights: [], connections: [] },
            'My Book',
            'book',
        );
        expect(result).toContain('## Sources');
        expect(result).not.toContain('## From My Reading');
    });

    test('includes source type in Mentioned In', () => {
        const result = buildEntityNote(
            'concept',
            { name: 'ML', highlights: [], connections: [] },
            'Paper Title',
            'paper',
        );
        expect(result).toContain('- [[Paper Title]] (paper)');
    });

    test('includes source type annotation in reading section', () => {
        const result = buildEntityNote(
            'person',
            { name: 'John', highlights: [{ summary: 'test' }], connections: [] },
            'Podcast Ep',
            'podcast',
        );
        expect(result).toContain('### [[Podcast Ep]] (podcast)');
    });

    test('includes aliases when present', () => {
        const result = buildEntityNote(
            'person',
            {
                name: 'John Doe',
                aliases: ['JD', 'Johnny'],
                highlights: [],
                connections: [],
            },
            'My Book',
            'book',
        );
        expect(result).toContain('aliases:');
        expect(result).toContain('  - JD');
        expect(result).toContain('  - Johnny');
    });

    test('omits aliases when empty', () => {
        const result = buildEntityNote(
            'person',
            { name: 'John Doe', aliases: [], highlights: [], connections: [] },
            'My Book',
            'book',
        );
        expect(result).not.toContain('aliases:');
    });

    test('includes Connected To section with wikilinks', () => {
        const result = buildEntityNote(
            'person',
            {
                name: 'John Doe',
                highlights: [],
                connections: [
                    { entity: 'Jane Smith', relationship: 'colleague' },
                ],
            },
            'My Book',
            'book',
        );
        expect(result).toContain('## Connected To');
        expect(result).toContain('- [[Jane Smith]] \u2014 colleague');
    });

    test('omits Connected To when no connections', () => {
        const result = buildEntityNote(
            'person',
            { name: 'John Doe', highlights: [], connections: [] },
            'My Book',
            'book',
        );
        expect(result).not.toContain('## Connected To');
    });

    test('includes entity name as heading', () => {
        const result = buildEntityNote(
            'person',
            { name: 'John Doe', highlights: [], connections: [] },
            'My Book',
            'book',
        );
        expect(result).toContain('# John Doe');
    });

    test('defaults to book source type', () => {
        const result = buildEntityNote(
            'person',
            { name: 'John', highlights: [], connections: [] },
            'Title',
        );
        expect(result).toContain('  - book');
        expect(result).toContain('(book)');
    });
});
