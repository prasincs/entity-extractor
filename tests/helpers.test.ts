import { describe, expect, test } from 'bun:test';
import {
    sanitizeFilename,
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

describe('parseBookNote', () => {
    test('extracts title from # heading', () => {
        const result = parseBookNote('# My Book Title\n\nSome content');
        expect(result.title).toBe('My Book Title');
    });

    test('returns Untitled when no heading', () => {
        const result = parseBookNote('Just some text without a heading');
        expect(result.title).toBe('Untitled');
    });

    test('collects all ^ref- block IDs', () => {
        const content =
            '# Book\n\nHighlight one ^ref-12345\n\nHighlight two ^ref-67890';
        const result = parseBookNote(content);
        expect(result.refs.size).toBe(2);
        expect(result.refs.has('ref-12345')).toBe(true);
        expect(result.refs.has('ref-67890')).toBe(true);
    });

    test('returns empty refs set when none exist', () => {
        const result = parseBookNote('# Book\n\nNo refs here');
        expect(result.refs.size).toBe(0);
    });

    test('detects Readwise Location links', () => {
        const content =
            '# Book\n\nSome highlight ([Location 123](https://read.amazon.com))';
        const result = parseBookNote(content);
        expect(result.hasReadwiseHighlights).toBe(true);
    });

    test('detects blockquote format', () => {
        const content = '# Book\n\n> This is a long enough blockquote highlight from the book';
        const result = parseBookNote(content);
        expect(result.hasReadwiseHighlights).toBe(true);
    });

    test('detects --- separator format', () => {
        const content = '# Book\n\nHighlight one\n---\nHighlight two';
        const result = parseBookNote(content);
        expect(result.hasReadwiseHighlights).toBe(true);
    });

    test('hasReadwiseHighlights is false when refs are present', () => {
        const content =
            '# Book\n\nHighlight ^ref-123\n---\n([Location 456](url))';
        const result = parseBookNote(content);
        expect(result.refs.size).toBe(1);
        expect(result.hasReadwiseHighlights).toBe(false);
    });

    test('hasReadwiseHighlights is false for plain text with no markers', () => {
        const result = parseBookNote('# Book\n\nJust plain text');
        expect(result.hasReadwiseHighlights).toBe(false);
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

    test('handles mixed ref and no-ref highlights', () => {
        const result = formatReadingSection('My Book', [
            { ref: 'ref-123', summary: 'With ref' },
            { summary: 'Without ref' },
        ]);
        expect(result).toContain('![[My Book#^ref-123]]');
        expect(result).toContain('- Without ref');
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
        );
        expect(result).toContain('type: person');
        expect(result).toContain('  - person');
    });

    test('generates correct frontmatter for concept type', () => {
        const result = buildEntityNote(
            'concept',
            { name: 'Machine Learning', highlights: [], connections: [] },
            'AI Book',
        );
        expect(result).toContain('type: concept');
        expect(result).toContain('  - concept');
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
        );
        expect(result).toContain('## Connected To');
        expect(result).toContain('- [[Jane Smith]] \u2014 colleague');
    });

    test('omits Connected To when no connections', () => {
        const result = buildEntityNote(
            'person',
            { name: 'John Doe', highlights: [], connections: [] },
            'My Book',
        );
        expect(result).not.toContain('## Connected To');
    });

    test('includes Mentioned In section', () => {
        const result = buildEntityNote(
            'person',
            { name: 'John Doe', highlights: [], connections: [] },
            'My Book',
        );
        expect(result).toContain('## Mentioned In');
        expect(result).toContain('- [[My Book]]');
    });

    test('includes entity name as heading', () => {
        const result = buildEntityNote(
            'person',
            { name: 'John Doe', highlights: [], connections: [] },
            'My Book',
        );
        expect(result).toContain('# John Doe');
    });
});
