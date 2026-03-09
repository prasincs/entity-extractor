export interface EntityExtractorSettings {
    encryptedApiKey: string;
    encryptionKey: string;
    iv: string;
    model: string;
}

export const SYSTEM_PROMPT =
    'You are an expert at analyzing book highlights and extracting structured entity data. ' +
    'You return only valid JSON, no markdown fencing.';

export const EXTRACTION_PROMPT_WITH_REFS =
    'Analyze this book note (Kindle highlights) and extract all notable entities.\n' +
    '\n' +
    'Return a JSON object with this exact structure:\n' +
    '{\n' +
    '  "people": [\n' +
    '    {\n' +
    '      "name": "Full Name",\n' +
    '      "aliases": ["Nickname"],\n' +
    '      "major": true,\n' +
    '      "highlights": [\n' +
    '        {"ref": "ref-XXXXX", "summary": "Brief 5-10 word description"}\n' +
    '      ],\n' +
    '      "connections": [\n' +
    '        {"entity": "Other Entity Name", "relationship": "brief description"}\n' +
    '      ]\n' +
    '    }\n' +
    '  ],\n' +
    '  "concepts": [\n' +
    '    {\n' +
    '      "name": "Concept Name",\n' +
    '      "aliases": ["alternate name"],\n' +
    '      "major": true,\n' +
    '      "highlights": [\n' +
    '        {"ref": "ref-XXXXX", "summary": "Brief description"}\n' +
    '      ],\n' +
    '      "connections": [\n' +
    '        {"entity": "Person or Concept Name", "relationship": "brief description"}\n' +
    '      ]\n' +
    '    }\n' +
    '  ]\n' +
    '}\n' +
    '\n' +
    'Rules:\n' +
    '- "major" is true if the entity has significant coverage (multiple highlights or central to the narrative), false for brief/passing mentions\n' +
    '- Only use ref IDs that actually appear in the text (they look like ^ref-XXXXX at the end of highlights)\n' +
    '- A highlight can be associated with multiple entities\n' +
    '- For connections, only link to other entities you are extracting (not external figures)\n' +
    '- People connections should include relationships like "co-developer", "student", "advisor", "colleague", "critic"\n' +
    '- Concept connections should link to related people AND related concepts\n' +
    '- Include ALL people mentioned by name, even briefly — they become stubs\n' +
    '- For concepts, focus on technical/intellectual concepts, not general terms\n' +
    '- Return ONLY the JSON object, no markdown fencing or explanation\n' +
    '\n' +
    'Book note content:\n';

export const EXTRACTION_PROMPT_NO_REFS =
    'Analyze this book note (highlights from Readwise or similar) and extract all notable entities.\n' +
    'This note does NOT have ^ref-XXXXX block IDs. Instead, provide a "quote" field with a short excerpt (first ~80 chars) from the relevant highlight text.\n' +
    '\n' +
    'Return a JSON object with this exact structure:\n' +
    '{\n' +
    '  "people": [\n' +
    '    {\n' +
    '      "name": "Full Name",\n' +
    '      "aliases": ["Nickname"],\n' +
    '      "major": true,\n' +
    '      "highlights": [\n' +
    '        {"quote": "First ~80 chars of the highlight text...", "summary": "Brief 5-10 word description"}\n' +
    '      ],\n' +
    '      "connections": [\n' +
    '        {"entity": "Other Entity Name", "relationship": "brief description"}\n' +
    '      ]\n' +
    '    }\n' +
    '  ],\n' +
    '  "concepts": [\n' +
    '    {\n' +
    '      "name": "Concept Name",\n' +
    '      "aliases": ["alternate name"],\n' +
    '      "major": true,\n' +
    '      "highlights": [\n' +
    '        {"quote": "First ~80 chars of the highlight text...", "summary": "Brief description"}\n' +
    '      ],\n' +
    '      "connections": [\n' +
    '        {"entity": "Person or Concept Name", "relationship": "brief description"}\n' +
    '      ]\n' +
    '    }\n' +
    '  ]\n' +
    '}\n' +
    '\n' +
    'Rules:\n' +
    '- "major" is true if the entity has significant coverage (multiple highlights or central to the narrative), false for brief/passing mentions\n' +
    '- For "quote", use the first ~80 characters of the actual highlight text from the note (enough to identify it)\n' +
    '- A highlight can be associated with multiple entities\n' +
    '- For connections, only link to other entities you are extracting (not external figures)\n' +
    '- People connections should include relationships like "co-developer", "student", "advisor", "colleague", "critic"\n' +
    '- Concept connections should link to related people AND related concepts\n' +
    '- Include ALL people mentioned by name, even briefly — they become stubs\n' +
    '- For concepts, focus on technical/intellectual concepts, not general terms\n' +
    '- Return ONLY the JSON object, no markdown fencing or explanation\n' +
    '\n' +
    'Book note content:\n';

export const DEFAULT_SETTINGS: EntityExtractorSettings = {
    encryptedApiKey: '',
    encryptionKey: '',
    iv: '',
    model: 'claude-sonnet-4-6',
};
