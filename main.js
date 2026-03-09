'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var obsidian = require('obsidian');

/* ============================================================
 * Encryption helpers (Web Crypto AES-256-GCM)
 *
 * A random AES key is generated on first use and stored in
 * data.json. The API key is encrypted with it — never plain text.
 * ============================================================ */

function hexToBytes(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes) {
    return Array.from(bytes).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

async function generateEncKey() {
    var key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
    var raw = await crypto.subtle.exportKey('raw', key);
    return bytesToHex(new Uint8Array(raw));
}

async function importEncKey(hex) {
    return crypto.subtle.importKey(
        'raw', hexToBytes(hex), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
}

async function encryptStr(text, keyHex) {
    var key = await importEncKey(keyHex);
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(text)
    );
    return { ct: bytesToHex(new Uint8Array(ct)), iv: bytesToHex(iv) };
}

async function decryptStr(ctHex, ivHex, keyHex) {
    var key = await importEncKey(keyHex);
    var pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: hexToBytes(ivHex) }, key, hexToBytes(ctHex)
    );
    return new TextDecoder().decode(pt);
}

/* ============================================================
 * Constants
 * ============================================================ */

var SYSTEM_PROMPT =
    'You are an expert at analyzing book highlights and extracting structured entity data. ' +
    'You return only valid JSON, no markdown fencing.';

var EXTRACTION_PROMPT_WITH_REFS =
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

var EXTRACTION_PROMPT_NO_REFS =
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

var DEFAULT_SETTINGS = {
    encryptedApiKey: '',
    encryptionKey: '',
    iv: '',
    model: 'claude-sonnet-4-6',
};

/* ============================================================
 * Helpers
 * ============================================================ */

function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, '-');
}

function parseBookNote(content) {
    var titleMatch = content.match(/^# (.+)$/m);
    var title = titleMatch ? titleMatch[1].trim() : 'Untitled';
    var refs = new Set();
    var re = /\^(ref-\d+)/g;
    var m;
    while ((m = re.exec(content)) !== null) {
        refs.add(m[1]);
    }

    // Detect Readwise-style highlights: paragraphs separated by --- with ([Location ...]) links,
    // or plain blockquote lines (> ...)
    var hasReadwiseHighlights = false;
    if (refs.size === 0) {
        hasReadwiseHighlights = /\(\[Location\s+\d+\]\(/.test(content) ||
            /^>\s+.{10,}/m.test(content) ||
            /\n---\n/.test(content);
    }

    return { title: title, refs: refs, hasReadwiseHighlights: hasReadwiseHighlights };
}

function formatReadingSection(bookTitle, highlights) {
    if (!highlights || highlights.length === 0) {
        return '### [[' + bookTitle + ']]\n- Mentioned in text\n';
    }
    var lines = highlights.map(function (h) {
        if (h.ref) {
            return '- ' + h.summary + ' ![[' + bookTitle + '#^' + h.ref + ']]';
        }
        // No block ID — just use the text summary
        return '- ' + h.summary;
    });
    return '### [[' + bookTitle + ']]\n' + lines.join('\n') + '\n';
}

function buildEntityNote(type, entity, bookTitle) {
    var aliasYaml = '';
    if (entity.aliases && entity.aliases.length > 0) {
        aliasYaml = 'aliases:\n' + entity.aliases.map(function (a) { return '  - ' + a; }).join('\n') + '\n';
    }

    var readingSection = formatReadingSection(bookTitle, entity.highlights);

    var connections = '';
    if (entity.connections && entity.connections.length > 0) {
        var lines = entity.connections.map(function (c) {
            return '- [[' + c.entity + ']] \u2014 ' + c.relationship;
        });
        connections = '## Connected To\n' + lines.join('\n') + '\n';
    }

    return '---\n' +
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
        '- [[' + bookTitle + ']]\n';
}

/* ============================================================
 * Plugin
 * ============================================================ */

class EntityExtractorPlugin extends obsidian.Plugin {

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: 'extract-entities',
            name: 'Extract entities from current book note',
            checkCallback: (checking) => {
                var file = this.app.workspace.getActiveFile();
                if (file && file.extension === 'md') {
                    if (!checking) this.runExtraction(file, false).catch(function (e) {
                        console.error('Entity Extractor:', e);
                        new obsidian.Notice('Entity extraction error: ' + (e.message || e), 10000);
                    });
                    return true;
                }
                return false;
            },
        });

        this.addCommand({
            id: 'extract-entities-dry-run',
            name: 'Extract entities (dry run — preview only)',
            checkCallback: (checking) => {
                var file = this.app.workspace.getActiveFile();
                if (file && file.extension === 'md') {
                    if (!checking) this.runExtraction(file, true).catch(function (e) {
                        console.error('Entity Extractor:', e);
                        new obsidian.Notice('Entity extraction error: ' + (e.message || e), 10000);
                    });
                    return true;
                }
                return false;
            },
        });

        this.addSettingTab(new EntityExtractorSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async getApiKey() {
        var s = this.settings;
        if (!s.encryptedApiKey || !s.encryptionKey || !s.iv) return null;
        try {
            return await decryptStr(s.encryptedApiKey, s.iv, s.encryptionKey);
        } catch (e) {
            return null;
        }
    }

    async setApiKey(plain) {
        if (!this.settings.encryptionKey) {
            this.settings.encryptionKey = await generateEncKey();
        }
        var result = await encryptStr(plain, this.settings.encryptionKey);
        this.settings.encryptedApiKey = result.ct;
        this.settings.iv = result.iv;
        await this.saveSettings();
    }

    async clearApiKey() {
        this.settings.encryptedApiKey = '';
        this.settings.iv = '';
        await this.saveSettings();
    }

    async _apiFetch(apiKey, body) {
        var https = require('https');
        var postData = JSON.stringify(body);
        return new Promise(function (resolve, reject) {
            var options = {
                hostname: 'api.anthropic.com',
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Length': Buffer.byteLength(postData),
                },
            };
            var req = https.request(options, function (res) {
                var chunks = [];
                res.on('data', function (chunk) { chunks.push(chunk); });
                res.on('end', function () {
                    var raw = Buffer.concat(chunks).toString();
                    try {
                        var data = JSON.parse(raw);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(data);
                        } else {
                            var msg = (data.error && data.error.message) || ('HTTP ' + res.statusCode);
                            reject(new Error(msg));
                        }
                    } catch (e) {
                        reject(new Error('Invalid response: ' + raw.substring(0, 200)));
                    }
                });
            });
            req.on('error', function (e) { reject(new Error('Network error: ' + e.message)); });
            req.setTimeout(120000, function () { req.destroy(); reject(new Error('Request timed out')); });
            req.write(postData);
            req.end();
        });
    }

    async callClaude(apiKey, content, promptTemplate) {
        var data = await this._apiFetch(apiKey, {
            model: this.settings.model,
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: promptTemplate + content }],
        });

        var text;
        try {
            text = data.content[0].text.trim();
        } catch (e) {
            console.error('Entity Extractor: unexpected response shape:', data);
            throw new Error('Unexpected API response format');
        }
        if (text.startsWith('```')) {
            text = text.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
        }
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('Entity Extractor: failed to parse JSON from Claude:', text.substring(0, 500));
            throw new Error('Claude returned invalid JSON — try again');
        }
    }

    async testConnection() {
        var apiKey = await this.getApiKey();
        if (!apiKey) {
            return { ok: false, message: 'No API key configured' };
        }
        try {
            await this._apiFetch(apiKey, {
                model: this.settings.model,
                max_tokens: 16,
                messages: [{ role: 'user', content: 'Say "ok"' }],
            });
            return { ok: true, message: 'Connected! Model: ' + this.settings.model };
        } catch (e) {
            return { ok: false, message: e.message };
        }
    }

    async ensureFolder(path) {
        if (!this.app.vault.getAbstractFileByPath(path)) {
            await this.app.vault.createFolder(path);
        }
    }

    async createOrMergeNote(type, entity, bookTitle, dryRun) {
        var folder = type === 'person' ? 'People' : 'Concepts';
        var filename = sanitizeFilename(entity.name);
        var path = folder + '/' + filename + '.md';
        var existing = this.app.vault.getAbstractFileByPath(path);

        if (existing && existing instanceof obsidian.TFile) {
            var content = await this.app.vault.read(existing);

            if (content.includes('[[' + bookTitle + ']]')) {
                return { action: 'skip', path: path };
            }

            // Merge: add new reading section and mentioned-in link
            if (!dryRun) {
                var updated = content;
                var newSection = formatReadingSection(bookTitle, entity.highlights);
                var mentionedLine = '- [[' + bookTitle + ']]';

                if (updated.includes('## Connected To')) {
                    updated = updated.replace('## Connected To', newSection + '\n## Connected To');
                } else if (updated.includes('## From My Reading')) {
                    updated += '\n' + newSection;
                }

                if (!updated.includes(mentionedLine)) {
                    if (updated.includes('## Mentioned In')) {
                        updated = updated.replace('## Mentioned In', '## Mentioned In\n' + mentionedLine);
                    } else {
                        updated += '\n\n## Mentioned In\n' + mentionedLine + '\n';
                    }
                }

                await this.app.vault.modify(existing, updated);
            }
            return { action: 'merge', path: path };
        }

        // Create new note
        if (!dryRun) {
            var note = buildEntityNote(type, entity, bookTitle);
            await this.app.vault.create(path, note);
        }
        return { action: 'create', path: path, count: (entity.highlights || []).length };
    }

    async runExtraction(file, dryRun) {
        try {
            var apiKey = await this.getApiKey();
            if (!apiKey) {
                new obsidian.Notice(
                    'No API key configured. Go to Settings → Entity Extractor to add your Anthropic API key.',
                    8000
                );
                return;
            }

            var content = await this.app.vault.read(file);
            var parsed = parseBookNote(content);
            var title = parsed.title;
            var refs = parsed.refs;
            var hasRefs = refs.size > 0;

            if (!hasRefs && !parsed.hasReadwiseHighlights) {
                new obsidian.Notice('No highlights found in this note (no ^ref- markers or Readwise highlights).', 5000);
                return;
            }

            var promptTemplate = hasRefs ? EXTRACTION_PROMPT_WITH_REFS : EXTRACTION_PROMPT_NO_REFS;

            var mode = dryRun ? ' (DRY RUN)' : '';
            new obsidian.Notice('Extracting entities from "' + title + '"...' + mode, 5000);

            var data;
            try {
                data = await this.callClaude(apiKey, content, promptTemplate);
            } catch (e) {
                new obsidian.Notice('API call failed: ' + (e.message || e), 10000);
                return;
            }

            var people = data.people || [];
            var concepts = data.concepts || [];

            if (hasRefs) {
                // Validate refs — only keep highlights whose refs actually exist
                [people, concepts].forEach(function (list) {
                    list.forEach(function (entity) {
                        entity.highlights = (entity.highlights || []).filter(function (h) {
                            return refs.has(h.ref);
                        });
                    });
                });
            }

            new obsidian.Notice(
                'Found ' + people.length + ' people, ' + concepts.length + ' concepts.' + mode,
                5000
            );

            var results = [];
            try {
                // Ensure folders exist
                if (!dryRun) {
                    await this.ensureFolder('People');
                    await this.ensureFolder('Concepts');
                }

                // Create/merge notes
                for (var i = 0; i < people.length; i++) {
                    var r = await this.createOrMergeNote('person', people[i], title, dryRun);
                    results.push(Object.assign({ name: people[i].name, type: 'person' }, r));
                }
                for (var j = 0; j < concepts.length; j++) {
                    var r2 = await this.createOrMergeNote('concept', concepts[j], title, dryRun);
                    results.push(Object.assign({ name: concepts[j].name, type: 'concept' }, r2));
                }

                // Append entities section to source note
                if (!content.includes('## Entities') && !dryRun) {
                    var pLinks = people.map(function (p) { return '[[' + p.name + ']]'; }).join(', ');
                    var cLinks = concepts.map(function (c) { return '[[' + c.name + ']]'; }).join(', ');
                    var summary = '\n## Entities\n\n**People:** ' + pLinks + '\n\n**Concepts:** ' + cLinks + '\n';
                    await this.app.vault.modify(file, content + summary);
                }
            } catch (e) {
                console.error('Entity Extractor: error creating notes:', e);
                new obsidian.Notice('Error creating notes: ' + (e.message || e), 10000);
                // Still show the modal with whatever results we have so far
            }

            var modal = new ResultsModal(this.app, title, results, dryRun);
            modal.open();
        } catch (e) {
            console.error('Entity Extractor: unexpected error:', e);
            new obsidian.Notice('Entity extraction error: ' + (e.message || e), 10000);
        }
    }
}

/* ============================================================
 * Dry Run Modal
 * ============================================================ */

class ResultsModal extends obsidian.Modal {
    constructor(app, bookTitle, results, dryRun) {
        super(app);
        this.bookTitle = bookTitle;
        this.results = results;
        this.dryRun = dryRun;
    }

    onOpen() {
        var self = this;
        var contentEl = this.contentEl;
        var created = this.results.filter(function (r) { return r.action === 'create'; }).length;
        var merged = this.results.filter(function (r) { return r.action === 'merge'; }).length;
        var skipped = this.results.filter(function (r) { return r.action === 'skip'; }).length;

        var heading = this.dryRun ? 'Dry Run: ' + this.bookTitle : 'Extraction Complete';
        contentEl.createEl('h2', { text: heading });

        // Summary line
        var parts = [];
        if (created > 0) parts.push(created + ' created');
        if (merged > 0) parts.push(merged + ' merged');
        if (skipped > 0) parts.push(skipped + ' skipped');
        contentEl.createEl('p', {
            text: this.dryRun
                ? 'Would process ' + this.results.length + ' entities from ' + this.bookTitle
                : parts.join(', ') + ' — from ' + this.bookTitle,
        });

        var people = this.results.filter(function (r) { return r.type === 'person'; });
        var concepts = this.results.filter(function (r) { return r.type === 'concept'; });

        if (people.length > 0) {
            contentEl.createEl('h3', { text: 'People (' + people.length + ')' });
            var pList = contentEl.createEl('ul');
            people.forEach(function (r) {
                var li = pList.createEl('li');
                var badge = r.action === 'create' ? '+ ' : r.action === 'merge' ? '~ ' : '= ';
                if (!self.dryRun && r.action !== 'skip') {
                    var link = li.createEl('a', { text: badge + r.name, cls: 'internal-link' });
                    link.addEventListener('click', function (e) {
                        e.preventDefault();
                        self.app.workspace.openLinkText(r.path, '', false);
                        self.close();
                    });
                } else {
                    li.setText(badge + r.name);
                }
            });
        }

        if (concepts.length > 0) {
            contentEl.createEl('h3', { text: 'Concepts (' + concepts.length + ')' });
            var cList = contentEl.createEl('ul');
            concepts.forEach(function (r) {
                var li = cList.createEl('li');
                var badge = r.action === 'create' ? '+ ' : r.action === 'merge' ? '~ ' : '= ';
                if (!self.dryRun && r.action !== 'skip') {
                    var link = li.createEl('a', { text: badge + r.name, cls: 'internal-link' });
                    link.addEventListener('click', function (e) {
                        e.preventDefault();
                        self.app.workspace.openLinkText(r.path, '', false);
                        self.close();
                    });
                } else {
                    li.setText(badge + r.name);
                }
            });
        }

        var legend = this.dryRun
            ? 'Run without "dry run" to create these notes.'
            : '+ created, ~ merged with existing, = already had this book';
        contentEl.createEl('p', { text: legend, cls: 'setting-item-description' });
    }

    onClose() {
        this.contentEl.empty();
    }
}

/* ============================================================
 * Settings Tab
 * ============================================================ */

class EntityExtractorSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        var containerEl = this.containerEl;
        var plugin = this.plugin;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Entity Extractor' });

        var hasKey = !!plugin.settings.encryptedApiKey;

        // API Key
        var apiKeyInput;
        new obsidian.Setting(containerEl)
            .setName('Anthropic API key')
            .setDesc(
                hasKey
                    ? 'API key is saved and encrypted at rest. Enter a new value to replace it.'
                    : 'Enter your API key from console.anthropic.com. It will be encrypted at rest.'
            )
            .addText(function (text) {
                apiKeyInput = text;
                text.inputEl.type = 'password';
                text.inputEl.style.width = '300px';
                text.setPlaceholder(hasKey ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'sk-ant-...');
            })
            .addButton(function (btn) {
                btn.setButtonText('Save key')
                    .setCta()
                    .onClick(async function () {
                        var value = apiKeyInput.getValue();
                        if (value && value.length > 10) {
                            await plugin.setApiKey(value);
                            apiKeyInput.setValue('');
                            apiKeyInput.setPlaceholder('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
                            new obsidian.Notice('API key saved (encrypted)', 3000);
                        } else {
                            new obsidian.Notice('Please enter a valid API key', 3000);
                        }
                    });
            });

        // Clear key button (only if key exists)
        if (hasKey) {
            new obsidian.Setting(containerEl)
                .setName('Clear API key')
                .setDesc('Remove the stored API key')
                .addButton(function (btn) {
                    btn.setButtonText('Clear')
                        .setWarning()
                        .onClick(async function () {
                            await plugin.clearApiKey();
                            new obsidian.Notice('API key cleared', 3000);
                            // Re-render settings
                            plugin.settingTab = new EntityExtractorSettingTab(plugin.app, plugin);
                            plugin.settingTab.display();
                        });
                });
        }

        // Test connection
        if (hasKey) {
            new obsidian.Setting(containerEl)
                .setName('Test connection')
                .setDesc('Verify your API key and model work')
                .addButton(function (btn) {
                    btn.setButtonText('Test')
                        .onClick(async function () {
                            btn.setButtonText('Testing...');
                            btn.setDisabled(true);
                            var result = await plugin.testConnection();
                            btn.setDisabled(false);
                            if (result.ok) {
                                btn.setButtonText('OK!');
                                new obsidian.Notice(result.message, 5000);
                            } else {
                                btn.setButtonText('Failed');
                                new obsidian.Notice('Connection failed: ' + result.message, 8000);
                            }
                            setTimeout(function () { btn.setButtonText('Test'); }, 3000);
                        });
                });
        }

        // Model selector
        new obsidian.Setting(containerEl)
            .setName('Model')
            .setDesc('Claude model to use for extraction')
            .addDropdown(function (dd) {
                dd.addOption('claude-sonnet-4-6', 'Claude Sonnet 4 (recommended)')
                    .addOption('claude-haiku-4-5', 'Claude Haiku 4.5 (faster/cheaper)')
                    .addOption('claude-opus-4-6', 'Claude Opus 4.6 (most capable)')
                    .setValue(plugin.settings.model)
                    .onChange(async function (value) {
                        plugin.settings.model = value;
                        await plugin.saveSettings();
                    });
            });

        // Usage instructions
        containerEl.createEl('h3', { text: 'Usage' });
        var usage = containerEl.createEl('div');
        usage.createEl('ol', {}, function (ol) {
            ol.createEl('li', { text: 'Open a book note with highlights (Kindle ^ref- markers or Readwise format)' });
            ol.createEl('li', { text: 'Open Command Palette (Cmd/Ctrl + P)' });
            ol.createEl('li', { text: 'Run "Entity Extractor: Extract entities from current book note"' });
            ol.createEl('li', { text: 'Entity notes appear in People/ and Concepts/ folders' });
        });
        var tip = containerEl.createEl('p', { cls: 'setting-item-description' });
        tip.setText('Use "Extract entities (dry run)" to preview what would be created without writing any files.');
    }
}

exports.default = EntityExtractorPlugin;
