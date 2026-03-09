import { Plugin, Modal, PluginSettingTab, Setting, TFile, Notice, App } from 'obsidian';
import { generateEncKey, encryptStr, decryptStr } from './crypto';
import {
    SYSTEM_PROMPT,
    buildExtractionPrompt,
    DEFAULT_SETTINGS,
} from './constants';
import type { EntityExtractorSettings } from './constants';
import {
    sanitizeFilename,
    parseSourceNote,
    formatReadingSection,
    buildEntityNote,
} from './helpers';
import type { Entity, SourceType, SourceInfo } from './helpers';

interface ExtractionResult {
    name: string;
    type: string;
    action: string;
    path: string;
    count?: number;
}

interface ApiResponse {
    content: { text: string }[];
    error?: { message: string };
}

interface ExtractionData {
    people: Entity[];
    concepts: Entity[];
}

export default class EntityExtractorPlugin extends Plugin {
    settings!: EntityExtractorSettings;

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: 'extract-entities',
            name: 'Extract entities from current note',
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (file && file.extension === 'md') {
                    if (!checking)
                        this.runExtraction(file, false).catch((e) => {
                            console.error('Entity Extractor:', e);
                            new Notice(
                                'Entity extraction error: ' + (e.message || e),
                                10000,
                            );
                        });
                    return true;
                }
                return false;
            },
        });

        this.addCommand({
            id: 'extract-entities-dry-run',
            name: 'Extract entities (dry run — preview only)',
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (file && file.extension === 'md') {
                    if (!checking)
                        this.runExtraction(file, true).catch((e) => {
                            console.error('Entity Extractor:', e);
                            new Notice(
                                'Entity extraction error: ' + (e.message || e),
                                10000,
                            );
                        });
                    return true;
                }
                return false;
            },
        });

        this.addCommand({
            id: 'extract-entities-folder',
            name: 'Extract entities from all notes in current folder',
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (file && file.extension === 'md') {
                    if (!checking)
                        this.runBatchExtraction().catch((e) => {
                            console.error('Entity Extractor:', e);
                            new Notice(
                                'Batch extraction error: ' + (e.message || e),
                                10000,
                            );
                        });
                    return true;
                }
                return false;
            },
        });

        this.addSettingTab(new EntityExtractorSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData(),
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async getApiKey(): Promise<string | null> {
        const s = this.settings;
        if (!s.encryptedApiKey || !s.encryptionKey || !s.iv) return null;
        try {
            return await decryptStr(s.encryptedApiKey, s.iv, s.encryptionKey);
        } catch {
            return null;
        }
    }

    async setApiKey(plain: string) {
        if (!this.settings.encryptionKey) {
            this.settings.encryptionKey = await generateEncKey();
        }
        const result = await encryptStr(plain, this.settings.encryptionKey);
        this.settings.encryptedApiKey = result.ct;
        this.settings.iv = result.iv;
        await this.saveSettings();
    }

    async clearApiKey() {
        this.settings.encryptedApiKey = '';
        this.settings.iv = '';
        await this.saveSettings();
    }

    async _apiFetch(apiKey: string, body: object): Promise<ApiResponse> {
        const https = require('https');
        const postData = JSON.stringify(body);
        return new Promise((resolve, reject) => {
            const options = {
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
            const req = https.request(
                options,
                (res: { statusCode: number; on: Function }) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (chunk: Buffer) => {
                        chunks.push(chunk);
                    });
                    res.on('end', () => {
                        const raw = Buffer.concat(chunks).toString();
                        try {
                            const data = JSON.parse(raw);
                            if (
                                res.statusCode >= 200 &&
                                res.statusCode < 300
                            ) {
                                resolve(data);
                            } else {
                                const msg =
                                    (data.error && data.error.message) ||
                                    'HTTP ' + res.statusCode;
                                reject(new Error(msg));
                            }
                        } catch {
                            reject(
                                new Error(
                                    'Invalid response: ' +
                                        raw.substring(0, 200),
                                ),
                            );
                        }
                    });
                },
            );
            req.on('error', (e: Error) => {
                reject(new Error('Network error: ' + e.message));
            });
            req.setTimeout(120000, () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });
            req.write(postData);
            req.end();
        });
    }

    async callClaude(
        apiKey: string,
        content: string,
        promptTemplate: string,
    ): Promise<ExtractionData> {
        const data = await this._apiFetch(apiKey, {
            model: this.settings.model,
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: promptTemplate + content }],
        });

        let text: string;
        try {
            text = data.content[0].text.trim();
        } catch {
            console.error(
                'Entity Extractor: unexpected response shape:',
                data,
            );
            throw new Error('Unexpected API response format');
        }
        if (text.startsWith('```')) {
            text = text
                .replace(/^```\w*\n?/, '')
                .replace(/\n?```$/, '')
                .trim();
        }
        try {
            return JSON.parse(text);
        } catch {
            console.error(
                'Entity Extractor: failed to parse JSON from Claude:',
                text.substring(0, 500),
            );
            throw new Error('Claude returned invalid JSON — try again');
        }
    }

    async testConnection(): Promise<{ ok: boolean; message: string }> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            return { ok: false, message: 'No API key configured' };
        }
        try {
            await this._apiFetch(apiKey, {
                model: this.settings.model,
                max_tokens: 16,
                messages: [{ role: 'user', content: 'Say "ok"' }],
            });
            return {
                ok: true,
                message: 'Connected! Model: ' + this.settings.model,
            };
        } catch (e: any) {
            return { ok: false, message: e.message };
        }
    }

    async ensureFolder(path: string) {
        if (!this.app.vault.getAbstractFileByPath(path)) {
            await this.app.vault.createFolder(path);
        }
    }

    async createOrMergeNote(
        type: string,
        entity: Entity,
        sourceTitle: string,
        sourceType: SourceType,
        dryRun: boolean,
    ): Promise<{ action: string; path: string; count?: number }> {
        const folder = type === 'person' ? 'People' : 'Concepts';
        const filename = sanitizeFilename(entity.name);
        const path = folder + '/' + filename + '.md';
        const existing = this.app.vault.getAbstractFileByPath(path);

        if (existing && existing instanceof TFile) {
            const content = await this.app.vault.read(existing);

            if (content.includes('[[' + sourceTitle + ']]')) {
                return { action: 'skip', path };
            }

            if (!dryRun) {
                let updated = content;
                const newSection = formatReadingSection(
                    sourceTitle,
                    entity.highlights,
                    sourceType,
                );
                const mentionedLine = '- [[' + sourceTitle + ']] (' + sourceType + ')';

                // Insert new source section — check for new heading first, fall back to legacy
                if (updated.includes('## Connected To')) {
                    updated = updated.replace(
                        '## Connected To',
                        newSection + '\n## Connected To',
                    );
                } else if (updated.includes('## Sources')) {
                    updated += '\n' + newSection;
                } else if (updated.includes('## From My Reading')) {
                    updated += '\n' + newSection;
                }

                if (!updated.includes('[[' + sourceTitle + ']]')) {
                    if (updated.includes('## Mentioned In')) {
                        updated = updated.replace(
                            '## Mentioned In',
                            '## Mentioned In\n' + mentionedLine,
                        );
                    } else {
                        updated +=
                            '\n\n## Mentioned In\n' + mentionedLine + '\n';
                    }
                }

                // Add source type to frontmatter if not already present
                if (!updated.includes('  - ' + sourceType)) {
                    updated = updated.replace(
                        /^(source-types:\n)/m,
                        '$1  - ' + sourceType + '\n',
                    );
                }

                await this.app.vault.modify(existing, updated);
            }
            return { action: 'merge', path };
        }

        if (!dryRun) {
            const note = buildEntityNote(type, entity, sourceTitle, sourceType);
            await this.app.vault.create(path, note);
        }
        return {
            action: 'create',
            path,
            count: (entity.highlights || []).length,
        };
    }

    async runExtraction(file: TFile, dryRun: boolean) {
        try {
            const apiKey = await this.getApiKey();
            if (!apiKey) {
                new Notice(
                    'No API key configured. Go to Settings → Entity Extractor to add your Anthropic API key.',
                    8000,
                );
                return;
            }

            const content = await this.app.vault.read(file);
            const parsed = parseSourceNote(content, file.path);
            const { title, sourceType, refs } = parsed;
            const hasRefs = refs.size > 0;

            if (!parsed.hasHighlights) {
                new Notice(
                    'No highlights found in this note.',
                    5000,
                );
                return;
            }

            const promptTemplate = buildExtractionPrompt(sourceType, hasRefs);

            const mode = dryRun ? ' (DRY RUN)' : '';
            new Notice(
                'Extracting entities from "' + title + '" (' + sourceType + ')...' + mode,
                5000,
            );

            let data: ExtractionData;
            try {
                data = await this.callClaude(apiKey, content, promptTemplate);
            } catch (e: any) {
                new Notice(
                    'API call failed: ' + (e.message || e),
                    10000,
                );
                return;
            }

            const people = data.people || [];
            const concepts = data.concepts || [];

            if (hasRefs) {
                [people, concepts].forEach((list) => {
                    list.forEach((entity) => {
                        entity.highlights = (entity.highlights || []).filter(
                            (h) => h.ref != null && refs.has(h.ref),
                        );
                    });
                });
            }

            new Notice(
                'Found ' +
                    people.length +
                    ' people, ' +
                    concepts.length +
                    ' concepts.' +
                    mode,
                5000,
            );

            const results: ExtractionResult[] = [];
            try {
                if (!dryRun) {
                    await this.ensureFolder('People');
                    await this.ensureFolder('Concepts');
                }

                for (const person of people) {
                    const r = await this.createOrMergeNote(
                        'person',
                        person,
                        title,
                        sourceType,
                        dryRun,
                    );
                    results.push({
                        name: person.name,
                        type: 'person',
                        ...r,
                    });
                }
                for (const concept of concepts) {
                    const r = await this.createOrMergeNote(
                        'concept',
                        concept,
                        title,
                        sourceType,
                        dryRun,
                    );
                    results.push({
                        name: concept.name,
                        type: 'concept',
                        ...r,
                    });
                }

                if (!content.includes('## Entities') && !dryRun) {
                    const pLinks = people
                        .map((p) => '[[' + p.name + ']]')
                        .join(', ');
                    const cLinks = concepts
                        .map((c) => '[[' + c.name + ']]')
                        .join(', ');
                    const summary =
                        '\n## Entities\n\n**People:** ' +
                        pLinks +
                        '\n\n**Concepts:** ' +
                        cLinks +
                        '\n';
                    await this.app.vault.modify(file, content + summary);
                }
            } catch (e: any) {
                console.error('Entity Extractor: error creating notes:', e);
                new Notice(
                    'Error creating notes: ' + (e.message || e),
                    10000,
                );
            }

            const modal = new ResultsModal(this.app, title, results, dryRun);
            modal.open();
        } catch (e: any) {
            console.error('Entity Extractor: unexpected error:', e);
            new Notice(
                'Entity extraction error: ' + (e.message || e),
                10000,
            );
        }
    }

    async runBatchExtraction() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file — open a file in the target folder first.', 5000);
            return;
        }

        const apiKey = await this.getApiKey();
        if (!apiKey) {
            new Notice(
                'No API key configured. Go to Settings → Entity Extractor.',
                8000,
            );
            return;
        }

        const parentPath = activeFile.parent?.path || '';
        const allFiles = this.app.vault.getMarkdownFiles().filter(
            (f) => f.parent?.path === parentPath,
        );

        // Filter to files that haven't been processed yet
        const toProcess: TFile[] = [];
        for (const f of allFiles) {
            const content = await this.app.vault.read(f);
            if (!content.includes('## Entities')) {
                const parsed = parseSourceNote(content, f.path);
                if (parsed.hasHighlights) {
                    toProcess.push(f);
                }
            }
        }

        if (toProcess.length === 0) {
            new Notice('No unprocessed notes with highlights found in ' + (parentPath || 'root'), 5000);
            return;
        }

        new Notice(
            'Batch extraction: ' + toProcess.length + ' notes in ' + (parentPath || 'root') + '. Starting...',
            5000,
        );

        let processed = 0;
        let errors = 0;
        for (const file of toProcess) {
            processed++;
            try {
                new Notice(
                    'Processing ' + processed + '/' + toProcess.length + ': ' + file.basename,
                    3000,
                );
                await this.runExtraction(file, false);
                // Rate limit delay — 2 seconds between API calls
                if (processed < toProcess.length) {
                    await new Promise((r) => setTimeout(r, 2000));
                }
            } catch (e: any) {
                errors++;
                console.error('Entity Extractor: batch error on ' + file.path, e);
            }
        }

        new Notice(
            'Batch complete: ' + processed + ' processed, ' + errors + ' errors.',
            8000,
        );
    }
}

/* ============================================================
 * Results Modal
 * ============================================================ */

class ResultsModal extends Modal {
    private sourceTitle: string;
    private results: ExtractionResult[];
    private dryRun: boolean;

    constructor(
        app: App,
        sourceTitle: string,
        results: ExtractionResult[],
        dryRun: boolean,
    ) {
        super(app);
        this.sourceTitle = sourceTitle;
        this.results = results;
        this.dryRun = dryRun;
    }

    onOpen() {
        const { contentEl } = this;
        const created = this.results.filter(
            (r) => r.action === 'create',
        ).length;
        const merged = this.results.filter(
            (r) => r.action === 'merge',
        ).length;
        const skipped = this.results.filter(
            (r) => r.action === 'skip',
        ).length;

        const heading = this.dryRun
            ? 'Dry Run: ' + this.sourceTitle
            : 'Extraction Complete';
        contentEl.createEl('h2', { text: heading });

        const parts: string[] = [];
        if (created > 0) parts.push(created + ' created');
        if (merged > 0) parts.push(merged + ' merged');
        if (skipped > 0) parts.push(skipped + ' skipped');
        contentEl.createEl('p', {
            text: this.dryRun
                ? 'Would process ' +
                  this.results.length +
                  ' entities from ' +
                  this.sourceTitle
                : parts.join(', ') + ' — from ' + this.sourceTitle,
        });

        const people = this.results.filter((r) => r.type === 'person');
        const concepts = this.results.filter((r) => r.type === 'concept');

        if (people.length > 0) {
            contentEl.createEl('h3', {
                text: 'People (' + people.length + ')',
            });
            const pList = contentEl.createEl('ul');
            people.forEach((r) => {
                const li = pList.createEl('li');
                const badge =
                    r.action === 'create'
                        ? '+ '
                        : r.action === 'merge'
                          ? '~ '
                          : '= ';
                if (!this.dryRun && r.action !== 'skip') {
                    const link = li.createEl('a', {
                        text: badge + r.name,
                        cls: 'internal-link',
                    });
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.app.workspace.openLinkText(r.path, '', false);
                        this.close();
                    });
                } else {
                    li.setText(badge + r.name);
                }
            });
        }

        if (concepts.length > 0) {
            contentEl.createEl('h3', {
                text: 'Concepts (' + concepts.length + ')',
            });
            const cList = contentEl.createEl('ul');
            concepts.forEach((r) => {
                const li = cList.createEl('li');
                const badge =
                    r.action === 'create'
                        ? '+ '
                        : r.action === 'merge'
                          ? '~ '
                          : '= ';
                if (!this.dryRun && r.action !== 'skip') {
                    const link = li.createEl('a', {
                        text: badge + r.name,
                        cls: 'internal-link',
                    });
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.app.workspace.openLinkText(r.path, '', false);
                        this.close();
                    });
                } else {
                    li.setText(badge + r.name);
                }
            });
        }

        const legend = this.dryRun
            ? 'Run without "dry run" to create these notes.'
            : '+ created, ~ merged with existing, = already had this source';
        contentEl.createEl('p', {
            text: legend,
            cls: 'setting-item-description',
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

/* ============================================================
 * Settings Tab
 * ============================================================ */

class EntityExtractorSettingTab extends PluginSettingTab {
    plugin: EntityExtractorPlugin;

    constructor(app: App, plugin: EntityExtractorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        const { plugin } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Entity Extractor' });

        const hasKey = !!plugin.settings.encryptedApiKey;

        let apiKeyInput: any;
        new Setting(containerEl)
            .setName('Anthropic API key')
            .setDesc(
                hasKey
                    ? 'API key is saved and encrypted at rest. Enter a new value to replace it.'
                    : 'Enter your API key from console.anthropic.com. It will be encrypted at rest.',
            )
            .addText((text) => {
                apiKeyInput = text;
                text.inputEl.type = 'password';
                text.inputEl.style.width = '300px';
                text.setPlaceholder(
                    hasKey
                        ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'
                        : 'sk-ant-...',
                );
            })
            .addButton((btn) => {
                btn.setButtonText('Save key')
                    .setCta()
                    .onClick(async () => {
                        const value = apiKeyInput.getValue();
                        if (value && value.length > 10) {
                            await plugin.setApiKey(value);
                            apiKeyInput.setValue('');
                            apiKeyInput.setPlaceholder(
                                '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022',
                            );
                            new Notice('API key saved (encrypted)', 3000);
                        } else {
                            new Notice(
                                'Please enter a valid API key',
                                3000,
                            );
                        }
                    });
            });

        if (hasKey) {
            new Setting(containerEl)
                .setName('Clear API key')
                .setDesc('Remove the stored API key')
                .addButton((btn) => {
                    btn.setButtonText('Clear')
                        .setWarning()
                        .onClick(async () => {
                            await plugin.clearApiKey();
                            new Notice('API key cleared', 3000);
                            this.display();
                        });
                });
        }

        if (hasKey) {
            new Setting(containerEl)
                .setName('Test connection')
                .setDesc('Verify your API key and model work')
                .addButton((btn) => {
                    btn.setButtonText('Test').onClick(async () => {
                        btn.setButtonText('Testing...');
                        btn.setDisabled(true);
                        const result = await plugin.testConnection();
                        btn.setDisabled(false);
                        if (result.ok) {
                            btn.setButtonText('OK!');
                            new Notice(result.message, 5000);
                        } else {
                            btn.setButtonText('Failed');
                            new Notice(
                                'Connection failed: ' + result.message,
                                8000,
                            );
                        }
                        setTimeout(() => {
                            btn.setButtonText('Test');
                        }, 3000);
                    });
                });
        }

        new Setting(containerEl)
            .setName('Model')
            .setDesc('Claude model to use for extraction')
            .addDropdown((dd) => {
                dd.addOption(
                    'claude-sonnet-4-6',
                    'Claude Sonnet 4 (recommended)',
                )
                    .addOption(
                        'claude-haiku-4-5',
                        'Claude Haiku 4.5 (faster/cheaper)',
                    )
                    .addOption(
                        'claude-opus-4-6',
                        'Claude Opus 4.6 (most capable)',
                    )
                    .setValue(plugin.settings.model)
                    .onChange(async (value) => {
                        plugin.settings.model = value;
                        await plugin.saveSettings();
                    });
            });

        containerEl.createEl('h3', { text: 'Usage' });
        const usage = containerEl.createEl('div');
        usage.createEl('ol', {}, (ol) => {
            ol.createEl('li', {
                text: 'Open a note with highlights (books, articles, papers, podcasts, videos)',
            });
            ol.createEl('li', { text: 'Open Command Palette (Cmd/Ctrl + P)' });
            ol.createEl('li', {
                text: 'Run "Entity Extractor: Extract entities from current note"',
            });
            ol.createEl('li', {
                text: 'Entity notes appear in People/ and Concepts/ folders',
            });
        });
        const tip = containerEl.createEl('p', {
            cls: 'setting-item-description',
        });
        tip.setText(
            'Use "dry run" to preview, or "all notes in folder" for batch processing.',
        );
    }
}
