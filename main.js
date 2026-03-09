"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => EntityExtractorPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/crypto.ts
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function generateEncKey() {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  return bytesToHex(new Uint8Array(raw));
}
async function importEncKey(hex) {
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(hex).buffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}
async function encryptStr(text, keyHex) {
  const key = await importEncKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text)
  );
  return { ct: bytesToHex(new Uint8Array(ct)), iv: bytesToHex(iv) };
}
async function decryptStr(ctHex, ivHex, keyHex) {
  const key = await importEncKey(keyHex);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(ivHex).buffer },
    key,
    hexToBytes(ctHex).buffer
  );
  return new TextDecoder().decode(pt);
}

// src/constants.ts
var SYSTEM_PROMPT = "You are an expert at analyzing highlights and annotations from various sources (books, papers, articles, podcasts, videos) and extracting structured entity data. You return only valid JSON, no markdown fencing.";
var SOURCE_TYPE_CONTEXT = {
  book: "Analyze this book note (highlights from reading) and extract all notable entities.\n",
  paper: "Analyze this academic paper note (highlights and annotations) and extract all notable entities.\nPay special attention to: research methodologies, theoretical frameworks, cited researchers, and technical terminology.\n",
  article: "Analyze this article note (highlights from web reading) and extract all notable entities.\n",
  podcast: "Analyze this podcast note (highlights from a podcast episode) and extract all notable entities.\nNote: quotes may be from spoken conversation and may reference multiple speakers.\n",
  video: "Analyze this video note (highlights from a video) and extract all notable entities.\n",
  tweet: "Analyze this tweet collection and extract all notable entities.\nNote: content is from social media and may be brief.\n",
  unknown: "Analyze this note and extract all notable entities.\n"
};
var EXTRACTION_JSON_SCHEMA_WITH_REFS = '\nReturn a JSON object with this exact structure:\n{\n  "people": [\n    {\n      "name": "Full Name",\n      "aliases": ["Nickname"],\n      "major": true,\n      "highlights": [\n        {"ref": "ref-XXXXX", "summary": "Brief 5-10 word description"}\n      ],\n      "connections": [\n        {"entity": "Other Entity Name", "relationship": "brief description"}\n      ]\n    }\n  ],\n  "concepts": [\n    {\n      "name": "Concept Name",\n      "aliases": ["alternate name"],\n      "major": true,\n      "highlights": [\n        {"ref": "ref-XXXXX", "summary": "Brief description"}\n      ],\n      "connections": [\n        {"entity": "Person or Concept Name", "relationship": "brief description"}\n      ]\n    }\n  ]\n}\n';
var EXTRACTION_JSON_SCHEMA_NO_REFS = '\nThis note does NOT have ^ref-XXXXX block IDs. Instead, provide a "quote" field with a short excerpt (first ~80 chars) from the relevant highlight text.\n\nReturn a JSON object with this exact structure:\n{\n  "people": [\n    {\n      "name": "Full Name",\n      "aliases": ["Nickname"],\n      "major": true,\n      "highlights": [\n        {"quote": "First ~80 chars of the highlight text...", "summary": "Brief 5-10 word description"}\n      ],\n      "connections": [\n        {"entity": "Other Entity Name", "relationship": "brief description"}\n      ]\n    }\n  ],\n  "concepts": [\n    {\n      "name": "Concept Name",\n      "aliases": ["alternate name"],\n      "major": true,\n      "highlights": [\n        {"quote": "First ~80 chars of the highlight text...", "summary": "Brief description"}\n      ],\n      "connections": [\n        {"entity": "Person or Concept Name", "relationship": "brief description"}\n      ]\n    }\n  ]\n}\n';
var EXTRACTION_RULES_WITH_REFS = '\nRules:\n- "major" is true if the entity has significant coverage (multiple highlights or central to the narrative), false for brief/passing mentions\n- Only use ref IDs that actually appear in the text (they look like ^ref-XXXXX at the end of highlights)\n- A highlight can be associated with multiple entities\n- For connections, only link to other entities you are extracting (not external figures)\n- People connections should include relationships like "co-developer", "student", "advisor", "colleague", "critic"\n- Concept connections should link to related people AND related concepts\n- Include ALL people mentioned by name, even briefly \u2014 they become stubs\n- For concepts, focus on technical/intellectual concepts, not general terms\n- Return ONLY the JSON object, no markdown fencing or explanation\n\nNote content:\n';
var EXTRACTION_RULES_NO_REFS = '\nRules:\n- "major" is true if the entity has significant coverage (multiple highlights or central to the narrative), false for brief/passing mentions\n- For "quote", use the first ~80 characters of the actual highlight text from the note (enough to identify it)\n- A highlight can be associated with multiple entities\n- For connections, only link to other entities you are extracting (not external figures)\n- People connections should include relationships like "co-developer", "student", "advisor", "colleague", "critic"\n- Concept connections should link to related people AND related concepts\n- Include ALL people mentioned by name, even briefly \u2014 they become stubs\n- For concepts, focus on technical/intellectual concepts, not general terms\n- Return ONLY the JSON object, no markdown fencing or explanation\n\nNote content:\n';
function buildExtractionPrompt(sourceType, hasRefs) {
  const context = SOURCE_TYPE_CONTEXT[sourceType];
  if (hasRefs) {
    return context + EXTRACTION_JSON_SCHEMA_WITH_REFS + EXTRACTION_RULES_WITH_REFS;
  }
  return context + EXTRACTION_JSON_SCHEMA_NO_REFS + EXTRACTION_RULES_NO_REFS;
}
var DEFAULT_SETTINGS = {
  encryptedApiKey: "",
  encryptionKey: "",
  iv: "",
  model: "claude-sonnet-4-6"
};

// src/helpers.ts
function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, "-");
}
function detectSourceType(content, filePath) {
  const categoryMatch = content.match(/^-\s*Category:\s*#(\w+)/m);
  if (categoryMatch) {
    const cat = categoryMatch[1].toLowerCase();
    if (cat === "books") return "book";
    if (cat === "articles") return "article";
    if (cat === "podcasts") return "podcast";
    if (cat === "tweets") return "tweet";
    if (cat === "papers") return "paper";
    if (cat === "videos") return "video";
  }
  if (/^kindle-sync:/m.test(content)) return "book";
  if (/^-\s*DOI:/m.test(content)) return "paper";
  if (filePath) {
    const p = filePath.toLowerCase();
    if (p.includes("papers/")) return "paper";
    if (p.includes("podcasts/")) return "podcast";
    if (p.includes("videos/")) return "video";
    if (p.includes("articles/")) return "article";
    if (p.includes("tweets/")) return "tweet";
    if (p.includes("books/")) return "book";
  }
  return "unknown";
}
function parseSourceNote(content, filePath) {
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled";
  const sourceType = detectSourceType(content, filePath);
  const refs = /* @__PURE__ */ new Set();
  const re = /\^(ref-\d+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    refs.add(m[1]);
  }
  let hasHighlights = refs.size > 0;
  if (!hasHighlights) {
    hasHighlights = /\(\[Location\s+\d+\]\(/.test(content) || /\(\[View Highlight\]\(/.test(content) || /\(\[View Tweet\]\(/.test(content) || /^>\s+.{10,}/m.test(content) || /\n---\n/.test(content);
  }
  return { title, sourceType, refs, hasHighlights };
}
function formatReadingSection(sourceTitle, highlights, sourceType) {
  const typeAnnotation = sourceType ? " (" + sourceType + ")" : "";
  if (!highlights || highlights.length === 0) {
    return "### [[" + sourceTitle + "]]" + typeAnnotation + "\n- Mentioned in text\n";
  }
  const lines = highlights.map((h) => {
    if (h.ref) {
      return "- " + h.summary + " ![[" + sourceTitle + "#^" + h.ref + "]]";
    }
    return "- " + h.summary;
  });
  return "### [[" + sourceTitle + "]]" + typeAnnotation + "\n" + lines.join("\n") + "\n";
}
function buildEntityNote(type, entity, sourceTitle, sourceType = "book") {
  let aliasYaml = "";
  if (entity.aliases && entity.aliases.length > 0) {
    aliasYaml = "aliases:\n" + entity.aliases.map((a) => "  - " + a).join("\n") + "\n";
  }
  const readingSection = formatReadingSection(sourceTitle, entity.highlights, sourceType);
  let connections = "";
  if (entity.connections && entity.connections.length > 0) {
    const lines = entity.connections.map(
      (c) => "- [[" + c.entity + "]] \u2014 " + c.relationship
    );
    connections = "## Connected To\n" + lines.join("\n") + "\n";
  }
  return "---\ntype: " + type + "\ntags:\n  - " + type + "\n" + aliasYaml + "source-types:\n  - " + sourceType + "\n---\n\n# " + entity.name + "\n\n## Sources\n\n" + readingSection + "\n" + connections + "\n## Mentioned In\n- [[" + sourceTitle + "]] (" + sourceType + ")\n";
}

// src/main.ts
var EntityExtractorPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "extract-entities",
      name: "Extract entities from current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === "md") {
          if (!checking)
            this.runExtraction(file, false).catch((e) => {
              console.error("Entity Extractor:", e);
              new import_obsidian.Notice(
                "Entity extraction error: " + (e.message || e),
                1e4
              );
            });
          return true;
        }
        return false;
      }
    });
    this.addCommand({
      id: "extract-entities-dry-run",
      name: "Extract entities (dry run \u2014 preview only)",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === "md") {
          if (!checking)
            this.runExtraction(file, true).catch((e) => {
              console.error("Entity Extractor:", e);
              new import_obsidian.Notice(
                "Entity extraction error: " + (e.message || e),
                1e4
              );
            });
          return true;
        }
        return false;
      }
    });
    this.addCommand({
      id: "extract-entities-folder",
      name: "Extract entities from all notes in current folder",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === "md") {
          if (!checking)
            this.runBatchExtraction().catch((e) => {
              console.error("Entity Extractor:", e);
              new import_obsidian.Notice(
                "Batch extraction error: " + (e.message || e),
                1e4
              );
            });
          return true;
        }
        return false;
      }
    });
    this.addSettingTab(new EntityExtractorSettingTab(this.app, this));
  }
  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async getApiKey() {
    const s = this.settings;
    if (!s.encryptedApiKey || !s.encryptionKey || !s.iv) return null;
    try {
      return await decryptStr(s.encryptedApiKey, s.iv, s.encryptionKey);
    } catch {
      return null;
    }
  }
  async setApiKey(plain) {
    if (!this.settings.encryptionKey) {
      this.settings.encryptionKey = await generateEncKey();
    }
    const result = await encryptStr(plain, this.settings.encryptionKey);
    this.settings.encryptedApiKey = result.ct;
    this.settings.iv = result.iv;
    await this.saveSettings();
  }
  async clearApiKey() {
    this.settings.encryptedApiKey = "";
    this.settings.iv = "";
    await this.saveSettings();
  }
  async _apiFetch(apiKey, body) {
    const https = require("https");
    const postData = JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(postData)
        }
      };
      const req = https.request(
        options,
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => {
            chunks.push(chunk);
          });
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString();
            try {
              const data = JSON.parse(raw);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(data);
              } else {
                const msg = data.error && data.error.message || "HTTP " + res.statusCode;
                reject(new Error(msg));
              }
            } catch {
              reject(
                new Error(
                  "Invalid response: " + raw.substring(0, 200)
                )
              );
            }
          });
        }
      );
      req.on("error", (e) => {
        reject(new Error("Network error: " + e.message));
      });
      req.setTimeout(12e4, () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });
      req.write(postData);
      req.end();
    });
  }
  async callClaude(apiKey, content, promptTemplate) {
    const data = await this._apiFetch(apiKey, {
      model: this.settings.model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: promptTemplate + content }]
    });
    let text;
    try {
      text = data.content[0].text.trim();
    } catch {
      console.error(
        "Entity Extractor: unexpected response shape:",
        data
      );
      throw new Error("Unexpected API response format");
    }
    if (text.startsWith("```")) {
      text = text.replace(/^```\w*\n?/, "").replace(/\n?```$/, "").trim();
    }
    try {
      return JSON.parse(text);
    } catch {
      console.error(
        "Entity Extractor: failed to parse JSON from Claude:",
        text.substring(0, 500)
      );
      throw new Error("Claude returned invalid JSON \u2014 try again");
    }
  }
  async testConnection() {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return { ok: false, message: "No API key configured" };
    }
    try {
      await this._apiFetch(apiKey, {
        model: this.settings.model,
        max_tokens: 16,
        messages: [{ role: "user", content: 'Say "ok"' }]
      });
      return {
        ok: true,
        message: "Connected! Model: " + this.settings.model
      };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }
  async ensureFolder(path) {
    if (!this.app.vault.getAbstractFileByPath(path)) {
      await this.app.vault.createFolder(path);
    }
  }
  async createOrMergeNote(type, entity, sourceTitle, sourceType, dryRun) {
    const folder = type === "person" ? "People" : "Concepts";
    const filename = sanitizeFilename(entity.name);
    const path = folder + "/" + filename + ".md";
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing && existing instanceof import_obsidian.TFile) {
      const content = await this.app.vault.read(existing);
      if (content.includes("[[" + sourceTitle + "]]")) {
        return { action: "skip", path };
      }
      if (!dryRun) {
        let updated = content;
        const newSection = formatReadingSection(
          sourceTitle,
          entity.highlights,
          sourceType
        );
        const mentionedLine = "- [[" + sourceTitle + "]] (" + sourceType + ")";
        if (updated.includes("## Connected To")) {
          updated = updated.replace(
            "## Connected To",
            newSection + "\n## Connected To"
          );
        } else if (updated.includes("## Sources")) {
          updated += "\n" + newSection;
        } else if (updated.includes("## From My Reading")) {
          updated += "\n" + newSection;
        }
        if (!updated.includes("[[" + sourceTitle + "]]")) {
          if (updated.includes("## Mentioned In")) {
            updated = updated.replace(
              "## Mentioned In",
              "## Mentioned In\n" + mentionedLine
            );
          } else {
            updated += "\n\n## Mentioned In\n" + mentionedLine + "\n";
          }
        }
        if (!updated.includes("  - " + sourceType)) {
          updated = updated.replace(
            /^(source-types:\n)/m,
            "$1  - " + sourceType + "\n"
          );
        }
        await this.app.vault.modify(existing, updated);
      }
      return { action: "merge", path };
    }
    if (!dryRun) {
      const note = buildEntityNote(type, entity, sourceTitle, sourceType);
      await this.app.vault.create(path, note);
    }
    return {
      action: "create",
      path,
      count: (entity.highlights || []).length
    };
  }
  async runExtraction(file, dryRun) {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        new import_obsidian.Notice(
          "No API key configured. Go to Settings \u2192 Entity Extractor to add your Anthropic API key.",
          8e3
        );
        return;
      }
      const content = await this.app.vault.read(file);
      const parsed = parseSourceNote(content, file.path);
      const { title, sourceType, refs } = parsed;
      const hasRefs = refs.size > 0;
      if (!parsed.hasHighlights) {
        new import_obsidian.Notice(
          "No highlights found in this note.",
          5e3
        );
        return;
      }
      const promptTemplate = buildExtractionPrompt(sourceType, hasRefs);
      const mode = dryRun ? " (DRY RUN)" : "";
      new import_obsidian.Notice(
        'Extracting entities from "' + title + '" (' + sourceType + ")..." + mode,
        5e3
      );
      let data;
      try {
        data = await this.callClaude(apiKey, content, promptTemplate);
      } catch (e) {
        new import_obsidian.Notice(
          "API call failed: " + (e.message || e),
          1e4
        );
        return;
      }
      const people = data.people || [];
      const concepts = data.concepts || [];
      if (hasRefs) {
        [people, concepts].forEach((list) => {
          list.forEach((entity) => {
            entity.highlights = (entity.highlights || []).filter(
              (h) => h.ref != null && refs.has(h.ref)
            );
          });
        });
      }
      new import_obsidian.Notice(
        "Found " + people.length + " people, " + concepts.length + " concepts." + mode,
        5e3
      );
      const results = [];
      try {
        if (!dryRun) {
          await this.ensureFolder("People");
          await this.ensureFolder("Concepts");
        }
        for (const person of people) {
          const r = await this.createOrMergeNote(
            "person",
            person,
            title,
            sourceType,
            dryRun
          );
          results.push({
            name: person.name,
            type: "person",
            ...r
          });
        }
        for (const concept of concepts) {
          const r = await this.createOrMergeNote(
            "concept",
            concept,
            title,
            sourceType,
            dryRun
          );
          results.push({
            name: concept.name,
            type: "concept",
            ...r
          });
        }
        if (!content.includes("## Entities") && !dryRun) {
          const pLinks = people.map((p) => "[[" + p.name + "]]").join(", ");
          const cLinks = concepts.map((c) => "[[" + c.name + "]]").join(", ");
          const summary = "\n## Entities\n\n**People:** " + pLinks + "\n\n**Concepts:** " + cLinks + "\n";
          await this.app.vault.modify(file, content + summary);
        }
      } catch (e) {
        console.error("Entity Extractor: error creating notes:", e);
        new import_obsidian.Notice(
          "Error creating notes: " + (e.message || e),
          1e4
        );
      }
      const modal = new ResultsModal(this.app, title, results, dryRun);
      modal.open();
    } catch (e) {
      console.error("Entity Extractor: unexpected error:", e);
      new import_obsidian.Notice(
        "Entity extraction error: " + (e.message || e),
        1e4
      );
    }
  }
  async runBatchExtraction() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new import_obsidian.Notice("No active file \u2014 open a file in the target folder first.", 5e3);
      return;
    }
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      new import_obsidian.Notice(
        "No API key configured. Go to Settings \u2192 Entity Extractor.",
        8e3
      );
      return;
    }
    const parentPath = activeFile.parent?.path || "";
    const allFiles = this.app.vault.getMarkdownFiles().filter(
      (f) => f.parent?.path === parentPath
    );
    const toProcess = [];
    for (const f of allFiles) {
      const content = await this.app.vault.read(f);
      if (!content.includes("## Entities")) {
        const parsed = parseSourceNote(content, f.path);
        if (parsed.hasHighlights) {
          toProcess.push(f);
        }
      }
    }
    if (toProcess.length === 0) {
      new import_obsidian.Notice("No unprocessed notes with highlights found in " + (parentPath || "root"), 5e3);
      return;
    }
    new import_obsidian.Notice(
      "Batch extraction: " + toProcess.length + " notes in " + (parentPath || "root") + ". Starting...",
      5e3
    );
    let processed = 0;
    let errors = 0;
    for (const file of toProcess) {
      processed++;
      try {
        new import_obsidian.Notice(
          "Processing " + processed + "/" + toProcess.length + ": " + file.basename,
          3e3
        );
        await this.runExtraction(file, false);
        if (processed < toProcess.length) {
          await new Promise((r) => setTimeout(r, 2e3));
        }
      } catch (e) {
        errors++;
        console.error("Entity Extractor: batch error on " + file.path, e);
      }
    }
    new import_obsidian.Notice(
      "Batch complete: " + processed + " processed, " + errors + " errors.",
      8e3
    );
  }
};
var ResultsModal = class extends import_obsidian.Modal {
  constructor(app, sourceTitle, results, dryRun) {
    super(app);
    this.sourceTitle = sourceTitle;
    this.results = results;
    this.dryRun = dryRun;
  }
  onOpen() {
    const { contentEl } = this;
    const created = this.results.filter(
      (r) => r.action === "create"
    ).length;
    const merged = this.results.filter(
      (r) => r.action === "merge"
    ).length;
    const skipped = this.results.filter(
      (r) => r.action === "skip"
    ).length;
    const heading = this.dryRun ? "Dry Run: " + this.sourceTitle : "Extraction Complete";
    contentEl.createEl("h2", { text: heading });
    const parts = [];
    if (created > 0) parts.push(created + " created");
    if (merged > 0) parts.push(merged + " merged");
    if (skipped > 0) parts.push(skipped + " skipped");
    contentEl.createEl("p", {
      text: this.dryRun ? "Would process " + this.results.length + " entities from " + this.sourceTitle : parts.join(", ") + " \u2014 from " + this.sourceTitle
    });
    const people = this.results.filter((r) => r.type === "person");
    const concepts = this.results.filter((r) => r.type === "concept");
    if (people.length > 0) {
      contentEl.createEl("h3", {
        text: "People (" + people.length + ")"
      });
      const pList = contentEl.createEl("ul");
      people.forEach((r) => {
        const li = pList.createEl("li");
        const badge = r.action === "create" ? "+ " : r.action === "merge" ? "~ " : "= ";
        if (!this.dryRun && r.action !== "skip") {
          const link = li.createEl("a", {
            text: badge + r.name,
            cls: "internal-link"
          });
          link.addEventListener("click", (e) => {
            e.preventDefault();
            this.app.workspace.openLinkText(r.path, "", false);
            this.close();
          });
        } else {
          li.setText(badge + r.name);
        }
      });
    }
    if (concepts.length > 0) {
      contentEl.createEl("h3", {
        text: "Concepts (" + concepts.length + ")"
      });
      const cList = contentEl.createEl("ul");
      concepts.forEach((r) => {
        const li = cList.createEl("li");
        const badge = r.action === "create" ? "+ " : r.action === "merge" ? "~ " : "= ";
        if (!this.dryRun && r.action !== "skip") {
          const link = li.createEl("a", {
            text: badge + r.name,
            cls: "internal-link"
          });
          link.addEventListener("click", (e) => {
            e.preventDefault();
            this.app.workspace.openLinkText(r.path, "", false);
            this.close();
          });
        } else {
          li.setText(badge + r.name);
        }
      });
    }
    const legend = this.dryRun ? 'Run without "dry run" to create these notes.' : "+ created, ~ merged with existing, = already had this source";
    contentEl.createEl("p", {
      text: legend,
      cls: "setting-item-description"
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var EntityExtractorSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    const { plugin } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Entity Extractor" });
    const hasKey = !!plugin.settings.encryptedApiKey;
    let apiKeyInput;
    new import_obsidian.Setting(containerEl).setName("Anthropic API key").setDesc(
      hasKey ? "API key is saved and encrypted at rest. Enter a new value to replace it." : "Enter your API key from console.anthropic.com. It will be encrypted at rest."
    ).addText((text) => {
      apiKeyInput = text;
      text.inputEl.type = "password";
      text.inputEl.style.width = "300px";
      text.setPlaceholder(
        hasKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "sk-ant-..."
      );
    }).addButton((btn) => {
      btn.setButtonText("Save key").setCta().onClick(async () => {
        const value = apiKeyInput.getValue();
        if (value && value.length > 10) {
          await plugin.setApiKey(value);
          apiKeyInput.setValue("");
          apiKeyInput.setPlaceholder(
            "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
          );
          new import_obsidian.Notice("API key saved (encrypted)", 3e3);
        } else {
          new import_obsidian.Notice(
            "Please enter a valid API key",
            3e3
          );
        }
      });
    });
    if (hasKey) {
      new import_obsidian.Setting(containerEl).setName("Clear API key").setDesc("Remove the stored API key").addButton((btn) => {
        btn.setButtonText("Clear").setWarning().onClick(async () => {
          await plugin.clearApiKey();
          new import_obsidian.Notice("API key cleared", 3e3);
          this.display();
        });
      });
    }
    if (hasKey) {
      new import_obsidian.Setting(containerEl).setName("Test connection").setDesc("Verify your API key and model work").addButton((btn) => {
        btn.setButtonText("Test").onClick(async () => {
          btn.setButtonText("Testing...");
          btn.setDisabled(true);
          const result = await plugin.testConnection();
          btn.setDisabled(false);
          if (result.ok) {
            btn.setButtonText("OK!");
            new import_obsidian.Notice(result.message, 5e3);
          } else {
            btn.setButtonText("Failed");
            new import_obsidian.Notice(
              "Connection failed: " + result.message,
              8e3
            );
          }
          setTimeout(() => {
            btn.setButtonText("Test");
          }, 3e3);
        });
      });
    }
    new import_obsidian.Setting(containerEl).setName("Model").setDesc("Claude model to use for extraction").addDropdown((dd) => {
      dd.addOption(
        "claude-sonnet-4-6",
        "Claude Sonnet 4 (recommended)"
      ).addOption(
        "claude-haiku-4-5",
        "Claude Haiku 4.5 (faster/cheaper)"
      ).addOption(
        "claude-opus-4-6",
        "Claude Opus 4.6 (most capable)"
      ).setValue(plugin.settings.model).onChange(async (value) => {
        plugin.settings.model = value;
        await plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Usage" });
    const usage = containerEl.createEl("div");
    usage.createEl("ol", {}, (ol) => {
      ol.createEl("li", {
        text: "Open a note with highlights (books, articles, papers, podcasts, videos)"
      });
      ol.createEl("li", { text: "Open Command Palette (Cmd/Ctrl + P)" });
      ol.createEl("li", {
        text: 'Run "Entity Extractor: Extract entities from current note"'
      });
      ol.createEl("li", {
        text: "Entity notes appear in People/ and Concepts/ folders"
      });
    });
    const tip = containerEl.createEl("p", {
      cls: "setting-item-description"
    });
    tip.setText(
      'Use "dry run" to preview, or "all notes in folder" for batch processing.'
    );
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2NyeXB0by50cyIsICJzcmMvY29uc3RhbnRzLnRzIiwgInNyYy9oZWxwZXJzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBQbHVnaW4sIE1vZGFsLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nLCBURmlsZSwgTm90aWNlLCBBcHAgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBnZW5lcmF0ZUVuY0tleSwgZW5jcnlwdFN0ciwgZGVjcnlwdFN0ciB9IGZyb20gJy4vY3J5cHRvJztcbmltcG9ydCB7XG4gICAgU1lTVEVNX1BST01QVCxcbiAgICBidWlsZEV4dHJhY3Rpb25Qcm9tcHQsXG4gICAgREVGQVVMVF9TRVRUSU5HUyxcbn0gZnJvbSAnLi9jb25zdGFudHMnO1xuaW1wb3J0IHR5cGUgeyBFbnRpdHlFeHRyYWN0b3JTZXR0aW5ncyB9IGZyb20gJy4vY29uc3RhbnRzJztcbmltcG9ydCB7XG4gICAgc2FuaXRpemVGaWxlbmFtZSxcbiAgICBwYXJzZVNvdXJjZU5vdGUsXG4gICAgZm9ybWF0UmVhZGluZ1NlY3Rpb24sXG4gICAgYnVpbGRFbnRpdHlOb3RlLFxufSBmcm9tICcuL2hlbHBlcnMnO1xuaW1wb3J0IHR5cGUgeyBFbnRpdHksIFNvdXJjZVR5cGUsIFNvdXJjZUluZm8gfSBmcm9tICcuL2hlbHBlcnMnO1xuXG5pbnRlcmZhY2UgRXh0cmFjdGlvblJlc3VsdCB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHR5cGU6IHN0cmluZztcbiAgICBhY3Rpb246IHN0cmluZztcbiAgICBwYXRoOiBzdHJpbmc7XG4gICAgY291bnQ/OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBBcGlSZXNwb25zZSB7XG4gICAgY29udGVudDogeyB0ZXh0OiBzdHJpbmcgfVtdO1xuICAgIGVycm9yPzogeyBtZXNzYWdlOiBzdHJpbmcgfTtcbn1cblxuaW50ZXJmYWNlIEV4dHJhY3Rpb25EYXRhIHtcbiAgICBwZW9wbGU6IEVudGl0eVtdO1xuICAgIGNvbmNlcHRzOiBFbnRpdHlbXTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRW50aXR5RXh0cmFjdG9yUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgICBzZXR0aW5ncyE6IEVudGl0eUV4dHJhY3RvclNldHRpbmdzO1xuXG4gICAgYXN5bmMgb25sb2FkKCkge1xuICAgICAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG4gICAgICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICAgICAgICBpZDogJ2V4dHJhY3QtZW50aXRpZXMnLFxuICAgICAgICAgICAgbmFtZTogJ0V4dHJhY3QgZW50aXRpZXMgZnJvbSBjdXJyZW50IG5vdGUnLFxuICAgICAgICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICAgICAgICAgICAgaWYgKGZpbGUgJiYgZmlsZS5leHRlbnNpb24gPT09ICdtZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjaGVja2luZylcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucnVuRXh0cmFjdGlvbihmaWxlLCBmYWxzZSkuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFbnRpdHkgRXh0cmFjdG9yOicsIGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdFbnRpdHkgZXh0cmFjdGlvbiBlcnJvcjogJyArIChlLm1lc3NhZ2UgfHwgZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEwMDAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICAgICAgICBpZDogJ2V4dHJhY3QtZW50aXRpZXMtZHJ5LXJ1bicsXG4gICAgICAgICAgICBuYW1lOiAnRXh0cmFjdCBlbnRpdGllcyAoZHJ5IHJ1biBcdTIwMTQgcHJldmlldyBvbmx5KScsXG4gICAgICAgICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgICAgICAgICAgICBpZiAoZmlsZSAmJiBmaWxlLmV4dGVuc2lvbiA9PT0gJ21kJykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNoZWNraW5nKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5ydW5FeHRyYWN0aW9uKGZpbGUsIHRydWUpLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRW50aXR5IEV4dHJhY3RvcjonLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgTm90aWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnRW50aXR5IGV4dHJhY3Rpb24gZXJyb3I6ICcgKyAoZS5tZXNzYWdlIHx8IGUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxMDAwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgICAgICAgaWQ6ICdleHRyYWN0LWVudGl0aWVzLWZvbGRlcicsXG4gICAgICAgICAgICBuYW1lOiAnRXh0cmFjdCBlbnRpdGllcyBmcm9tIGFsbCBub3RlcyBpbiBjdXJyZW50IGZvbGRlcicsXG4gICAgICAgICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgICAgICAgICAgICBpZiAoZmlsZSAmJiBmaWxlLmV4dGVuc2lvbiA9PT0gJ21kJykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNoZWNraW5nKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5ydW5CYXRjaEV4dHJhY3Rpb24oKS5jYXRjaCgoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0VudGl0eSBFeHRyYWN0b3I6JywgZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0JhdGNoIGV4dHJhY3Rpb24gZXJyb3I6ICcgKyAoZS5tZXNzYWdlIHx8IGUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxMDAwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IEVudGl0eUV4dHJhY3RvclNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgICB9XG5cbiAgICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKFxuICAgICAgICAgICAge30sXG4gICAgICAgICAgICBERUZBVUxUX1NFVFRJTkdTLFxuICAgICAgICAgICAgYXdhaXQgdGhpcy5sb2FkRGF0YSgpLFxuICAgICAgICApO1xuICAgIH1cblxuICAgIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcbiAgICB9XG5cbiAgICBhc3luYyBnZXRBcGlLZXkoKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgICAgIGNvbnN0IHMgPSB0aGlzLnNldHRpbmdzO1xuICAgICAgICBpZiAoIXMuZW5jcnlwdGVkQXBpS2V5IHx8ICFzLmVuY3J5cHRpb25LZXkgfHwgIXMuaXYpIHJldHVybiBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGRlY3J5cHRTdHIocy5lbmNyeXB0ZWRBcGlLZXksIHMuaXYsIHMuZW5jcnlwdGlvbktleSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBzZXRBcGlLZXkocGxhaW46IHN0cmluZykge1xuICAgICAgICBpZiAoIXRoaXMuc2V0dGluZ3MuZW5jcnlwdGlvbktleSkge1xuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5lbmNyeXB0aW9uS2V5ID0gYXdhaXQgZ2VuZXJhdGVFbmNLZXkoKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBlbmNyeXB0U3RyKHBsYWluLCB0aGlzLnNldHRpbmdzLmVuY3J5cHRpb25LZXkpO1xuICAgICAgICB0aGlzLnNldHRpbmdzLmVuY3J5cHRlZEFwaUtleSA9IHJlc3VsdC5jdDtcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5pdiA9IHJlc3VsdC5pdjtcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICB9XG5cbiAgICBhc3luYyBjbGVhckFwaUtleSgpIHtcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5lbmNyeXB0ZWRBcGlLZXkgPSAnJztcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5pdiA9ICcnO1xuICAgICAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgIH1cblxuICAgIGFzeW5jIF9hcGlGZXRjaChhcGlLZXk6IHN0cmluZywgYm9keTogb2JqZWN0KTogUHJvbWlzZTxBcGlSZXNwb25zZT4ge1xuICAgICAgICBjb25zdCBodHRwcyA9IHJlcXVpcmUoJ2h0dHBzJyk7XG4gICAgICAgIGNvbnN0IHBvc3REYXRhID0gSlNPTi5zdHJpbmdpZnkoYm9keSk7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIGhvc3RuYW1lOiAnYXBpLmFudGhyb3BpYy5jb20nLFxuICAgICAgICAgICAgICAgIHBhdGg6ICcvdjEvbWVzc2FnZXMnLFxuICAgICAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICAgICAgJ3gtYXBpLWtleSc6IGFwaUtleSxcbiAgICAgICAgICAgICAgICAgICAgJ2FudGhyb3BpYy12ZXJzaW9uJzogJzIwMjMtMDYtMDEnLFxuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1MZW5ndGgnOiBCdWZmZXIuYnl0ZUxlbmd0aChwb3N0RGF0YSksXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCByZXEgPSBodHRwcy5yZXF1ZXN0KFxuICAgICAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICAgICAgKHJlczogeyBzdGF0dXNDb2RlOiBudW1iZXI7IG9uOiBGdW5jdGlvbiB9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNodW5rczogQnVmZmVyW10gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgcmVzLm9uKCdkYXRhJywgKGNodW5rOiBCdWZmZXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNodW5rcy5wdXNoKGNodW5rKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gQnVmZmVyLmNvbmNhdChjaHVua3MpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKHJhdyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA+PSAyMDAgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPCAzMDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtc2cgPVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRhdGEuZXJyb3IgJiYgZGF0YS5lcnJvci5tZXNzYWdlKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0hUVFAgJyArIHJlcy5zdGF0dXNDb2RlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKG1zZykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0ludmFsaWQgcmVzcG9uc2U6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJhdy5zdWJzdHJpbmcoMCwgMjAwKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJlcS5vbignZXJyb3InLCAoZTogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdOZXR3b3JrIGVycm9yOiAnICsgZS5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJlcS5zZXRUaW1lb3V0KDEyMDAwMCwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlcS5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignUmVxdWVzdCB0aW1lZCBvdXQnKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJlcS53cml0ZShwb3N0RGF0YSk7XG4gICAgICAgICAgICByZXEuZW5kKCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGFzeW5jIGNhbGxDbGF1ZGUoXG4gICAgICAgIGFwaUtleTogc3RyaW5nLFxuICAgICAgICBjb250ZW50OiBzdHJpbmcsXG4gICAgICAgIHByb21wdFRlbXBsYXRlOiBzdHJpbmcsXG4gICAgKTogUHJvbWlzZTxFeHRyYWN0aW9uRGF0YT4ge1xuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5fYXBpRmV0Y2goYXBpS2V5LCB7XG4gICAgICAgICAgICBtb2RlbDogdGhpcy5zZXR0aW5ncy5tb2RlbCxcbiAgICAgICAgICAgIG1heF90b2tlbnM6IDgxOTIsXG4gICAgICAgICAgICBzeXN0ZW06IFNZU1RFTV9QUk9NUFQsXG4gICAgICAgICAgICBtZXNzYWdlczogW3sgcm9sZTogJ3VzZXInLCBjb250ZW50OiBwcm9tcHRUZW1wbGF0ZSArIGNvbnRlbnQgfV0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxldCB0ZXh0OiBzdHJpbmc7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0ZXh0ID0gZGF0YS5jb250ZW50WzBdLnRleHQudHJpbSgpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgICAgJ0VudGl0eSBFeHRyYWN0b3I6IHVuZXhwZWN0ZWQgcmVzcG9uc2Ugc2hhcGU6JyxcbiAgICAgICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBBUEkgcmVzcG9uc2UgZm9ybWF0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRleHQuc3RhcnRzV2l0aCgnYGBgJykpIHtcbiAgICAgICAgICAgIHRleHQgPSB0ZXh0XG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoL15gYGBcXHcqXFxuPy8sICcnKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXG4/YGBgJC8sICcnKVxuICAgICAgICAgICAgICAgIC50cmltKCk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKHRleHQpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgICAgJ0VudGl0eSBFeHRyYWN0b3I6IGZhaWxlZCB0byBwYXJzZSBKU09OIGZyb20gQ2xhdWRlOicsXG4gICAgICAgICAgICAgICAgdGV4dC5zdWJzdHJpbmcoMCwgNTAwKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NsYXVkZSByZXR1cm5lZCBpbnZhbGlkIEpTT04gXHUyMDE0IHRyeSBhZ2FpbicpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTx7IG9rOiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmcgfT4ge1xuICAgICAgICBjb25zdCBhcGlLZXkgPSBhd2FpdCB0aGlzLmdldEFwaUtleSgpO1xuICAgICAgICBpZiAoIWFwaUtleSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBtZXNzYWdlOiAnTm8gQVBJIGtleSBjb25maWd1cmVkJyB9O1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLl9hcGlGZXRjaChhcGlLZXksIHtcbiAgICAgICAgICAgICAgICBtb2RlbDogdGhpcy5zZXR0aW5ncy5tb2RlbCxcbiAgICAgICAgICAgICAgICBtYXhfdG9rZW5zOiAxNixcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogW3sgcm9sZTogJ3VzZXInLCBjb250ZW50OiAnU2F5IFwib2tcIicgfV0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgb2s6IHRydWUsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ0Nvbm5lY3RlZCEgTW9kZWw6ICcgKyB0aGlzLnNldHRpbmdzLm1vZGVsLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIG1lc3NhZ2U6IGUubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZW5zdXJlRm9sZGVyKHBhdGg6IHN0cmluZykge1xuICAgICAgICBpZiAoIXRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKSkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlRm9sZGVyKHBhdGgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgY3JlYXRlT3JNZXJnZU5vdGUoXG4gICAgICAgIHR5cGU6IHN0cmluZyxcbiAgICAgICAgZW50aXR5OiBFbnRpdHksXG4gICAgICAgIHNvdXJjZVRpdGxlOiBzdHJpbmcsXG4gICAgICAgIHNvdXJjZVR5cGU6IFNvdXJjZVR5cGUsXG4gICAgICAgIGRyeVJ1bjogYm9vbGVhbixcbiAgICApOiBQcm9taXNlPHsgYWN0aW9uOiBzdHJpbmc7IHBhdGg6IHN0cmluZzsgY291bnQ/OiBudW1iZXIgfT4ge1xuICAgICAgICBjb25zdCBmb2xkZXIgPSB0eXBlID09PSAncGVyc29uJyA/ICdQZW9wbGUnIDogJ0NvbmNlcHRzJztcbiAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBzYW5pdGl6ZUZpbGVuYW1lKGVudGl0eS5uYW1lKTtcbiAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlciArICcvJyArIGZpbGVuYW1lICsgJy5tZCc7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xuXG4gICAgICAgIGlmIChleGlzdGluZyAmJiBleGlzdGluZyBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChleGlzdGluZyk7XG5cbiAgICAgICAgICAgIGlmIChjb250ZW50LmluY2x1ZGVzKCdbWycgKyBzb3VyY2VUaXRsZSArICddXScpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnc2tpcCcsIHBhdGggfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFkcnlSdW4pIHtcbiAgICAgICAgICAgICAgICBsZXQgdXBkYXRlZCA9IGNvbnRlbnQ7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3U2VjdGlvbiA9IGZvcm1hdFJlYWRpbmdTZWN0aW9uKFxuICAgICAgICAgICAgICAgICAgICBzb3VyY2VUaXRsZSxcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LmhpZ2hsaWdodHMsXG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZVR5cGUsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBjb25zdCBtZW50aW9uZWRMaW5lID0gJy0gW1snICsgc291cmNlVGl0bGUgKyAnXV0gKCcgKyBzb3VyY2VUeXBlICsgJyknO1xuXG4gICAgICAgICAgICAgICAgLy8gSW5zZXJ0IG5ldyBzb3VyY2Ugc2VjdGlvbiBcdTIwMTQgY2hlY2sgZm9yIG5ldyBoZWFkaW5nIGZpcnN0LCBmYWxsIGJhY2sgdG8gbGVnYWN5XG4gICAgICAgICAgICAgICAgaWYgKHVwZGF0ZWQuaW5jbHVkZXMoJyMjIENvbm5lY3RlZCBUbycpKSB7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQgPSB1cGRhdGVkLnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAnIyMgQ29ubmVjdGVkIFRvJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1NlY3Rpb24gKyAnXFxuIyMgQ29ubmVjdGVkIFRvJyxcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHVwZGF0ZWQuaW5jbHVkZXMoJyMjIFNvdXJjZXMnKSkge1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVkICs9ICdcXG4nICsgbmV3U2VjdGlvbjtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHVwZGF0ZWQuaW5jbHVkZXMoJyMjIEZyb20gTXkgUmVhZGluZycpKSB7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQgKz0gJ1xcbicgKyBuZXdTZWN0aW9uO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghdXBkYXRlZC5pbmNsdWRlcygnW1snICsgc291cmNlVGl0bGUgKyAnXV0nKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodXBkYXRlZC5pbmNsdWRlcygnIyMgTWVudGlvbmVkIEluJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQgPSB1cGRhdGVkLnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJyMjIE1lbnRpb25lZCBJbicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJyMjIE1lbnRpb25lZCBJblxcbicgKyBtZW50aW9uZWRMaW5lLFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQgKz1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnXFxuXFxuIyMgTWVudGlvbmVkIEluXFxuJyArIG1lbnRpb25lZExpbmUgKyAnXFxuJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEFkZCBzb3VyY2UgdHlwZSB0byBmcm9udG1hdHRlciBpZiBub3QgYWxyZWFkeSBwcmVzZW50XG4gICAgICAgICAgICAgICAgaWYgKCF1cGRhdGVkLmluY2x1ZGVzKCcgIC0gJyArIHNvdXJjZVR5cGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQgPSB1cGRhdGVkLnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAvXihzb3VyY2UtdHlwZXM6XFxuKS9tLFxuICAgICAgICAgICAgICAgICAgICAgICAgJyQxICAtICcgKyBzb3VyY2VUeXBlICsgJ1xcbicsXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KGV4aXN0aW5nLCB1cGRhdGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ21lcmdlJywgcGF0aCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFkcnlSdW4pIHtcbiAgICAgICAgICAgIGNvbnN0IG5vdGUgPSBidWlsZEVudGl0eU5vdGUodHlwZSwgZW50aXR5LCBzb3VyY2VUaXRsZSwgc291cmNlVHlwZSk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUocGF0aCwgbm90ZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGFjdGlvbjogJ2NyZWF0ZScsXG4gICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgY291bnQ6IChlbnRpdHkuaGlnaGxpZ2h0cyB8fCBbXSkubGVuZ3RoLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGFzeW5jIHJ1bkV4dHJhY3Rpb24oZmlsZTogVEZpbGUsIGRyeVJ1bjogYm9vbGVhbikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXBpS2V5ID0gYXdhaXQgdGhpcy5nZXRBcGlLZXkoKTtcbiAgICAgICAgICAgIGlmICghYXBpS2V5KSB7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgJ05vIEFQSSBrZXkgY29uZmlndXJlZC4gR28gdG8gU2V0dGluZ3MgXHUyMTkyIEVudGl0eSBFeHRyYWN0b3IgdG8gYWRkIHlvdXIgQW50aHJvcGljIEFQSSBrZXkuJyxcbiAgICAgICAgICAgICAgICAgICAgODAwMCxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZVNvdXJjZU5vdGUoY29udGVudCwgZmlsZS5wYXRoKTtcbiAgICAgICAgICAgIGNvbnN0IHsgdGl0bGUsIHNvdXJjZVR5cGUsIHJlZnMgfSA9IHBhcnNlZDtcbiAgICAgICAgICAgIGNvbnN0IGhhc1JlZnMgPSByZWZzLnNpemUgPiAwO1xuXG4gICAgICAgICAgICBpZiAoIXBhcnNlZC5oYXNIaWdobGlnaHRzKSB7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgJ05vIGhpZ2hsaWdodHMgZm91bmQgaW4gdGhpcyBub3RlLicsXG4gICAgICAgICAgICAgICAgICAgIDUwMDAsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHByb21wdFRlbXBsYXRlID0gYnVpbGRFeHRyYWN0aW9uUHJvbXB0KHNvdXJjZVR5cGUsIGhhc1JlZnMpO1xuXG4gICAgICAgICAgICBjb25zdCBtb2RlID0gZHJ5UnVuID8gJyAoRFJZIFJVTiknIDogJyc7XG4gICAgICAgICAgICBuZXcgTm90aWNlKFxuICAgICAgICAgICAgICAgICdFeHRyYWN0aW5nIGVudGl0aWVzIGZyb20gXCInICsgdGl0bGUgKyAnXCIgKCcgKyBzb3VyY2VUeXBlICsgJykuLi4nICsgbW9kZSxcbiAgICAgICAgICAgICAgICA1MDAwLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgbGV0IGRhdGE6IEV4dHJhY3Rpb25EYXRhO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBkYXRhID0gYXdhaXQgdGhpcy5jYWxsQ2xhdWRlKGFwaUtleSwgY29udGVudCwgcHJvbXB0VGVtcGxhdGUpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgJ0FQSSBjYWxsIGZhaWxlZDogJyArIChlLm1lc3NhZ2UgfHwgZSksXG4gICAgICAgICAgICAgICAgICAgIDEwMDAwLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwZW9wbGUgPSBkYXRhLnBlb3BsZSB8fCBbXTtcbiAgICAgICAgICAgIGNvbnN0IGNvbmNlcHRzID0gZGF0YS5jb25jZXB0cyB8fCBbXTtcblxuICAgICAgICAgICAgaWYgKGhhc1JlZnMpIHtcbiAgICAgICAgICAgICAgICBbcGVvcGxlLCBjb25jZXB0c10uZm9yRWFjaCgobGlzdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsaXN0LmZvckVhY2goKGVudGl0eSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZW50aXR5LmhpZ2hsaWdodHMgPSAoZW50aXR5LmhpZ2hsaWdodHMgfHwgW10pLmZpbHRlcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoaCkgPT4gaC5yZWYgIT0gbnVsbCAmJiByZWZzLmhhcyhoLnJlZiksXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAnRm91bmQgJyArXG4gICAgICAgICAgICAgICAgICAgIHBlb3BsZS5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAnIHBlb3BsZSwgJyArXG4gICAgICAgICAgICAgICAgICAgIGNvbmNlcHRzLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgICcgY29uY2VwdHMuJyArXG4gICAgICAgICAgICAgICAgICAgIG1vZGUsXG4gICAgICAgICAgICAgICAgNTAwMCxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IEV4dHJhY3Rpb25SZXN1bHRbXSA9IFtdO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAoIWRyeVJ1bikge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZUZvbGRlcignUGVvcGxlJyk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuZW5zdXJlRm9sZGVyKCdDb25jZXB0cycpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcGVyc29uIG9mIHBlb3BsZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByID0gYXdhaXQgdGhpcy5jcmVhdGVPck1lcmdlTm90ZShcbiAgICAgICAgICAgICAgICAgICAgICAgICdwZXJzb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGVyc29uLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZHJ5UnVuLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcGVyc29uLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAncGVyc29uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnIsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNvbmNlcHQgb2YgY29uY2VwdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgciA9IGF3YWl0IHRoaXMuY3JlYXRlT3JNZXJnZU5vdGUoXG4gICAgICAgICAgICAgICAgICAgICAgICAnY29uY2VwdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25jZXB0LFxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZHJ5UnVuLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogY29uY2VwdC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NvbmNlcHQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgLi4ucixcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCcjIyBFbnRpdGllcycpICYmICFkcnlSdW4pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcExpbmtzID0gcGVvcGxlXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKChwKSA9PiAnW1snICsgcC5uYW1lICsgJ11dJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5qb2luKCcsICcpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjTGlua3MgPSBjb25jZXB0c1xuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgoYykgPT4gJ1tbJyArIGMubmFtZSArICddXScpXG4gICAgICAgICAgICAgICAgICAgICAgICAuam9pbignLCAnKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3VtbWFyeSA9XG4gICAgICAgICAgICAgICAgICAgICAgICAnXFxuIyMgRW50aXRpZXNcXG5cXG4qKlBlb3BsZToqKiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBMaW5rcyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnXFxuXFxuKipDb25jZXB0czoqKiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNMaW5rcyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnXFxuJztcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KGZpbGUsIGNvbnRlbnQgKyBzdW1tYXJ5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFbnRpdHkgRXh0cmFjdG9yOiBlcnJvciBjcmVhdGluZyBub3RlczonLCBlKTtcbiAgICAgICAgICAgICAgICBuZXcgTm90aWNlKFxuICAgICAgICAgICAgICAgICAgICAnRXJyb3IgY3JlYXRpbmcgbm90ZXM6ICcgKyAoZS5tZXNzYWdlIHx8IGUpLFxuICAgICAgICAgICAgICAgICAgICAxMDAwMCxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBtb2RhbCA9IG5ldyBSZXN1bHRzTW9kYWwodGhpcy5hcHAsIHRpdGxlLCByZXN1bHRzLCBkcnlSdW4pO1xuICAgICAgICAgICAgbW9kYWwub3BlbigpO1xuICAgICAgICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0VudGl0eSBFeHRyYWN0b3I6IHVuZXhwZWN0ZWQgZXJyb3I6JywgZSk7XG4gICAgICAgICAgICBuZXcgTm90aWNlKFxuICAgICAgICAgICAgICAgICdFbnRpdHkgZXh0cmFjdGlvbiBlcnJvcjogJyArIChlLm1lc3NhZ2UgfHwgZSksXG4gICAgICAgICAgICAgICAgMTAwMDAsXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgcnVuQmF0Y2hFeHRyYWN0aW9uKCkge1xuICAgICAgICBjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgICAgaWYgKCFhY3RpdmVGaWxlKSB7XG4gICAgICAgICAgICBuZXcgTm90aWNlKCdObyBhY3RpdmUgZmlsZSBcdTIwMTQgb3BlbiBhIGZpbGUgaW4gdGhlIHRhcmdldCBmb2xkZXIgZmlyc3QuJywgNTAwMCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhcGlLZXkgPSBhd2FpdCB0aGlzLmdldEFwaUtleSgpO1xuICAgICAgICBpZiAoIWFwaUtleSkge1xuICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAnTm8gQVBJIGtleSBjb25maWd1cmVkLiBHbyB0byBTZXR0aW5ncyBcdTIxOTIgRW50aXR5IEV4dHJhY3Rvci4nLFxuICAgICAgICAgICAgICAgIDgwMDAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGFyZW50UGF0aCA9IGFjdGl2ZUZpbGUucGFyZW50Py5wYXRoIHx8ICcnO1xuICAgICAgICBjb25zdCBhbGxGaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKS5maWx0ZXIoXG4gICAgICAgICAgICAoZikgPT4gZi5wYXJlbnQ/LnBhdGggPT09IHBhcmVudFBhdGgsXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gRmlsdGVyIHRvIGZpbGVzIHRoYXQgaGF2ZW4ndCBiZWVuIHByb2Nlc3NlZCB5ZXRcbiAgICAgICAgY29uc3QgdG9Qcm9jZXNzOiBURmlsZVtdID0gW107XG4gICAgICAgIGZvciAoY29uc3QgZiBvZiBhbGxGaWxlcykge1xuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZik7XG4gICAgICAgICAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoJyMjIEVudGl0aWVzJykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZVNvdXJjZU5vdGUoY29udGVudCwgZi5wYXRoKTtcbiAgICAgICAgICAgICAgICBpZiAocGFyc2VkLmhhc0hpZ2hsaWdodHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdG9Qcm9jZXNzLnB1c2goZik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRvUHJvY2Vzcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoJ05vIHVucHJvY2Vzc2VkIG5vdGVzIHdpdGggaGlnaGxpZ2h0cyBmb3VuZCBpbiAnICsgKHBhcmVudFBhdGggfHwgJ3Jvb3QnKSwgNTAwMCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBuZXcgTm90aWNlKFxuICAgICAgICAgICAgJ0JhdGNoIGV4dHJhY3Rpb246ICcgKyB0b1Byb2Nlc3MubGVuZ3RoICsgJyBub3RlcyBpbiAnICsgKHBhcmVudFBhdGggfHwgJ3Jvb3QnKSArICcuIFN0YXJ0aW5nLi4uJyxcbiAgICAgICAgICAgIDUwMDAsXG4gICAgICAgICk7XG5cbiAgICAgICAgbGV0IHByb2Nlc3NlZCA9IDA7XG4gICAgICAgIGxldCBlcnJvcnMgPSAwO1xuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgdG9Qcm9jZXNzKSB7XG4gICAgICAgICAgICBwcm9jZXNzZWQrKztcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgJ1Byb2Nlc3NpbmcgJyArIHByb2Nlc3NlZCArICcvJyArIHRvUHJvY2Vzcy5sZW5ndGggKyAnOiAnICsgZmlsZS5iYXNlbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgMzAwMCxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucnVuRXh0cmFjdGlvbihmaWxlLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgLy8gUmF0ZSBsaW1pdCBkZWxheSBcdTIwMTQgMiBzZWNvbmRzIGJldHdlZW4gQVBJIGNhbGxzXG4gICAgICAgICAgICAgICAgaWYgKHByb2Nlc3NlZCA8IHRvUHJvY2Vzcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgMjAwMCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgICAgICAgICAgIGVycm9ycysrO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0VudGl0eSBFeHRyYWN0b3I6IGJhdGNoIGVycm9yIG9uICcgKyBmaWxlLnBhdGgsIGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICdCYXRjaCBjb21wbGV0ZTogJyArIHByb2Nlc3NlZCArICcgcHJvY2Vzc2VkLCAnICsgZXJyb3JzICsgJyBlcnJvcnMuJyxcbiAgICAgICAgICAgIDgwMDAsXG4gICAgICAgICk7XG4gICAgfVxufVxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFJlc3VsdHMgTW9kYWxcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5jbGFzcyBSZXN1bHRzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gICAgcHJpdmF0ZSBzb3VyY2VUaXRsZTogc3RyaW5nO1xuICAgIHByaXZhdGUgcmVzdWx0czogRXh0cmFjdGlvblJlc3VsdFtdO1xuICAgIHByaXZhdGUgZHJ5UnVuOiBib29sZWFuO1xuXG4gICAgY29uc3RydWN0b3IoXG4gICAgICAgIGFwcDogQXBwLFxuICAgICAgICBzb3VyY2VUaXRsZTogc3RyaW5nLFxuICAgICAgICByZXN1bHRzOiBFeHRyYWN0aW9uUmVzdWx0W10sXG4gICAgICAgIGRyeVJ1bjogYm9vbGVhbixcbiAgICApIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcbiAgICAgICAgdGhpcy5zb3VyY2VUaXRsZSA9IHNvdXJjZVRpdGxlO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xuICAgICAgICB0aGlzLmRyeVJ1biA9IGRyeVJ1bjtcbiAgICB9XG5cbiAgICBvbk9wZW4oKSB7XG4gICAgICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgICAgICBjb25zdCBjcmVhdGVkID0gdGhpcy5yZXN1bHRzLmZpbHRlcihcbiAgICAgICAgICAgIChyKSA9PiByLmFjdGlvbiA9PT0gJ2NyZWF0ZScsXG4gICAgICAgICkubGVuZ3RoO1xuICAgICAgICBjb25zdCBtZXJnZWQgPSB0aGlzLnJlc3VsdHMuZmlsdGVyKFxuICAgICAgICAgICAgKHIpID0+IHIuYWN0aW9uID09PSAnbWVyZ2UnLFxuICAgICAgICApLmxlbmd0aDtcbiAgICAgICAgY29uc3Qgc2tpcHBlZCA9IHRoaXMucmVzdWx0cy5maWx0ZXIoXG4gICAgICAgICAgICAocikgPT4gci5hY3Rpb24gPT09ICdza2lwJyxcbiAgICAgICAgKS5sZW5ndGg7XG5cbiAgICAgICAgY29uc3QgaGVhZGluZyA9IHRoaXMuZHJ5UnVuXG4gICAgICAgICAgICA/ICdEcnkgUnVuOiAnICsgdGhpcy5zb3VyY2VUaXRsZVxuICAgICAgICAgICAgOiAnRXh0cmFjdGlvbiBDb21wbGV0ZSc7XG4gICAgICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6IGhlYWRpbmcgfSk7XG5cbiAgICAgICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGlmIChjcmVhdGVkID4gMCkgcGFydHMucHVzaChjcmVhdGVkICsgJyBjcmVhdGVkJyk7XG4gICAgICAgIGlmIChtZXJnZWQgPiAwKSBwYXJ0cy5wdXNoKG1lcmdlZCArICcgbWVyZ2VkJyk7XG4gICAgICAgIGlmIChza2lwcGVkID4gMCkgcGFydHMucHVzaChza2lwcGVkICsgJyBza2lwcGVkJyk7XG4gICAgICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHtcbiAgICAgICAgICAgIHRleHQ6IHRoaXMuZHJ5UnVuXG4gICAgICAgICAgICAgICAgPyAnV291bGQgcHJvY2VzcyAnICtcbiAgICAgICAgICAgICAgICAgIHRoaXMucmVzdWx0cy5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgJyBlbnRpdGllcyBmcm9tICcgK1xuICAgICAgICAgICAgICAgICAgdGhpcy5zb3VyY2VUaXRsZVxuICAgICAgICAgICAgICAgIDogcGFydHMuam9pbignLCAnKSArICcgXHUyMDE0IGZyb20gJyArIHRoaXMuc291cmNlVGl0bGUsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHBlb3BsZSA9IHRoaXMucmVzdWx0cy5maWx0ZXIoKHIpID0+IHIudHlwZSA9PT0gJ3BlcnNvbicpO1xuICAgICAgICBjb25zdCBjb25jZXB0cyA9IHRoaXMucmVzdWx0cy5maWx0ZXIoKHIpID0+IHIudHlwZSA9PT0gJ2NvbmNlcHQnKTtcblxuICAgICAgICBpZiAocGVvcGxlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDMnLCB7XG4gICAgICAgICAgICAgICAgdGV4dDogJ1Blb3BsZSAoJyArIHBlb3BsZS5sZW5ndGggKyAnKScsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IHBMaXN0ID0gY29udGVudEVsLmNyZWF0ZUVsKCd1bCcpO1xuICAgICAgICAgICAgcGVvcGxlLmZvckVhY2goKHIpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaSA9IHBMaXN0LmNyZWF0ZUVsKCdsaScpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhZGdlID1cbiAgICAgICAgICAgICAgICAgICAgci5hY3Rpb24gPT09ICdjcmVhdGUnXG4gICAgICAgICAgICAgICAgICAgICAgICA/ICcrICdcbiAgICAgICAgICAgICAgICAgICAgICAgIDogci5hY3Rpb24gPT09ICdtZXJnZSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPyAnfiAnXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDogJz0gJztcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZHJ5UnVuICYmIHIuYWN0aW9uICE9PSAnc2tpcCcpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluayA9IGxpLmNyZWF0ZUVsKCdhJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dDogYmFkZ2UgKyByLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjbHM6ICdpbnRlcm5hbC1saW5rJyxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGxpbmsuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChyLnBhdGgsICcnLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxpLnNldFRleHQoYmFkZ2UgKyByLm5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbmNlcHRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDMnLCB7XG4gICAgICAgICAgICAgICAgdGV4dDogJ0NvbmNlcHRzICgnICsgY29uY2VwdHMubGVuZ3RoICsgJyknLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBjTGlzdCA9IGNvbnRlbnRFbC5jcmVhdGVFbCgndWwnKTtcbiAgICAgICAgICAgIGNvbmNlcHRzLmZvckVhY2goKHIpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaSA9IGNMaXN0LmNyZWF0ZUVsKCdsaScpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhZGdlID1cbiAgICAgICAgICAgICAgICAgICAgci5hY3Rpb24gPT09ICdjcmVhdGUnXG4gICAgICAgICAgICAgICAgICAgICAgICA/ICcrICdcbiAgICAgICAgICAgICAgICAgICAgICAgIDogci5hY3Rpb24gPT09ICdtZXJnZSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPyAnfiAnXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDogJz0gJztcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZHJ5UnVuICYmIHIuYWN0aW9uICE9PSAnc2tpcCcpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluayA9IGxpLmNyZWF0ZUVsKCdhJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dDogYmFkZ2UgKyByLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjbHM6ICdpbnRlcm5hbC1saW5rJyxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGxpbmsuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChyLnBhdGgsICcnLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxpLnNldFRleHQoYmFkZ2UgKyByLm5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbGVnZW5kID0gdGhpcy5kcnlSdW5cbiAgICAgICAgICAgID8gJ1J1biB3aXRob3V0IFwiZHJ5IHJ1blwiIHRvIGNyZWF0ZSB0aGVzZSBub3Rlcy4nXG4gICAgICAgICAgICA6ICcrIGNyZWF0ZWQsIH4gbWVyZ2VkIHdpdGggZXhpc3RpbmcsID0gYWxyZWFkeSBoYWQgdGhpcyBzb3VyY2UnO1xuICAgICAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7XG4gICAgICAgICAgICB0ZXh0OiBsZWdlbmQsXG4gICAgICAgICAgICBjbHM6ICdzZXR0aW5nLWl0ZW0tZGVzY3JpcHRpb24nLFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBvbkNsb3NlKCkge1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIH1cbn1cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTZXR0aW5ncyBUYWJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5jbGFzcyBFbnRpdHlFeHRyYWN0b3JTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gICAgcGx1Z2luOiBFbnRpdHlFeHRyYWN0b3JQbHVnaW47XG5cbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBFbnRpdHlFeHRyYWN0b3JQbHVnaW4pIHtcbiAgICAgICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB9XG5cbiAgICBkaXNwbGF5KCkge1xuICAgICAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgICAgICBjb25zdCB7IHBsdWdpbiB9ID0gdGhpcztcbiAgICAgICAgY29udGFpbmVyRWwuZW1wdHkoKTtcblxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdFbnRpdHkgRXh0cmFjdG9yJyB9KTtcblxuICAgICAgICBjb25zdCBoYXNLZXkgPSAhIXBsdWdpbi5zZXR0aW5ncy5lbmNyeXB0ZWRBcGlLZXk7XG5cbiAgICAgICAgbGV0IGFwaUtleUlucHV0OiBhbnk7XG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoJ0FudGhyb3BpYyBBUEkga2V5JylcbiAgICAgICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgICAgICAgIGhhc0tleVxuICAgICAgICAgICAgICAgICAgICA/ICdBUEkga2V5IGlzIHNhdmVkIGFuZCBlbmNyeXB0ZWQgYXQgcmVzdC4gRW50ZXIgYSBuZXcgdmFsdWUgdG8gcmVwbGFjZSBpdC4nXG4gICAgICAgICAgICAgICAgICAgIDogJ0VudGVyIHlvdXIgQVBJIGtleSBmcm9tIGNvbnNvbGUuYW50aHJvcGljLmNvbS4gSXQgd2lsbCBiZSBlbmNyeXB0ZWQgYXQgcmVzdC4nLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmFkZFRleHQoKHRleHQpID0+IHtcbiAgICAgICAgICAgICAgICBhcGlLZXlJbnB1dCA9IHRleHQ7XG4gICAgICAgICAgICAgICAgdGV4dC5pbnB1dEVsLnR5cGUgPSAncGFzc3dvcmQnO1xuICAgICAgICAgICAgICAgIHRleHQuaW5wdXRFbC5zdHlsZS53aWR0aCA9ICczMDBweCc7XG4gICAgICAgICAgICAgICAgdGV4dC5zZXRQbGFjZWhvbGRlcihcbiAgICAgICAgICAgICAgICAgICAgaGFzS2V5XG4gICAgICAgICAgICAgICAgICAgICAgICA/ICdcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyJ1xuICAgICAgICAgICAgICAgICAgICAgICAgOiAnc2stYW50LS4uLicsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuYWRkQnV0dG9uKChidG4pID0+IHtcbiAgICAgICAgICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnU2F2ZSBrZXknKVxuICAgICAgICAgICAgICAgICAgICAuc2V0Q3RhKClcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBhcGlLZXlJbnB1dC5nZXRWYWx1ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlICYmIHZhbHVlLmxlbmd0aCA+IDEwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgcGx1Z2luLnNldEFwaUtleSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBpS2V5SW5wdXQuc2V0VmFsdWUoJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwaUtleUlucHV0LnNldFBsYWNlaG9sZGVyKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgTm90aWNlKCdBUEkga2V5IHNhdmVkIChlbmNyeXB0ZWQpJywgMzAwMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdQbGVhc2UgZW50ZXIgYSB2YWxpZCBBUEkga2V5JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMzAwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChoYXNLZXkpIHtcbiAgICAgICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgICAgIC5zZXROYW1lKCdDbGVhciBBUEkga2V5JylcbiAgICAgICAgICAgICAgICAuc2V0RGVzYygnUmVtb3ZlIHRoZSBzdG9yZWQgQVBJIGtleScpXG4gICAgICAgICAgICAgICAgLmFkZEJ1dHRvbigoYnRuKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdDbGVhcicpXG4gICAgICAgICAgICAgICAgICAgICAgICAuc2V0V2FybmluZygpXG4gICAgICAgICAgICAgICAgICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgcGx1Z2luLmNsZWFyQXBpS2V5KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZSgnQVBJIGtleSBjbGVhcmVkJywgMzAwMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChoYXNLZXkpIHtcbiAgICAgICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgICAgIC5zZXROYW1lKCdUZXN0IGNvbm5lY3Rpb24nKVxuICAgICAgICAgICAgICAgIC5zZXREZXNjKCdWZXJpZnkgeW91ciBBUEkga2V5IGFuZCBtb2RlbCB3b3JrJylcbiAgICAgICAgICAgICAgICAuYWRkQnV0dG9uKChidG4pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1Rlc3QnKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdUZXN0aW5nLi4uJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBidG4uc2V0RGlzYWJsZWQodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwbHVnaW4udGVzdENvbm5lY3Rpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ0bi5zZXREaXNhYmxlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0Lm9rKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ09LIScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UocmVzdWx0Lm1lc3NhZ2UsIDUwMDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnRmFpbGVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0Nvbm5lY3Rpb24gZmFpbGVkOiAnICsgcmVzdWx0Lm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDgwMDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdUZXN0Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCAzMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgICAgIC5zZXROYW1lKCdNb2RlbCcpXG4gICAgICAgICAgICAuc2V0RGVzYygnQ2xhdWRlIG1vZGVsIHRvIHVzZSBmb3IgZXh0cmFjdGlvbicpXG4gICAgICAgICAgICAuYWRkRHJvcGRvd24oKGRkKSA9PiB7XG4gICAgICAgICAgICAgICAgZGQuYWRkT3B0aW9uKFxuICAgICAgICAgICAgICAgICAgICAnY2xhdWRlLXNvbm5ldC00LTYnLFxuICAgICAgICAgICAgICAgICAgICAnQ2xhdWRlIFNvbm5ldCA0IChyZWNvbW1lbmRlZCknLFxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgLmFkZE9wdGlvbihcbiAgICAgICAgICAgICAgICAgICAgICAgICdjbGF1ZGUtaGFpa3UtNC01JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdDbGF1ZGUgSGFpa3UgNC41IChmYXN0ZXIvY2hlYXBlciknLFxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIC5hZGRPcHRpb24oXG4gICAgICAgICAgICAgICAgICAgICAgICAnY2xhdWRlLW9wdXMtNC02JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdDbGF1ZGUgT3B1cyA0LjYgKG1vc3QgY2FwYWJsZSknLFxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIC5zZXRWYWx1ZShwbHVnaW4uc2V0dGluZ3MubW9kZWwpXG4gICAgICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsdWdpbi5zZXR0aW5ncy5tb2RlbCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgcGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ1VzYWdlJyB9KTtcbiAgICAgICAgY29uc3QgdXNhZ2UgPSBjb250YWluZXJFbC5jcmVhdGVFbCgnZGl2Jyk7XG4gICAgICAgIHVzYWdlLmNyZWF0ZUVsKCdvbCcsIHt9LCAob2wpID0+IHtcbiAgICAgICAgICAgIG9sLmNyZWF0ZUVsKCdsaScsIHtcbiAgICAgICAgICAgICAgICB0ZXh0OiAnT3BlbiBhIG5vdGUgd2l0aCBoaWdobGlnaHRzIChib29rcywgYXJ0aWNsZXMsIHBhcGVycywgcG9kY2FzdHMsIHZpZGVvcyknLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBvbC5jcmVhdGVFbCgnbGknLCB7IHRleHQ6ICdPcGVuIENvbW1hbmQgUGFsZXR0ZSAoQ21kL0N0cmwgKyBQKScgfSk7XG4gICAgICAgICAgICBvbC5jcmVhdGVFbCgnbGknLCB7XG4gICAgICAgICAgICAgICAgdGV4dDogJ1J1biBcIkVudGl0eSBFeHRyYWN0b3I6IEV4dHJhY3QgZW50aXRpZXMgZnJvbSBjdXJyZW50IG5vdGVcIicsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIG9sLmNyZWF0ZUVsKCdsaScsIHtcbiAgICAgICAgICAgICAgICB0ZXh0OiAnRW50aXR5IG5vdGVzIGFwcGVhciBpbiBQZW9wbGUvIGFuZCBDb25jZXB0cy8gZm9sZGVycycsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHRpcCA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdwJywge1xuICAgICAgICAgICAgY2xzOiAnc2V0dGluZy1pdGVtLWRlc2NyaXB0aW9uJyxcbiAgICAgICAgfSk7XG4gICAgICAgIHRpcC5zZXRUZXh0KFxuICAgICAgICAgICAgJ1VzZSBcImRyeSBydW5cIiB0byBwcmV2aWV3LCBvciBcImFsbCBub3RlcyBpbiBmb2xkZXJcIiBmb3IgYmF0Y2ggcHJvY2Vzc2luZy4nLFxuICAgICAgICApO1xuICAgIH1cbn1cbiIsICJleHBvcnQgZnVuY3Rpb24gaGV4VG9CeXRlcyhoZXg6IHN0cmluZyk6IFVpbnQ4QXJyYXkge1xuICAgIGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoaGV4Lmxlbmd0aCAvIDIpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaGV4Lmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIGJ5dGVzW2kgLyAyXSA9IHBhcnNlSW50KGhleC5zdWJzdHIoaSwgMiksIDE2KTtcbiAgICB9XG4gICAgcmV0dXJuIGJ5dGVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYnl0ZXNUb0hleChieXRlczogVWludDhBcnJheSk6IHN0cmluZyB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oYnl0ZXMpXG4gICAgICAgIC5tYXAoKGIpID0+IGIudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDIsICcwJykpXG4gICAgICAgIC5qb2luKCcnKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlRW5jS2V5KCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3Qga2V5ID0gYXdhaXQgY3J5cHRvLnN1YnRsZS5nZW5lcmF0ZUtleShcbiAgICAgICAgeyBuYW1lOiAnQUVTLUdDTScsIGxlbmd0aDogMjU2IH0sXG4gICAgICAgIHRydWUsXG4gICAgICAgIFsnZW5jcnlwdCcsICdkZWNyeXB0J10sXG4gICAgKTtcbiAgICBjb25zdCByYXcgPSBhd2FpdCBjcnlwdG8uc3VidGxlLmV4cG9ydEtleSgncmF3Jywga2V5KTtcbiAgICByZXR1cm4gYnl0ZXNUb0hleChuZXcgVWludDhBcnJheShyYXcpKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGltcG9ydEVuY0tleShoZXg6IHN0cmluZyk6IFByb21pc2U8Q3J5cHRvS2V5PiB7XG4gICAgcmV0dXJuIGNyeXB0by5zdWJ0bGUuaW1wb3J0S2V5KFxuICAgICAgICAncmF3JyxcbiAgICAgICAgaGV4VG9CeXRlcyhoZXgpLmJ1ZmZlciBhcyBBcnJheUJ1ZmZlcixcbiAgICAgICAgeyBuYW1lOiAnQUVTLUdDTScgfSxcbiAgICAgICAgZmFsc2UsXG4gICAgICAgIFsnZW5jcnlwdCcsICdkZWNyeXB0J10sXG4gICAgKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVuY3J5cHRTdHIoXG4gICAgdGV4dDogc3RyaW5nLFxuICAgIGtleUhleDogc3RyaW5nLFxuKTogUHJvbWlzZTx7IGN0OiBzdHJpbmc7IGl2OiBzdHJpbmcgfT4ge1xuICAgIGNvbnN0IGtleSA9IGF3YWl0IGltcG9ydEVuY0tleShrZXlIZXgpO1xuICAgIGNvbnN0IGl2ID0gY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhuZXcgVWludDhBcnJheSgxMikpO1xuICAgIGNvbnN0IGN0ID0gYXdhaXQgY3J5cHRvLnN1YnRsZS5lbmNyeXB0KFxuICAgICAgICB7IG5hbWU6ICdBRVMtR0NNJywgaXYgfSxcbiAgICAgICAga2V5LFxuICAgICAgICBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUodGV4dCksXG4gICAgKTtcbiAgICByZXR1cm4geyBjdDogYnl0ZXNUb0hleChuZXcgVWludDhBcnJheShjdCkpLCBpdjogYnl0ZXNUb0hleChpdikgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRlY3J5cHRTdHIoXG4gICAgY3RIZXg6IHN0cmluZyxcbiAgICBpdkhleDogc3RyaW5nLFxuICAgIGtleUhleDogc3RyaW5nLFxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBrZXkgPSBhd2FpdCBpbXBvcnRFbmNLZXkoa2V5SGV4KTtcbiAgICBjb25zdCBwdCA9IGF3YWl0IGNyeXB0by5zdWJ0bGUuZGVjcnlwdChcbiAgICAgICAgeyBuYW1lOiAnQUVTLUdDTScsIGl2OiBoZXhUb0J5dGVzKGl2SGV4KS5idWZmZXIgYXMgQXJyYXlCdWZmZXIgfSxcbiAgICAgICAga2V5LFxuICAgICAgICBoZXhUb0J5dGVzKGN0SGV4KS5idWZmZXIgYXMgQXJyYXlCdWZmZXIsXG4gICAgKTtcbiAgICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKHB0KTtcbn1cbiIsICJpbXBvcnQgdHlwZSB7IFNvdXJjZVR5cGUgfSBmcm9tICcuL2hlbHBlcnMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEVudGl0eUV4dHJhY3RvclNldHRpbmdzIHtcbiAgICBlbmNyeXB0ZWRBcGlLZXk6IHN0cmluZztcbiAgICBlbmNyeXB0aW9uS2V5OiBzdHJpbmc7XG4gICAgaXY6IHN0cmluZztcbiAgICBtb2RlbDogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgU1lTVEVNX1BST01QVCA9XG4gICAgJ1lvdSBhcmUgYW4gZXhwZXJ0IGF0IGFuYWx5emluZyBoaWdobGlnaHRzIGFuZCBhbm5vdGF0aW9ucyBmcm9tIHZhcmlvdXMgc291cmNlcyAnICtcbiAgICAnKGJvb2tzLCBwYXBlcnMsIGFydGljbGVzLCBwb2RjYXN0cywgdmlkZW9zKSBhbmQgZXh0cmFjdGluZyBzdHJ1Y3R1cmVkIGVudGl0eSBkYXRhLiAnICtcbiAgICAnWW91IHJldHVybiBvbmx5IHZhbGlkIEpTT04sIG5vIG1hcmtkb3duIGZlbmNpbmcuJztcblxuZXhwb3J0IGNvbnN0IFNPVVJDRV9UWVBFX0NPTlRFWFQ6IFJlY29yZDxTb3VyY2VUeXBlLCBzdHJpbmc+ID0ge1xuICAgIGJvb2s6ICdBbmFseXplIHRoaXMgYm9vayBub3RlIChoaWdobGlnaHRzIGZyb20gcmVhZGluZykgYW5kIGV4dHJhY3QgYWxsIG5vdGFibGUgZW50aXRpZXMuXFxuJyxcbiAgICBwYXBlcjogJ0FuYWx5emUgdGhpcyBhY2FkZW1pYyBwYXBlciBub3RlIChoaWdobGlnaHRzIGFuZCBhbm5vdGF0aW9ucykgYW5kIGV4dHJhY3QgYWxsIG5vdGFibGUgZW50aXRpZXMuXFxuUGF5IHNwZWNpYWwgYXR0ZW50aW9uIHRvOiByZXNlYXJjaCBtZXRob2RvbG9naWVzLCB0aGVvcmV0aWNhbCBmcmFtZXdvcmtzLCBjaXRlZCByZXNlYXJjaGVycywgYW5kIHRlY2huaWNhbCB0ZXJtaW5vbG9neS5cXG4nLFxuICAgIGFydGljbGU6ICdBbmFseXplIHRoaXMgYXJ0aWNsZSBub3RlIChoaWdobGlnaHRzIGZyb20gd2ViIHJlYWRpbmcpIGFuZCBleHRyYWN0IGFsbCBub3RhYmxlIGVudGl0aWVzLlxcbicsXG4gICAgcG9kY2FzdDogJ0FuYWx5emUgdGhpcyBwb2RjYXN0IG5vdGUgKGhpZ2hsaWdodHMgZnJvbSBhIHBvZGNhc3QgZXBpc29kZSkgYW5kIGV4dHJhY3QgYWxsIG5vdGFibGUgZW50aXRpZXMuXFxuTm90ZTogcXVvdGVzIG1heSBiZSBmcm9tIHNwb2tlbiBjb252ZXJzYXRpb24gYW5kIG1heSByZWZlcmVuY2UgbXVsdGlwbGUgc3BlYWtlcnMuXFxuJyxcbiAgICB2aWRlbzogJ0FuYWx5emUgdGhpcyB2aWRlbyBub3RlIChoaWdobGlnaHRzIGZyb20gYSB2aWRlbykgYW5kIGV4dHJhY3QgYWxsIG5vdGFibGUgZW50aXRpZXMuXFxuJyxcbiAgICB0d2VldDogJ0FuYWx5emUgdGhpcyB0d2VldCBjb2xsZWN0aW9uIGFuZCBleHRyYWN0IGFsbCBub3RhYmxlIGVudGl0aWVzLlxcbk5vdGU6IGNvbnRlbnQgaXMgZnJvbSBzb2NpYWwgbWVkaWEgYW5kIG1heSBiZSBicmllZi5cXG4nLFxuICAgIHVua25vd246ICdBbmFseXplIHRoaXMgbm90ZSBhbmQgZXh0cmFjdCBhbGwgbm90YWJsZSBlbnRpdGllcy5cXG4nLFxufTtcblxuY29uc3QgRVhUUkFDVElPTl9KU09OX1NDSEVNQV9XSVRIX1JFRlMgPVxuICAgICdcXG5SZXR1cm4gYSBKU09OIG9iamVjdCB3aXRoIHRoaXMgZXhhY3Qgc3RydWN0dXJlOlxcbicgK1xuICAgICd7XFxuJyArXG4gICAgJyAgXCJwZW9wbGVcIjogW1xcbicgK1xuICAgICcgICAge1xcbicgK1xuICAgICcgICAgICBcIm5hbWVcIjogXCJGdWxsIE5hbWVcIixcXG4nICtcbiAgICAnICAgICAgXCJhbGlhc2VzXCI6IFtcIk5pY2tuYW1lXCJdLFxcbicgK1xuICAgICcgICAgICBcIm1ham9yXCI6IHRydWUsXFxuJyArXG4gICAgJyAgICAgIFwiaGlnaGxpZ2h0c1wiOiBbXFxuJyArXG4gICAgJyAgICAgICAge1wicmVmXCI6IFwicmVmLVhYWFhYXCIsIFwic3VtbWFyeVwiOiBcIkJyaWVmIDUtMTAgd29yZCBkZXNjcmlwdGlvblwifVxcbicgK1xuICAgICcgICAgICBdLFxcbicgK1xuICAgICcgICAgICBcImNvbm5lY3Rpb25zXCI6IFtcXG4nICtcbiAgICAnICAgICAgICB7XCJlbnRpdHlcIjogXCJPdGhlciBFbnRpdHkgTmFtZVwiLCBcInJlbGF0aW9uc2hpcFwiOiBcImJyaWVmIGRlc2NyaXB0aW9uXCJ9XFxuJyArXG4gICAgJyAgICAgIF1cXG4nICtcbiAgICAnICAgIH1cXG4nICtcbiAgICAnICBdLFxcbicgK1xuICAgICcgIFwiY29uY2VwdHNcIjogW1xcbicgK1xuICAgICcgICAge1xcbicgK1xuICAgICcgICAgICBcIm5hbWVcIjogXCJDb25jZXB0IE5hbWVcIixcXG4nICtcbiAgICAnICAgICAgXCJhbGlhc2VzXCI6IFtcImFsdGVybmF0ZSBuYW1lXCJdLFxcbicgK1xuICAgICcgICAgICBcIm1ham9yXCI6IHRydWUsXFxuJyArXG4gICAgJyAgICAgIFwiaGlnaGxpZ2h0c1wiOiBbXFxuJyArXG4gICAgJyAgICAgICAge1wicmVmXCI6IFwicmVmLVhYWFhYXCIsIFwic3VtbWFyeVwiOiBcIkJyaWVmIGRlc2NyaXB0aW9uXCJ9XFxuJyArXG4gICAgJyAgICAgIF0sXFxuJyArXG4gICAgJyAgICAgIFwiY29ubmVjdGlvbnNcIjogW1xcbicgK1xuICAgICcgICAgICAgIHtcImVudGl0eVwiOiBcIlBlcnNvbiBvciBDb25jZXB0IE5hbWVcIiwgXCJyZWxhdGlvbnNoaXBcIjogXCJicmllZiBkZXNjcmlwdGlvblwifVxcbicgK1xuICAgICcgICAgICBdXFxuJyArXG4gICAgJyAgICB9XFxuJyArXG4gICAgJyAgXVxcbicgK1xuICAgICd9XFxuJztcblxuY29uc3QgRVhUUkFDVElPTl9KU09OX1NDSEVNQV9OT19SRUZTID1cbiAgICAnXFxuVGhpcyBub3RlIGRvZXMgTk9UIGhhdmUgXnJlZi1YWFhYWCBibG9jayBJRHMuIEluc3RlYWQsIHByb3ZpZGUgYSBcInF1b3RlXCIgZmllbGQgd2l0aCBhIHNob3J0IGV4Y2VycHQgKGZpcnN0IH44MCBjaGFycykgZnJvbSB0aGUgcmVsZXZhbnQgaGlnaGxpZ2h0IHRleHQuXFxuJyArXG4gICAgJ1xcblJldHVybiBhIEpTT04gb2JqZWN0IHdpdGggdGhpcyBleGFjdCBzdHJ1Y3R1cmU6XFxuJyArXG4gICAgJ3tcXG4nICtcbiAgICAnICBcInBlb3BsZVwiOiBbXFxuJyArXG4gICAgJyAgICB7XFxuJyArXG4gICAgJyAgICAgIFwibmFtZVwiOiBcIkZ1bGwgTmFtZVwiLFxcbicgK1xuICAgICcgICAgICBcImFsaWFzZXNcIjogW1wiTmlja25hbWVcIl0sXFxuJyArXG4gICAgJyAgICAgIFwibWFqb3JcIjogdHJ1ZSxcXG4nICtcbiAgICAnICAgICAgXCJoaWdobGlnaHRzXCI6IFtcXG4nICtcbiAgICAnICAgICAgICB7XCJxdW90ZVwiOiBcIkZpcnN0IH44MCBjaGFycyBvZiB0aGUgaGlnaGxpZ2h0IHRleHQuLi5cIiwgXCJzdW1tYXJ5XCI6IFwiQnJpZWYgNS0xMCB3b3JkIGRlc2NyaXB0aW9uXCJ9XFxuJyArXG4gICAgJyAgICAgIF0sXFxuJyArXG4gICAgJyAgICAgIFwiY29ubmVjdGlvbnNcIjogW1xcbicgK1xuICAgICcgICAgICAgIHtcImVudGl0eVwiOiBcIk90aGVyIEVudGl0eSBOYW1lXCIsIFwicmVsYXRpb25zaGlwXCI6IFwiYnJpZWYgZGVzY3JpcHRpb25cIn1cXG4nICtcbiAgICAnICAgICAgXVxcbicgK1xuICAgICcgICAgfVxcbicgK1xuICAgICcgIF0sXFxuJyArXG4gICAgJyAgXCJjb25jZXB0c1wiOiBbXFxuJyArXG4gICAgJyAgICB7XFxuJyArXG4gICAgJyAgICAgIFwibmFtZVwiOiBcIkNvbmNlcHQgTmFtZVwiLFxcbicgK1xuICAgICcgICAgICBcImFsaWFzZXNcIjogW1wiYWx0ZXJuYXRlIG5hbWVcIl0sXFxuJyArXG4gICAgJyAgICAgIFwibWFqb3JcIjogdHJ1ZSxcXG4nICtcbiAgICAnICAgICAgXCJoaWdobGlnaHRzXCI6IFtcXG4nICtcbiAgICAnICAgICAgICB7XCJxdW90ZVwiOiBcIkZpcnN0IH44MCBjaGFycyBvZiB0aGUgaGlnaGxpZ2h0IHRleHQuLi5cIiwgXCJzdW1tYXJ5XCI6IFwiQnJpZWYgZGVzY3JpcHRpb25cIn1cXG4nICtcbiAgICAnICAgICAgXSxcXG4nICtcbiAgICAnICAgICAgXCJjb25uZWN0aW9uc1wiOiBbXFxuJyArXG4gICAgJyAgICAgICAge1wiZW50aXR5XCI6IFwiUGVyc29uIG9yIENvbmNlcHQgTmFtZVwiLCBcInJlbGF0aW9uc2hpcFwiOiBcImJyaWVmIGRlc2NyaXB0aW9uXCJ9XFxuJyArXG4gICAgJyAgICAgIF1cXG4nICtcbiAgICAnICAgIH1cXG4nICtcbiAgICAnICBdXFxuJyArXG4gICAgJ31cXG4nO1xuXG5jb25zdCBFWFRSQUNUSU9OX1JVTEVTX1dJVEhfUkVGUyA9XG4gICAgJ1xcblJ1bGVzOlxcbicgK1xuICAgICctIFwibWFqb3JcIiBpcyB0cnVlIGlmIHRoZSBlbnRpdHkgaGFzIHNpZ25pZmljYW50IGNvdmVyYWdlIChtdWx0aXBsZSBoaWdobGlnaHRzIG9yIGNlbnRyYWwgdG8gdGhlIG5hcnJhdGl2ZSksIGZhbHNlIGZvciBicmllZi9wYXNzaW5nIG1lbnRpb25zXFxuJyArXG4gICAgJy0gT25seSB1c2UgcmVmIElEcyB0aGF0IGFjdHVhbGx5IGFwcGVhciBpbiB0aGUgdGV4dCAodGhleSBsb29rIGxpa2UgXnJlZi1YWFhYWCBhdCB0aGUgZW5kIG9mIGhpZ2hsaWdodHMpXFxuJyArXG4gICAgJy0gQSBoaWdobGlnaHQgY2FuIGJlIGFzc29jaWF0ZWQgd2l0aCBtdWx0aXBsZSBlbnRpdGllc1xcbicgK1xuICAgICctIEZvciBjb25uZWN0aW9ucywgb25seSBsaW5rIHRvIG90aGVyIGVudGl0aWVzIHlvdSBhcmUgZXh0cmFjdGluZyAobm90IGV4dGVybmFsIGZpZ3VyZXMpXFxuJyArXG4gICAgJy0gUGVvcGxlIGNvbm5lY3Rpb25zIHNob3VsZCBpbmNsdWRlIHJlbGF0aW9uc2hpcHMgbGlrZSBcImNvLWRldmVsb3BlclwiLCBcInN0dWRlbnRcIiwgXCJhZHZpc29yXCIsIFwiY29sbGVhZ3VlXCIsIFwiY3JpdGljXCJcXG4nICtcbiAgICAnLSBDb25jZXB0IGNvbm5lY3Rpb25zIHNob3VsZCBsaW5rIHRvIHJlbGF0ZWQgcGVvcGxlIEFORCByZWxhdGVkIGNvbmNlcHRzXFxuJyArXG4gICAgJy0gSW5jbHVkZSBBTEwgcGVvcGxlIG1lbnRpb25lZCBieSBuYW1lLCBldmVuIGJyaWVmbHkgXHUyMDE0IHRoZXkgYmVjb21lIHN0dWJzXFxuJyArXG4gICAgJy0gRm9yIGNvbmNlcHRzLCBmb2N1cyBvbiB0ZWNobmljYWwvaW50ZWxsZWN0dWFsIGNvbmNlcHRzLCBub3QgZ2VuZXJhbCB0ZXJtc1xcbicgK1xuICAgICctIFJldHVybiBPTkxZIHRoZSBKU09OIG9iamVjdCwgbm8gbWFya2Rvd24gZmVuY2luZyBvciBleHBsYW5hdGlvblxcbicgK1xuICAgICdcXG5Ob3RlIGNvbnRlbnQ6XFxuJztcblxuY29uc3QgRVhUUkFDVElPTl9SVUxFU19OT19SRUZTID1cbiAgICAnXFxuUnVsZXM6XFxuJyArXG4gICAgJy0gXCJtYWpvclwiIGlzIHRydWUgaWYgdGhlIGVudGl0eSBoYXMgc2lnbmlmaWNhbnQgY292ZXJhZ2UgKG11bHRpcGxlIGhpZ2hsaWdodHMgb3IgY2VudHJhbCB0byB0aGUgbmFycmF0aXZlKSwgZmFsc2UgZm9yIGJyaWVmL3Bhc3NpbmcgbWVudGlvbnNcXG4nICtcbiAgICAnLSBGb3IgXCJxdW90ZVwiLCB1c2UgdGhlIGZpcnN0IH44MCBjaGFyYWN0ZXJzIG9mIHRoZSBhY3R1YWwgaGlnaGxpZ2h0IHRleHQgZnJvbSB0aGUgbm90ZSAoZW5vdWdoIHRvIGlkZW50aWZ5IGl0KVxcbicgK1xuICAgICctIEEgaGlnaGxpZ2h0IGNhbiBiZSBhc3NvY2lhdGVkIHdpdGggbXVsdGlwbGUgZW50aXRpZXNcXG4nICtcbiAgICAnLSBGb3IgY29ubmVjdGlvbnMsIG9ubHkgbGluayB0byBvdGhlciBlbnRpdGllcyB5b3UgYXJlIGV4dHJhY3RpbmcgKG5vdCBleHRlcm5hbCBmaWd1cmVzKVxcbicgK1xuICAgICctIFBlb3BsZSBjb25uZWN0aW9ucyBzaG91bGQgaW5jbHVkZSByZWxhdGlvbnNoaXBzIGxpa2UgXCJjby1kZXZlbG9wZXJcIiwgXCJzdHVkZW50XCIsIFwiYWR2aXNvclwiLCBcImNvbGxlYWd1ZVwiLCBcImNyaXRpY1wiXFxuJyArXG4gICAgJy0gQ29uY2VwdCBjb25uZWN0aW9ucyBzaG91bGQgbGluayB0byByZWxhdGVkIHBlb3BsZSBBTkQgcmVsYXRlZCBjb25jZXB0c1xcbicgK1xuICAgICctIEluY2x1ZGUgQUxMIHBlb3BsZSBtZW50aW9uZWQgYnkgbmFtZSwgZXZlbiBicmllZmx5IFx1MjAxNCB0aGV5IGJlY29tZSBzdHVic1xcbicgK1xuICAgICctIEZvciBjb25jZXB0cywgZm9jdXMgb24gdGVjaG5pY2FsL2ludGVsbGVjdHVhbCBjb25jZXB0cywgbm90IGdlbmVyYWwgdGVybXNcXG4nICtcbiAgICAnLSBSZXR1cm4gT05MWSB0aGUgSlNPTiBvYmplY3QsIG5vIG1hcmtkb3duIGZlbmNpbmcgb3IgZXhwbGFuYXRpb25cXG4nICtcbiAgICAnXFxuTm90ZSBjb250ZW50Olxcbic7XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEV4dHJhY3Rpb25Qcm9tcHQoc291cmNlVHlwZTogU291cmNlVHlwZSwgaGFzUmVmczogYm9vbGVhbik6IHN0cmluZyB7XG4gICAgY29uc3QgY29udGV4dCA9IFNPVVJDRV9UWVBFX0NPTlRFWFRbc291cmNlVHlwZV07XG4gICAgaWYgKGhhc1JlZnMpIHtcbiAgICAgICAgcmV0dXJuIGNvbnRleHQgKyBFWFRSQUNUSU9OX0pTT05fU0NIRU1BX1dJVEhfUkVGUyArIEVYVFJBQ1RJT05fUlVMRVNfV0lUSF9SRUZTO1xuICAgIH1cbiAgICByZXR1cm4gY29udGV4dCArIEVYVFJBQ1RJT05fSlNPTl9TQ0hFTUFfTk9fUkVGUyArIEVYVFJBQ1RJT05fUlVMRVNfTk9fUkVGUztcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEVudGl0eUV4dHJhY3RvclNldHRpbmdzID0ge1xuICAgIGVuY3J5cHRlZEFwaUtleTogJycsXG4gICAgZW5jcnlwdGlvbktleTogJycsXG4gICAgaXY6ICcnLFxuICAgIG1vZGVsOiAnY2xhdWRlLXNvbm5ldC00LTYnLFxufTtcbiIsICJleHBvcnQgdHlwZSBTb3VyY2VUeXBlID0gJ2Jvb2snIHwgJ3BhcGVyJyB8ICdhcnRpY2xlJyB8ICdwb2RjYXN0JyB8ICd2aWRlbycgfCAndHdlZXQnIHwgJ3Vua25vd24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNvdXJjZUluZm8ge1xuICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgc291cmNlVHlwZTogU291cmNlVHlwZTtcbiAgICByZWZzOiBTZXQ8c3RyaW5nPjtcbiAgICBoYXNIaWdobGlnaHRzOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhpZ2hsaWdodCB7XG4gICAgcmVmPzogc3RyaW5nO1xuICAgIHF1b3RlPzogc3RyaW5nO1xuICAgIHN1bW1hcnk6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb25uZWN0aW9uIHtcbiAgICBlbnRpdHk6IHN0cmluZztcbiAgICByZWxhdGlvbnNoaXA6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFbnRpdHkge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBhbGlhc2VzPzogc3RyaW5nW107XG4gICAgbWFqb3I/OiBib29sZWFuO1xuICAgIGhpZ2hsaWdodHM/OiBIaWdobGlnaHRbXTtcbiAgICBjb25uZWN0aW9ucz86IENvbm5lY3Rpb25bXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNhbml0aXplRmlsZW5hbWUobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gbmFtZS5yZXBsYWNlKC9bXFxcXC86Kj9cIjw+fF0vZywgJy0nKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdFNvdXJjZVR5cGUoY29udGVudDogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZyk6IFNvdXJjZVR5cGUge1xuICAgIC8vIDEuIENoZWNrIENhdGVnb3J5IHRhZyBpbiBNZXRhZGF0YSBzZWN0aW9uXG4gICAgY29uc3QgY2F0ZWdvcnlNYXRjaCA9IGNvbnRlbnQubWF0Y2goL14tXFxzKkNhdGVnb3J5OlxccyojKFxcdyspL20pO1xuICAgIGlmIChjYXRlZ29yeU1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGNhdCA9IGNhdGVnb3J5TWF0Y2hbMV0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgaWYgKGNhdCA9PT0gJ2Jvb2tzJykgcmV0dXJuICdib29rJztcbiAgICAgICAgaWYgKGNhdCA9PT0gJ2FydGljbGVzJykgcmV0dXJuICdhcnRpY2xlJztcbiAgICAgICAgaWYgKGNhdCA9PT0gJ3BvZGNhc3RzJykgcmV0dXJuICdwb2RjYXN0JztcbiAgICAgICAgaWYgKGNhdCA9PT0gJ3R3ZWV0cycpIHJldHVybiAndHdlZXQnO1xuICAgICAgICBpZiAoY2F0ID09PSAncGFwZXJzJykgcmV0dXJuICdwYXBlcic7XG4gICAgICAgIGlmIChjYXQgPT09ICd2aWRlb3MnKSByZXR1cm4gJ3ZpZGVvJztcbiAgICB9XG5cbiAgICAvLyAyLiBDaGVjayBmb3Iga2luZGxlLXN5bmMgWUFNTCBmcm9udG1hdHRlclxuICAgIGlmICgvXmtpbmRsZS1zeW5jOi9tLnRlc3QoY29udGVudCkpIHJldHVybiAnYm9vayc7XG5cbiAgICAvLyAzLiBDaGVjayBmb3IgRE9JIChzdHJvbmcgcGFwZXIgc2lnbmFsKVxuICAgIGlmICgvXi1cXHMqRE9JOi9tLnRlc3QoY29udGVudCkpIHJldHVybiAncGFwZXInO1xuXG4gICAgLy8gNC4gRmFsbCBiYWNrIHRvIGZpbGUgcGF0aFxuICAgIGlmIChmaWxlUGF0aCkge1xuICAgICAgICBjb25zdCBwID0gZmlsZVBhdGgudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgaWYgKHAuaW5jbHVkZXMoJ3BhcGVycy8nKSkgcmV0dXJuICdwYXBlcic7XG4gICAgICAgIGlmIChwLmluY2x1ZGVzKCdwb2RjYXN0cy8nKSkgcmV0dXJuICdwb2RjYXN0JztcbiAgICAgICAgaWYgKHAuaW5jbHVkZXMoJ3ZpZGVvcy8nKSkgcmV0dXJuICd2aWRlbyc7XG4gICAgICAgIGlmIChwLmluY2x1ZGVzKCdhcnRpY2xlcy8nKSkgcmV0dXJuICdhcnRpY2xlJztcbiAgICAgICAgaWYgKHAuaW5jbHVkZXMoJ3R3ZWV0cy8nKSkgcmV0dXJuICd0d2VldCc7XG4gICAgICAgIGlmIChwLmluY2x1ZGVzKCdib29rcy8nKSkgcmV0dXJuICdib29rJztcbiAgICB9XG5cbiAgICByZXR1cm4gJ3Vua25vd24nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VTb3VyY2VOb3RlKGNvbnRlbnQ6IHN0cmluZywgZmlsZVBhdGg/OiBzdHJpbmcpOiBTb3VyY2VJbmZvIHtcbiAgICBjb25zdCB0aXRsZU1hdGNoID0gY29udGVudC5tYXRjaCgvXiMgKC4rKSQvbSk7XG4gICAgY29uc3QgdGl0bGUgPSB0aXRsZU1hdGNoID8gdGl0bGVNYXRjaFsxXS50cmltKCkgOiAnVW50aXRsZWQnO1xuXG4gICAgY29uc3Qgc291cmNlVHlwZSA9IGRldGVjdFNvdXJjZVR5cGUoY29udGVudCwgZmlsZVBhdGgpO1xuXG4gICAgLy8gQ29sbGVjdCBecmVmLVhYWFhYIGJsb2NrIElEcyAoS2luZGxlIFN5bmMpXG4gICAgY29uc3QgcmVmcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IHJlID0gL1xcXihyZWYtXFxkKykvZztcbiAgICBsZXQgbTtcbiAgICB3aGlsZSAoKG0gPSByZS5leGVjKGNvbnRlbnQpKSAhPT0gbnVsbCkge1xuICAgICAgICByZWZzLmFkZChtWzFdKTtcbiAgICB9XG5cbiAgICAvLyBEZXRlY3QgYW55IGhpZ2hsaWdodHNcbiAgICBsZXQgaGFzSGlnaGxpZ2h0cyA9IHJlZnMuc2l6ZSA+IDA7XG4gICAgaWYgKCFoYXNIaWdobGlnaHRzKSB7XG4gICAgICAgIGhhc0hpZ2hsaWdodHMgPVxuICAgICAgICAgICAgL1xcKFxcW0xvY2F0aW9uXFxzK1xcZCtcXF1cXCgvLnRlc3QoY29udGVudCkgfHxcbiAgICAgICAgICAgIC9cXChcXFtWaWV3IEhpZ2hsaWdodFxcXVxcKC8udGVzdChjb250ZW50KSB8fFxuICAgICAgICAgICAgL1xcKFxcW1ZpZXcgVHdlZXRcXF1cXCgvLnRlc3QoY29udGVudCkgfHxcbiAgICAgICAgICAgIC9ePlxccysuezEwLH0vbS50ZXN0KGNvbnRlbnQpIHx8XG4gICAgICAgICAgICAvXFxuLS0tXFxuLy50ZXN0KGNvbnRlbnQpO1xuICAgIH1cblxuICAgIHJldHVybiB7IHRpdGxlLCBzb3VyY2VUeXBlLCByZWZzLCBoYXNIaWdobGlnaHRzIH07XG59XG5cbi8qKiBAZGVwcmVjYXRlZCBVc2UgcGFyc2VTb3VyY2VOb3RlIGluc3RlYWQgKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUJvb2tOb3RlKGNvbnRlbnQ6IHN0cmluZykge1xuICAgIGNvbnN0IGluZm8gPSBwYXJzZVNvdXJjZU5vdGUoY29udGVudCk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdGl0bGU6IGluZm8udGl0bGUsXG4gICAgICAgIHJlZnM6IGluZm8ucmVmcyxcbiAgICAgICAgaGFzUmVhZHdpc2VIaWdobGlnaHRzOiBpbmZvLmhhc0hpZ2hsaWdodHMgJiYgaW5mby5yZWZzLnNpemUgPT09IDAsXG4gICAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdFJlYWRpbmdTZWN0aW9uKFxuICAgIHNvdXJjZVRpdGxlOiBzdHJpbmcsXG4gICAgaGlnaGxpZ2h0czogSGlnaGxpZ2h0W10gfCB1bmRlZmluZWQsXG4gICAgc291cmNlVHlwZT86IFNvdXJjZVR5cGUsXG4pOiBzdHJpbmcge1xuICAgIGNvbnN0IHR5cGVBbm5vdGF0aW9uID0gc291cmNlVHlwZSA/ICcgKCcgKyBzb3VyY2VUeXBlICsgJyknIDogJyc7XG4gICAgaWYgKCFoaWdobGlnaHRzIHx8IGhpZ2hsaWdodHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiAnIyMjIFtbJyArIHNvdXJjZVRpdGxlICsgJ11dJyArIHR5cGVBbm5vdGF0aW9uICsgJ1xcbi0gTWVudGlvbmVkIGluIHRleHRcXG4nO1xuICAgIH1cbiAgICBjb25zdCBsaW5lcyA9IGhpZ2hsaWdodHMubWFwKChoKSA9PiB7XG4gICAgICAgIGlmIChoLnJlZikge1xuICAgICAgICAgICAgcmV0dXJuICctICcgKyBoLnN1bW1hcnkgKyAnICFbWycgKyBzb3VyY2VUaXRsZSArICcjXicgKyBoLnJlZiArICddXSc7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICctICcgKyBoLnN1bW1hcnk7XG4gICAgfSk7XG4gICAgcmV0dXJuICcjIyMgW1snICsgc291cmNlVGl0bGUgKyAnXV0nICsgdHlwZUFubm90YXRpb24gKyAnXFxuJyArIGxpbmVzLmpvaW4oJ1xcbicpICsgJ1xcbic7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEVudGl0eU5vdGUoXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIGVudGl0eTogRW50aXR5LFxuICAgIHNvdXJjZVRpdGxlOiBzdHJpbmcsXG4gICAgc291cmNlVHlwZTogU291cmNlVHlwZSA9ICdib29rJyxcbik6IHN0cmluZyB7XG4gICAgbGV0IGFsaWFzWWFtbCA9ICcnO1xuICAgIGlmIChlbnRpdHkuYWxpYXNlcyAmJiBlbnRpdHkuYWxpYXNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGFsaWFzWWFtbCA9XG4gICAgICAgICAgICAnYWxpYXNlczpcXG4nICtcbiAgICAgICAgICAgIGVudGl0eS5hbGlhc2VzLm1hcCgoYSkgPT4gJyAgLSAnICsgYSkuam9pbignXFxuJykgK1xuICAgICAgICAgICAgJ1xcbic7XG4gICAgfVxuXG4gICAgY29uc3QgcmVhZGluZ1NlY3Rpb24gPSBmb3JtYXRSZWFkaW5nU2VjdGlvbihzb3VyY2VUaXRsZSwgZW50aXR5LmhpZ2hsaWdodHMsIHNvdXJjZVR5cGUpO1xuXG4gICAgbGV0IGNvbm5lY3Rpb25zID0gJyc7XG4gICAgaWYgKGVudGl0eS5jb25uZWN0aW9ucyAmJiBlbnRpdHkuY29ubmVjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBsaW5lcyA9IGVudGl0eS5jb25uZWN0aW9ucy5tYXAoXG4gICAgICAgICAgICAoYykgPT4gJy0gW1snICsgYy5lbnRpdHkgKyAnXV0gXFx1MjAxNCAnICsgYy5yZWxhdGlvbnNoaXAsXG4gICAgICAgICk7XG4gICAgICAgIGNvbm5lY3Rpb25zID0gJyMjIENvbm5lY3RlZCBUb1xcbicgKyBsaW5lcy5qb2luKCdcXG4nKSArICdcXG4nO1xuICAgIH1cblxuICAgIHJldHVybiAoXG4gICAgICAgICctLS1cXG4nICtcbiAgICAgICAgJ3R5cGU6ICcgKyB0eXBlICsgJ1xcbicgK1xuICAgICAgICAndGFnczpcXG4nICtcbiAgICAgICAgJyAgLSAnICsgdHlwZSArICdcXG4nICtcbiAgICAgICAgYWxpYXNZYW1sICtcbiAgICAgICAgJ3NvdXJjZS10eXBlczpcXG4nICtcbiAgICAgICAgJyAgLSAnICsgc291cmNlVHlwZSArICdcXG4nICtcbiAgICAgICAgJy0tLVxcbicgK1xuICAgICAgICAnXFxuJyArXG4gICAgICAgICcjICcgKyBlbnRpdHkubmFtZSArICdcXG4nICtcbiAgICAgICAgJ1xcbicgK1xuICAgICAgICAnIyMgU291cmNlc1xcbicgK1xuICAgICAgICAnXFxuJyArXG4gICAgICAgIHJlYWRpbmdTZWN0aW9uICtcbiAgICAgICAgJ1xcbicgK1xuICAgICAgICBjb25uZWN0aW9ucyArXG4gICAgICAgICdcXG4nICtcbiAgICAgICAgJyMjIE1lbnRpb25lZCBJblxcbicgK1xuICAgICAgICAnLSBbWycgKyBzb3VyY2VUaXRsZSArICddXSAoJyArIHNvdXJjZVR5cGUgKyAnKVxcbidcbiAgICApO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBQTZFOzs7QUNBdEUsU0FBUyxXQUFXLEtBQXlCO0FBQ2hELFFBQU0sUUFBUSxJQUFJLFdBQVcsSUFBSSxTQUFTLENBQUM7QUFDM0MsV0FBUyxJQUFJLEdBQUcsSUFBSSxJQUFJLFFBQVEsS0FBSyxHQUFHO0FBQ3BDLFVBQU0sSUFBSSxDQUFDLElBQUksU0FBUyxJQUFJLE9BQU8sR0FBRyxDQUFDLEdBQUcsRUFBRTtBQUFBLEVBQ2hEO0FBQ0EsU0FBTztBQUNYO0FBRU8sU0FBUyxXQUFXLE9BQTJCO0FBQ2xELFNBQU8sTUFBTSxLQUFLLEtBQUssRUFDbEIsSUFBSSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsRUFBRSxTQUFTLEdBQUcsR0FBRyxDQUFDLEVBQzFDLEtBQUssRUFBRTtBQUNoQjtBQUVBLGVBQXNCLGlCQUFrQztBQUNwRCxRQUFNLE1BQU0sTUFBTSxPQUFPLE9BQU87QUFBQSxJQUM1QixFQUFFLE1BQU0sV0FBVyxRQUFRLElBQUk7QUFBQSxJQUMvQjtBQUFBLElBQ0EsQ0FBQyxXQUFXLFNBQVM7QUFBQSxFQUN6QjtBQUNBLFFBQU0sTUFBTSxNQUFNLE9BQU8sT0FBTyxVQUFVLE9BQU8sR0FBRztBQUNwRCxTQUFPLFdBQVcsSUFBSSxXQUFXLEdBQUcsQ0FBQztBQUN6QztBQUVBLGVBQXNCLGFBQWEsS0FBaUM7QUFDaEUsU0FBTyxPQUFPLE9BQU87QUFBQSxJQUNqQjtBQUFBLElBQ0EsV0FBVyxHQUFHLEVBQUU7QUFBQSxJQUNoQixFQUFFLE1BQU0sVUFBVTtBQUFBLElBQ2xCO0FBQUEsSUFDQSxDQUFDLFdBQVcsU0FBUztBQUFBLEVBQ3pCO0FBQ0o7QUFFQSxlQUFzQixXQUNsQixNQUNBLFFBQ21DO0FBQ25DLFFBQU0sTUFBTSxNQUFNLGFBQWEsTUFBTTtBQUNyQyxRQUFNLEtBQUssT0FBTyxnQkFBZ0IsSUFBSSxXQUFXLEVBQUUsQ0FBQztBQUNwRCxRQUFNLEtBQUssTUFBTSxPQUFPLE9BQU87QUFBQSxJQUMzQixFQUFFLE1BQU0sV0FBVyxHQUFHO0FBQUEsSUFDdEI7QUFBQSxJQUNBLElBQUksWUFBWSxFQUFFLE9BQU8sSUFBSTtBQUFBLEVBQ2pDO0FBQ0EsU0FBTyxFQUFFLElBQUksV0FBVyxJQUFJLFdBQVcsRUFBRSxDQUFDLEdBQUcsSUFBSSxXQUFXLEVBQUUsRUFBRTtBQUNwRTtBQUVBLGVBQXNCLFdBQ2xCLE9BQ0EsT0FDQSxRQUNlO0FBQ2YsUUFBTSxNQUFNLE1BQU0sYUFBYSxNQUFNO0FBQ3JDLFFBQU0sS0FBSyxNQUFNLE9BQU8sT0FBTztBQUFBLElBQzNCLEVBQUUsTUFBTSxXQUFXLElBQUksV0FBVyxLQUFLLEVBQUUsT0FBc0I7QUFBQSxJQUMvRDtBQUFBLElBQ0EsV0FBVyxLQUFLLEVBQUU7QUFBQSxFQUN0QjtBQUNBLFNBQU8sSUFBSSxZQUFZLEVBQUUsT0FBTyxFQUFFO0FBQ3RDOzs7QUNuRE8sSUFBTSxnQkFDVDtBQUlHLElBQU0sc0JBQWtEO0FBQUEsRUFDM0QsTUFBTTtBQUFBLEVBQ04sT0FBTztBQUFBLEVBQ1AsU0FBUztBQUFBLEVBQ1QsU0FBUztBQUFBLEVBQ1QsT0FBTztBQUFBLEVBQ1AsT0FBTztBQUFBLEVBQ1AsU0FBUztBQUNiO0FBRUEsSUFBTSxtQ0FDRjtBQThCSixJQUFNLGlDQUNGO0FBK0JKLElBQU0sNkJBQ0Y7QUFZSixJQUFNLDJCQUNGO0FBWUcsU0FBUyxzQkFBc0IsWUFBd0IsU0FBMEI7QUFDcEYsUUFBTSxVQUFVLG9CQUFvQixVQUFVO0FBQzlDLE1BQUksU0FBUztBQUNULFdBQU8sVUFBVSxtQ0FBbUM7QUFBQSxFQUN4RDtBQUNBLFNBQU8sVUFBVSxpQ0FBaUM7QUFDdEQ7QUFFTyxJQUFNLG1CQUE0QztBQUFBLEVBQ3JELGlCQUFpQjtBQUFBLEVBQ2pCLGVBQWU7QUFBQSxFQUNmLElBQUk7QUFBQSxFQUNKLE9BQU87QUFDWDs7O0FDbEdPLFNBQVMsaUJBQWlCLE1BQXNCO0FBQ25ELFNBQU8sS0FBSyxRQUFRLGlCQUFpQixHQUFHO0FBQzVDO0FBRU8sU0FBUyxpQkFBaUIsU0FBaUIsVUFBK0I7QUFFN0UsUUFBTSxnQkFBZ0IsUUFBUSxNQUFNLDBCQUEwQjtBQUM5RCxNQUFJLGVBQWU7QUFDZixVQUFNLE1BQU0sY0FBYyxDQUFDLEVBQUUsWUFBWTtBQUN6QyxRQUFJLFFBQVEsUUFBUyxRQUFPO0FBQzVCLFFBQUksUUFBUSxXQUFZLFFBQU87QUFDL0IsUUFBSSxRQUFRLFdBQVksUUFBTztBQUMvQixRQUFJLFFBQVEsU0FBVSxRQUFPO0FBQzdCLFFBQUksUUFBUSxTQUFVLFFBQU87QUFDN0IsUUFBSSxRQUFRLFNBQVUsUUFBTztBQUFBLEVBQ2pDO0FBR0EsTUFBSSxpQkFBaUIsS0FBSyxPQUFPLEVBQUcsUUFBTztBQUczQyxNQUFJLGFBQWEsS0FBSyxPQUFPLEVBQUcsUUFBTztBQUd2QyxNQUFJLFVBQVU7QUFDVixVQUFNLElBQUksU0FBUyxZQUFZO0FBQy9CLFFBQUksRUFBRSxTQUFTLFNBQVMsRUFBRyxRQUFPO0FBQ2xDLFFBQUksRUFBRSxTQUFTLFdBQVcsRUFBRyxRQUFPO0FBQ3BDLFFBQUksRUFBRSxTQUFTLFNBQVMsRUFBRyxRQUFPO0FBQ2xDLFFBQUksRUFBRSxTQUFTLFdBQVcsRUFBRyxRQUFPO0FBQ3BDLFFBQUksRUFBRSxTQUFTLFNBQVMsRUFBRyxRQUFPO0FBQ2xDLFFBQUksRUFBRSxTQUFTLFFBQVEsRUFBRyxRQUFPO0FBQUEsRUFDckM7QUFFQSxTQUFPO0FBQ1g7QUFFTyxTQUFTLGdCQUFnQixTQUFpQixVQUErQjtBQUM1RSxRQUFNLGFBQWEsUUFBUSxNQUFNLFdBQVc7QUFDNUMsUUFBTSxRQUFRLGFBQWEsV0FBVyxDQUFDLEVBQUUsS0FBSyxJQUFJO0FBRWxELFFBQU0sYUFBYSxpQkFBaUIsU0FBUyxRQUFRO0FBR3JELFFBQU0sT0FBTyxvQkFBSSxJQUFZO0FBQzdCLFFBQU0sS0FBSztBQUNYLE1BQUk7QUFDSixVQUFRLElBQUksR0FBRyxLQUFLLE9BQU8sT0FBTyxNQUFNO0FBQ3BDLFNBQUssSUFBSSxFQUFFLENBQUMsQ0FBQztBQUFBLEVBQ2pCO0FBR0EsTUFBSSxnQkFBZ0IsS0FBSyxPQUFPO0FBQ2hDLE1BQUksQ0FBQyxlQUFlO0FBQ2hCLG9CQUNJLHlCQUF5QixLQUFLLE9BQU8sS0FDckMseUJBQXlCLEtBQUssT0FBTyxLQUNyQyxxQkFBcUIsS0FBSyxPQUFPLEtBQ2pDLGVBQWUsS0FBSyxPQUFPLEtBQzNCLFVBQVUsS0FBSyxPQUFPO0FBQUEsRUFDOUI7QUFFQSxTQUFPLEVBQUUsT0FBTyxZQUFZLE1BQU0sY0FBYztBQUNwRDtBQVlPLFNBQVMscUJBQ1osYUFDQSxZQUNBLFlBQ007QUFDTixRQUFNLGlCQUFpQixhQUFhLE9BQU8sYUFBYSxNQUFNO0FBQzlELE1BQUksQ0FBQyxjQUFjLFdBQVcsV0FBVyxHQUFHO0FBQ3hDLFdBQU8sV0FBVyxjQUFjLE9BQU8saUJBQWlCO0FBQUEsRUFDNUQ7QUFDQSxRQUFNLFFBQVEsV0FBVyxJQUFJLENBQUMsTUFBTTtBQUNoQyxRQUFJLEVBQUUsS0FBSztBQUNQLGFBQU8sT0FBTyxFQUFFLFVBQVUsU0FBUyxjQUFjLE9BQU8sRUFBRSxNQUFNO0FBQUEsSUFDcEU7QUFDQSxXQUFPLE9BQU8sRUFBRTtBQUFBLEVBQ3BCLENBQUM7QUFDRCxTQUFPLFdBQVcsY0FBYyxPQUFPLGlCQUFpQixPQUFPLE1BQU0sS0FBSyxJQUFJLElBQUk7QUFDdEY7QUFFTyxTQUFTLGdCQUNaLE1BQ0EsUUFDQSxhQUNBLGFBQXlCLFFBQ25CO0FBQ04sTUFBSSxZQUFZO0FBQ2hCLE1BQUksT0FBTyxXQUFXLE9BQU8sUUFBUSxTQUFTLEdBQUc7QUFDN0MsZ0JBQ0ksZUFDQSxPQUFPLFFBQVEsSUFBSSxDQUFDLE1BQU0sU0FBUyxDQUFDLEVBQUUsS0FBSyxJQUFJLElBQy9DO0FBQUEsRUFDUjtBQUVBLFFBQU0saUJBQWlCLHFCQUFxQixhQUFhLE9BQU8sWUFBWSxVQUFVO0FBRXRGLE1BQUksY0FBYztBQUNsQixNQUFJLE9BQU8sZUFBZSxPQUFPLFlBQVksU0FBUyxHQUFHO0FBQ3JELFVBQU0sUUFBUSxPQUFPLFlBQVk7QUFBQSxNQUM3QixDQUFDLE1BQU0sU0FBUyxFQUFFLFNBQVMsZUFBZSxFQUFFO0FBQUEsSUFDaEQ7QUFDQSxrQkFBYyxzQkFBc0IsTUFBTSxLQUFLLElBQUksSUFBSTtBQUFBLEVBQzNEO0FBRUEsU0FDSSxnQkFDVyxPQUFPLGtCQUVULE9BQU8sT0FDaEIsWUFDQSx3QkFDUyxhQUFhLGdCQUdmLE9BQU8sT0FBTyx1QkFJckIsaUJBQ0EsT0FDQSxjQUNBLDRCQUVTLGNBQWMsU0FBUyxhQUFhO0FBRXJEOzs7QUhwSUEsSUFBcUIsd0JBQXJCLGNBQW1ELHVCQUFPO0FBQUEsRUFHdEQsTUFBTSxTQUFTO0FBQ1gsVUFBTSxLQUFLLGFBQWE7QUFFeEIsU0FBSyxXQUFXO0FBQUEsTUFDWixJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixlQUFlLENBQUMsYUFBc0I7QUFDbEMsY0FBTSxPQUFPLEtBQUssSUFBSSxVQUFVLGNBQWM7QUFDOUMsWUFBSSxRQUFRLEtBQUssY0FBYyxNQUFNO0FBQ2pDLGNBQUksQ0FBQztBQUNELGlCQUFLLGNBQWMsTUFBTSxLQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU07QUFDekMsc0JBQVEsTUFBTSxxQkFBcUIsQ0FBQztBQUNwQyxrQkFBSTtBQUFBLGdCQUNBLCtCQUErQixFQUFFLFdBQVc7QUFBQSxnQkFDNUM7QUFBQSxjQUNKO0FBQUEsWUFDSixDQUFDO0FBQ0wsaUJBQU87QUFBQSxRQUNYO0FBQ0EsZUFBTztBQUFBLE1BQ1g7QUFBQSxJQUNKLENBQUM7QUFFRCxTQUFLLFdBQVc7QUFBQSxNQUNaLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLGVBQWUsQ0FBQyxhQUFzQjtBQUNsQyxjQUFNLE9BQU8sS0FBSyxJQUFJLFVBQVUsY0FBYztBQUM5QyxZQUFJLFFBQVEsS0FBSyxjQUFjLE1BQU07QUFDakMsY0FBSSxDQUFDO0FBQ0QsaUJBQUssY0FBYyxNQUFNLElBQUksRUFBRSxNQUFNLENBQUMsTUFBTTtBQUN4QyxzQkFBUSxNQUFNLHFCQUFxQixDQUFDO0FBQ3BDLGtCQUFJO0FBQUEsZ0JBQ0EsK0JBQStCLEVBQUUsV0FBVztBQUFBLGdCQUM1QztBQUFBLGNBQ0o7QUFBQSxZQUNKLENBQUM7QUFDTCxpQkFBTztBQUFBLFFBQ1g7QUFDQSxlQUFPO0FBQUEsTUFDWDtBQUFBLElBQ0osQ0FBQztBQUVELFNBQUssV0FBVztBQUFBLE1BQ1osSUFBSTtBQUFBLE1BQ0osTUFBTTtBQUFBLE1BQ04sZUFBZSxDQUFDLGFBQXNCO0FBQ2xDLGNBQU0sT0FBTyxLQUFLLElBQUksVUFBVSxjQUFjO0FBQzlDLFlBQUksUUFBUSxLQUFLLGNBQWMsTUFBTTtBQUNqQyxjQUFJLENBQUM7QUFDRCxpQkFBSyxtQkFBbUIsRUFBRSxNQUFNLENBQUMsTUFBTTtBQUNuQyxzQkFBUSxNQUFNLHFCQUFxQixDQUFDO0FBQ3BDLGtCQUFJO0FBQUEsZ0JBQ0EsOEJBQThCLEVBQUUsV0FBVztBQUFBLGdCQUMzQztBQUFBLGNBQ0o7QUFBQSxZQUNKLENBQUM7QUFDTCxpQkFBTztBQUFBLFFBQ1g7QUFDQSxlQUFPO0FBQUEsTUFDWDtBQUFBLElBQ0osQ0FBQztBQUVELFNBQUssY0FBYyxJQUFJLDBCQUEwQixLQUFLLEtBQUssSUFBSSxDQUFDO0FBQUEsRUFDcEU7QUFBQSxFQUVBLE1BQU0sZUFBZTtBQUNqQixTQUFLLFdBQVcsT0FBTztBQUFBLE1BQ25CLENBQUM7QUFBQSxNQUNEO0FBQUEsTUFDQSxNQUFNLEtBQUssU0FBUztBQUFBLElBQ3hCO0FBQUEsRUFDSjtBQUFBLEVBRUEsTUFBTSxlQUFlO0FBQ2pCLFVBQU0sS0FBSyxTQUFTLEtBQUssUUFBUTtBQUFBLEVBQ3JDO0FBQUEsRUFFQSxNQUFNLFlBQW9DO0FBQ3RDLFVBQU0sSUFBSSxLQUFLO0FBQ2YsUUFBSSxDQUFDLEVBQUUsbUJBQW1CLENBQUMsRUFBRSxpQkFBaUIsQ0FBQyxFQUFFLEdBQUksUUFBTztBQUM1RCxRQUFJO0FBQ0EsYUFBTyxNQUFNLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsYUFBYTtBQUFBLElBQ3BFLFFBQVE7QUFDSixhQUFPO0FBQUEsSUFDWDtBQUFBLEVBQ0o7QUFBQSxFQUVBLE1BQU0sVUFBVSxPQUFlO0FBQzNCLFFBQUksQ0FBQyxLQUFLLFNBQVMsZUFBZTtBQUM5QixXQUFLLFNBQVMsZ0JBQWdCLE1BQU0sZUFBZTtBQUFBLElBQ3ZEO0FBQ0EsVUFBTSxTQUFTLE1BQU0sV0FBVyxPQUFPLEtBQUssU0FBUyxhQUFhO0FBQ2xFLFNBQUssU0FBUyxrQkFBa0IsT0FBTztBQUN2QyxTQUFLLFNBQVMsS0FBSyxPQUFPO0FBQzFCLFVBQU0sS0FBSyxhQUFhO0FBQUEsRUFDNUI7QUFBQSxFQUVBLE1BQU0sY0FBYztBQUNoQixTQUFLLFNBQVMsa0JBQWtCO0FBQ2hDLFNBQUssU0FBUyxLQUFLO0FBQ25CLFVBQU0sS0FBSyxhQUFhO0FBQUEsRUFDNUI7QUFBQSxFQUVBLE1BQU0sVUFBVSxRQUFnQixNQUFvQztBQUNoRSxVQUFNLFFBQVEsUUFBUSxPQUFPO0FBQzdCLFVBQU0sV0FBVyxLQUFLLFVBQVUsSUFBSTtBQUNwQyxXQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUNwQyxZQUFNLFVBQVU7QUFBQSxRQUNaLFVBQVU7QUFBQSxRQUNWLE1BQU07QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLFNBQVM7QUFBQSxVQUNMLGdCQUFnQjtBQUFBLFVBQ2hCLGFBQWE7QUFBQSxVQUNiLHFCQUFxQjtBQUFBLFVBQ3JCLGtCQUFrQixPQUFPLFdBQVcsUUFBUTtBQUFBLFFBQ2hEO0FBQUEsTUFDSjtBQUNBLFlBQU0sTUFBTSxNQUFNO0FBQUEsUUFDZDtBQUFBLFFBQ0EsQ0FBQyxRQUE4QztBQUMzQyxnQkFBTSxTQUFtQixDQUFDO0FBQzFCLGNBQUksR0FBRyxRQUFRLENBQUMsVUFBa0I7QUFDOUIsbUJBQU8sS0FBSyxLQUFLO0FBQUEsVUFDckIsQ0FBQztBQUNELGNBQUksR0FBRyxPQUFPLE1BQU07QUFDaEIsa0JBQU0sTUFBTSxPQUFPLE9BQU8sTUFBTSxFQUFFLFNBQVM7QUFDM0MsZ0JBQUk7QUFDQSxvQkFBTSxPQUFPLEtBQUssTUFBTSxHQUFHO0FBQzNCLGtCQUNJLElBQUksY0FBYyxPQUNsQixJQUFJLGFBQWEsS0FDbkI7QUFDRSx3QkFBUSxJQUFJO0FBQUEsY0FDaEIsT0FBTztBQUNILHNCQUFNLE1BQ0QsS0FBSyxTQUFTLEtBQUssTUFBTSxXQUMxQixVQUFVLElBQUk7QUFDbEIsdUJBQU8sSUFBSSxNQUFNLEdBQUcsQ0FBQztBQUFBLGNBQ3pCO0FBQUEsWUFDSixRQUFRO0FBQ0o7QUFBQSxnQkFDSSxJQUFJO0FBQUEsa0JBQ0EsdUJBQ0ksSUFBSSxVQUFVLEdBQUcsR0FBRztBQUFBLGdCQUM1QjtBQUFBLGNBQ0o7QUFBQSxZQUNKO0FBQUEsVUFDSixDQUFDO0FBQUEsUUFDTDtBQUFBLE1BQ0o7QUFDQSxVQUFJLEdBQUcsU0FBUyxDQUFDLE1BQWE7QUFDMUIsZUFBTyxJQUFJLE1BQU0sb0JBQW9CLEVBQUUsT0FBTyxDQUFDO0FBQUEsTUFDbkQsQ0FBQztBQUNELFVBQUksV0FBVyxNQUFRLE1BQU07QUFDekIsWUFBSSxRQUFRO0FBQ1osZUFBTyxJQUFJLE1BQU0sbUJBQW1CLENBQUM7QUFBQSxNQUN6QyxDQUFDO0FBQ0QsVUFBSSxNQUFNLFFBQVE7QUFDbEIsVUFBSSxJQUFJO0FBQUEsSUFDWixDQUFDO0FBQUEsRUFDTDtBQUFBLEVBRUEsTUFBTSxXQUNGLFFBQ0EsU0FDQSxnQkFDdUI7QUFDdkIsVUFBTSxPQUFPLE1BQU0sS0FBSyxVQUFVLFFBQVE7QUFBQSxNQUN0QyxPQUFPLEtBQUssU0FBUztBQUFBLE1BQ3JCLFlBQVk7QUFBQSxNQUNaLFFBQVE7QUFBQSxNQUNSLFVBQVUsQ0FBQyxFQUFFLE1BQU0sUUFBUSxTQUFTLGlCQUFpQixRQUFRLENBQUM7QUFBQSxJQUNsRSxDQUFDO0FBRUQsUUFBSTtBQUNKLFFBQUk7QUFDQSxhQUFPLEtBQUssUUFBUSxDQUFDLEVBQUUsS0FBSyxLQUFLO0FBQUEsSUFDckMsUUFBUTtBQUNKLGNBQVE7QUFBQSxRQUNKO0FBQUEsUUFDQTtBQUFBLE1BQ0o7QUFDQSxZQUFNLElBQUksTUFBTSxnQ0FBZ0M7QUFBQSxJQUNwRDtBQUNBLFFBQUksS0FBSyxXQUFXLEtBQUssR0FBRztBQUN4QixhQUFPLEtBQ0YsUUFBUSxjQUFjLEVBQUUsRUFDeEIsUUFBUSxXQUFXLEVBQUUsRUFDckIsS0FBSztBQUFBLElBQ2Q7QUFDQSxRQUFJO0FBQ0EsYUFBTyxLQUFLLE1BQU0sSUFBSTtBQUFBLElBQzFCLFFBQVE7QUFDSixjQUFRO0FBQUEsUUFDSjtBQUFBLFFBQ0EsS0FBSyxVQUFVLEdBQUcsR0FBRztBQUFBLE1BQ3pCO0FBQ0EsWUFBTSxJQUFJLE1BQU0sK0NBQTBDO0FBQUEsSUFDOUQ7QUFBQSxFQUNKO0FBQUEsRUFFQSxNQUFNLGlCQUE0RDtBQUM5RCxVQUFNLFNBQVMsTUFBTSxLQUFLLFVBQVU7QUFDcEMsUUFBSSxDQUFDLFFBQVE7QUFDVCxhQUFPLEVBQUUsSUFBSSxPQUFPLFNBQVMsd0JBQXdCO0FBQUEsSUFDekQ7QUFDQSxRQUFJO0FBQ0EsWUFBTSxLQUFLLFVBQVUsUUFBUTtBQUFBLFFBQ3pCLE9BQU8sS0FBSyxTQUFTO0FBQUEsUUFDckIsWUFBWTtBQUFBLFFBQ1osVUFBVSxDQUFDLEVBQUUsTUFBTSxRQUFRLFNBQVMsV0FBVyxDQUFDO0FBQUEsTUFDcEQsQ0FBQztBQUNELGFBQU87QUFBQSxRQUNILElBQUk7QUFBQSxRQUNKLFNBQVMsdUJBQXVCLEtBQUssU0FBUztBQUFBLE1BQ2xEO0FBQUEsSUFDSixTQUFTLEdBQVE7QUFDYixhQUFPLEVBQUUsSUFBSSxPQUFPLFNBQVMsRUFBRSxRQUFRO0FBQUEsSUFDM0M7QUFBQSxFQUNKO0FBQUEsRUFFQSxNQUFNLGFBQWEsTUFBYztBQUM3QixRQUFJLENBQUMsS0FBSyxJQUFJLE1BQU0sc0JBQXNCLElBQUksR0FBRztBQUM3QyxZQUFNLEtBQUssSUFBSSxNQUFNLGFBQWEsSUFBSTtBQUFBLElBQzFDO0FBQUEsRUFDSjtBQUFBLEVBRUEsTUFBTSxrQkFDRixNQUNBLFFBQ0EsYUFDQSxZQUNBLFFBQ3lEO0FBQ3pELFVBQU0sU0FBUyxTQUFTLFdBQVcsV0FBVztBQUM5QyxVQUFNLFdBQVcsaUJBQWlCLE9BQU8sSUFBSTtBQUM3QyxVQUFNLE9BQU8sU0FBUyxNQUFNLFdBQVc7QUFDdkMsVUFBTSxXQUFXLEtBQUssSUFBSSxNQUFNLHNCQUFzQixJQUFJO0FBRTFELFFBQUksWUFBWSxvQkFBb0IsdUJBQU87QUFDdkMsWUFBTSxVQUFVLE1BQU0sS0FBSyxJQUFJLE1BQU0sS0FBSyxRQUFRO0FBRWxELFVBQUksUUFBUSxTQUFTLE9BQU8sY0FBYyxJQUFJLEdBQUc7QUFDN0MsZUFBTyxFQUFFLFFBQVEsUUFBUSxLQUFLO0FBQUEsTUFDbEM7QUFFQSxVQUFJLENBQUMsUUFBUTtBQUNULFlBQUksVUFBVTtBQUNkLGNBQU0sYUFBYTtBQUFBLFVBQ2Y7QUFBQSxVQUNBLE9BQU87QUFBQSxVQUNQO0FBQUEsUUFDSjtBQUNBLGNBQU0sZ0JBQWdCLFNBQVMsY0FBYyxTQUFTLGFBQWE7QUFHbkUsWUFBSSxRQUFRLFNBQVMsaUJBQWlCLEdBQUc7QUFDckMsb0JBQVUsUUFBUTtBQUFBLFlBQ2Q7QUFBQSxZQUNBLGFBQWE7QUFBQSxVQUNqQjtBQUFBLFFBQ0osV0FBVyxRQUFRLFNBQVMsWUFBWSxHQUFHO0FBQ3ZDLHFCQUFXLE9BQU87QUFBQSxRQUN0QixXQUFXLFFBQVEsU0FBUyxvQkFBb0IsR0FBRztBQUMvQyxxQkFBVyxPQUFPO0FBQUEsUUFDdEI7QUFFQSxZQUFJLENBQUMsUUFBUSxTQUFTLE9BQU8sY0FBYyxJQUFJLEdBQUc7QUFDOUMsY0FBSSxRQUFRLFNBQVMsaUJBQWlCLEdBQUc7QUFDckMsc0JBQVUsUUFBUTtBQUFBLGNBQ2Q7QUFBQSxjQUNBLHNCQUFzQjtBQUFBLFlBQzFCO0FBQUEsVUFDSixPQUFPO0FBQ0gsdUJBQ0ksMEJBQTBCLGdCQUFnQjtBQUFBLFVBQ2xEO0FBQUEsUUFDSjtBQUdBLFlBQUksQ0FBQyxRQUFRLFNBQVMsU0FBUyxVQUFVLEdBQUc7QUFDeEMsb0JBQVUsUUFBUTtBQUFBLFlBQ2Q7QUFBQSxZQUNBLFdBQVcsYUFBYTtBQUFBLFVBQzVCO0FBQUEsUUFDSjtBQUVBLGNBQU0sS0FBSyxJQUFJLE1BQU0sT0FBTyxVQUFVLE9BQU87QUFBQSxNQUNqRDtBQUNBLGFBQU8sRUFBRSxRQUFRLFNBQVMsS0FBSztBQUFBLElBQ25DO0FBRUEsUUFBSSxDQUFDLFFBQVE7QUFDVCxZQUFNLE9BQU8sZ0JBQWdCLE1BQU0sUUFBUSxhQUFhLFVBQVU7QUFDbEUsWUFBTSxLQUFLLElBQUksTUFBTSxPQUFPLE1BQU0sSUFBSTtBQUFBLElBQzFDO0FBQ0EsV0FBTztBQUFBLE1BQ0gsUUFBUTtBQUFBLE1BQ1I7QUFBQSxNQUNBLFFBQVEsT0FBTyxjQUFjLENBQUMsR0FBRztBQUFBLElBQ3JDO0FBQUEsRUFDSjtBQUFBLEVBRUEsTUFBTSxjQUFjLE1BQWEsUUFBaUI7QUFDOUMsUUFBSTtBQUNBLFlBQU0sU0FBUyxNQUFNLEtBQUssVUFBVTtBQUNwQyxVQUFJLENBQUMsUUFBUTtBQUNULFlBQUk7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0o7QUFDQTtBQUFBLE1BQ0o7QUFFQSxZQUFNLFVBQVUsTUFBTSxLQUFLLElBQUksTUFBTSxLQUFLLElBQUk7QUFDOUMsWUFBTSxTQUFTLGdCQUFnQixTQUFTLEtBQUssSUFBSTtBQUNqRCxZQUFNLEVBQUUsT0FBTyxZQUFZLEtBQUssSUFBSTtBQUNwQyxZQUFNLFVBQVUsS0FBSyxPQUFPO0FBRTVCLFVBQUksQ0FBQyxPQUFPLGVBQWU7QUFDdkIsWUFBSTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDSjtBQUNBO0FBQUEsTUFDSjtBQUVBLFlBQU0saUJBQWlCLHNCQUFzQixZQUFZLE9BQU87QUFFaEUsWUFBTSxPQUFPLFNBQVMsZUFBZTtBQUNyQyxVQUFJO0FBQUEsUUFDQSwrQkFBK0IsUUFBUSxRQUFRLGFBQWEsU0FBUztBQUFBLFFBQ3JFO0FBQUEsTUFDSjtBQUVBLFVBQUk7QUFDSixVQUFJO0FBQ0EsZUFBTyxNQUFNLEtBQUssV0FBVyxRQUFRLFNBQVMsY0FBYztBQUFBLE1BQ2hFLFNBQVMsR0FBUTtBQUNiLFlBQUk7QUFBQSxVQUNBLHVCQUF1QixFQUFFLFdBQVc7QUFBQSxVQUNwQztBQUFBLFFBQ0o7QUFDQTtBQUFBLE1BQ0o7QUFFQSxZQUFNLFNBQVMsS0FBSyxVQUFVLENBQUM7QUFDL0IsWUFBTSxXQUFXLEtBQUssWUFBWSxDQUFDO0FBRW5DLFVBQUksU0FBUztBQUNULFNBQUMsUUFBUSxRQUFRLEVBQUUsUUFBUSxDQUFDLFNBQVM7QUFDakMsZUFBSyxRQUFRLENBQUMsV0FBVztBQUNyQixtQkFBTyxjQUFjLE9BQU8sY0FBYyxDQUFDLEdBQUc7QUFBQSxjQUMxQyxDQUFDLE1BQU0sRUFBRSxPQUFPLFFBQVEsS0FBSyxJQUFJLEVBQUUsR0FBRztBQUFBLFlBQzFDO0FBQUEsVUFDSixDQUFDO0FBQUEsUUFDTCxDQUFDO0FBQUEsTUFDTDtBQUVBLFVBQUk7QUFBQSxRQUNBLFdBQ0ksT0FBTyxTQUNQLGNBQ0EsU0FBUyxTQUNULGVBQ0E7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUVBLFlBQU0sVUFBOEIsQ0FBQztBQUNyQyxVQUFJO0FBQ0EsWUFBSSxDQUFDLFFBQVE7QUFDVCxnQkFBTSxLQUFLLGFBQWEsUUFBUTtBQUNoQyxnQkFBTSxLQUFLLGFBQWEsVUFBVTtBQUFBLFFBQ3RDO0FBRUEsbUJBQVcsVUFBVSxRQUFRO0FBQ3pCLGdCQUFNLElBQUksTUFBTSxLQUFLO0FBQUEsWUFDakI7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsVUFDSjtBQUNBLGtCQUFRLEtBQUs7QUFBQSxZQUNULE1BQU0sT0FBTztBQUFBLFlBQ2IsTUFBTTtBQUFBLFlBQ04sR0FBRztBQUFBLFVBQ1AsQ0FBQztBQUFBLFFBQ0w7QUFDQSxtQkFBVyxXQUFXLFVBQVU7QUFDNUIsZ0JBQU0sSUFBSSxNQUFNLEtBQUs7QUFBQSxZQUNqQjtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNKO0FBQ0Esa0JBQVEsS0FBSztBQUFBLFlBQ1QsTUFBTSxRQUFRO0FBQUEsWUFDZCxNQUFNO0FBQUEsWUFDTixHQUFHO0FBQUEsVUFDUCxDQUFDO0FBQUEsUUFDTDtBQUVBLFlBQUksQ0FBQyxRQUFRLFNBQVMsYUFBYSxLQUFLLENBQUMsUUFBUTtBQUM3QyxnQkFBTSxTQUFTLE9BQ1YsSUFBSSxDQUFDLE1BQU0sT0FBTyxFQUFFLE9BQU8sSUFBSSxFQUMvQixLQUFLLElBQUk7QUFDZCxnQkFBTSxTQUFTLFNBQ1YsSUFBSSxDQUFDLE1BQU0sT0FBTyxFQUFFLE9BQU8sSUFBSSxFQUMvQixLQUFLLElBQUk7QUFDZCxnQkFBTSxVQUNGLGtDQUNBLFNBQ0EsdUJBQ0EsU0FDQTtBQUNKLGdCQUFNLEtBQUssSUFBSSxNQUFNLE9BQU8sTUFBTSxVQUFVLE9BQU87QUFBQSxRQUN2RDtBQUFBLE1BQ0osU0FBUyxHQUFRO0FBQ2IsZ0JBQVEsTUFBTSwyQ0FBMkMsQ0FBQztBQUMxRCxZQUFJO0FBQUEsVUFDQSw0QkFBNEIsRUFBRSxXQUFXO0FBQUEsVUFDekM7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUVBLFlBQU0sUUFBUSxJQUFJLGFBQWEsS0FBSyxLQUFLLE9BQU8sU0FBUyxNQUFNO0FBQy9ELFlBQU0sS0FBSztBQUFBLElBQ2YsU0FBUyxHQUFRO0FBQ2IsY0FBUSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3RELFVBQUk7QUFBQSxRQUNBLCtCQUErQixFQUFFLFdBQVc7QUFBQSxRQUM1QztBQUFBLE1BQ0o7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUFBLEVBRUEsTUFBTSxxQkFBcUI7QUFDdkIsVUFBTSxhQUFhLEtBQUssSUFBSSxVQUFVLGNBQWM7QUFDcEQsUUFBSSxDQUFDLFlBQVk7QUFDYixVQUFJLHVCQUFPLGlFQUE0RCxHQUFJO0FBQzNFO0FBQUEsSUFDSjtBQUVBLFVBQU0sU0FBUyxNQUFNLEtBQUssVUFBVTtBQUNwQyxRQUFJLENBQUMsUUFBUTtBQUNULFVBQUk7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0o7QUFDQTtBQUFBLElBQ0o7QUFFQSxVQUFNLGFBQWEsV0FBVyxRQUFRLFFBQVE7QUFDOUMsVUFBTSxXQUFXLEtBQUssSUFBSSxNQUFNLGlCQUFpQixFQUFFO0FBQUEsTUFDL0MsQ0FBQyxNQUFNLEVBQUUsUUFBUSxTQUFTO0FBQUEsSUFDOUI7QUFHQSxVQUFNLFlBQXFCLENBQUM7QUFDNUIsZUFBVyxLQUFLLFVBQVU7QUFDdEIsWUFBTSxVQUFVLE1BQU0sS0FBSyxJQUFJLE1BQU0sS0FBSyxDQUFDO0FBQzNDLFVBQUksQ0FBQyxRQUFRLFNBQVMsYUFBYSxHQUFHO0FBQ2xDLGNBQU0sU0FBUyxnQkFBZ0IsU0FBUyxFQUFFLElBQUk7QUFDOUMsWUFBSSxPQUFPLGVBQWU7QUFDdEIsb0JBQVUsS0FBSyxDQUFDO0FBQUEsUUFDcEI7QUFBQSxNQUNKO0FBQUEsSUFDSjtBQUVBLFFBQUksVUFBVSxXQUFXLEdBQUc7QUFDeEIsVUFBSSx1QkFBTyxvREFBb0QsY0FBYyxTQUFTLEdBQUk7QUFDMUY7QUFBQSxJQUNKO0FBRUEsUUFBSTtBQUFBLE1BQ0EsdUJBQXVCLFVBQVUsU0FBUyxnQkFBZ0IsY0FBYyxVQUFVO0FBQUEsTUFDbEY7QUFBQSxJQUNKO0FBRUEsUUFBSSxZQUFZO0FBQ2hCLFFBQUksU0FBUztBQUNiLGVBQVcsUUFBUSxXQUFXO0FBQzFCO0FBQ0EsVUFBSTtBQUNBLFlBQUk7QUFBQSxVQUNBLGdCQUFnQixZQUFZLE1BQU0sVUFBVSxTQUFTLE9BQU8sS0FBSztBQUFBLFVBQ2pFO0FBQUEsUUFDSjtBQUNBLGNBQU0sS0FBSyxjQUFjLE1BQU0sS0FBSztBQUVwQyxZQUFJLFlBQVksVUFBVSxRQUFRO0FBQzlCLGdCQUFNLElBQUksUUFBUSxDQUFDLE1BQU0sV0FBVyxHQUFHLEdBQUksQ0FBQztBQUFBLFFBQ2hEO0FBQUEsTUFDSixTQUFTLEdBQVE7QUFDYjtBQUNBLGdCQUFRLE1BQU0sc0NBQXNDLEtBQUssTUFBTSxDQUFDO0FBQUEsTUFDcEU7QUFBQSxJQUNKO0FBRUEsUUFBSTtBQUFBLE1BQ0EscUJBQXFCLFlBQVksaUJBQWlCLFNBQVM7QUFBQSxNQUMzRDtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQ0o7QUFNQSxJQUFNLGVBQU4sY0FBMkIsc0JBQU07QUFBQSxFQUs3QixZQUNJLEtBQ0EsYUFDQSxTQUNBLFFBQ0Y7QUFDRSxVQUFNLEdBQUc7QUFDVCxTQUFLLGNBQWM7QUFDbkIsU0FBSyxVQUFVO0FBQ2YsU0FBSyxTQUFTO0FBQUEsRUFDbEI7QUFBQSxFQUVBLFNBQVM7QUFDTCxVQUFNLEVBQUUsVUFBVSxJQUFJO0FBQ3RCLFVBQU0sVUFBVSxLQUFLLFFBQVE7QUFBQSxNQUN6QixDQUFDLE1BQU0sRUFBRSxXQUFXO0FBQUEsSUFDeEIsRUFBRTtBQUNGLFVBQU0sU0FBUyxLQUFLLFFBQVE7QUFBQSxNQUN4QixDQUFDLE1BQU0sRUFBRSxXQUFXO0FBQUEsSUFDeEIsRUFBRTtBQUNGLFVBQU0sVUFBVSxLQUFLLFFBQVE7QUFBQSxNQUN6QixDQUFDLE1BQU0sRUFBRSxXQUFXO0FBQUEsSUFDeEIsRUFBRTtBQUVGLFVBQU0sVUFBVSxLQUFLLFNBQ2YsY0FBYyxLQUFLLGNBQ25CO0FBQ04sY0FBVSxTQUFTLE1BQU0sRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUUxQyxVQUFNLFFBQWtCLENBQUM7QUFDekIsUUFBSSxVQUFVLEVBQUcsT0FBTSxLQUFLLFVBQVUsVUFBVTtBQUNoRCxRQUFJLFNBQVMsRUFBRyxPQUFNLEtBQUssU0FBUyxTQUFTO0FBQzdDLFFBQUksVUFBVSxFQUFHLE9BQU0sS0FBSyxVQUFVLFVBQVU7QUFDaEQsY0FBVSxTQUFTLEtBQUs7QUFBQSxNQUNwQixNQUFNLEtBQUssU0FDTCxtQkFDQSxLQUFLLFFBQVEsU0FDYixvQkFDQSxLQUFLLGNBQ0wsTUFBTSxLQUFLLElBQUksSUFBSSxrQkFBYSxLQUFLO0FBQUEsSUFDL0MsQ0FBQztBQUVELFVBQU0sU0FBUyxLQUFLLFFBQVEsT0FBTyxDQUFDLE1BQU0sRUFBRSxTQUFTLFFBQVE7QUFDN0QsVUFBTSxXQUFXLEtBQUssUUFBUSxPQUFPLENBQUMsTUFBTSxFQUFFLFNBQVMsU0FBUztBQUVoRSxRQUFJLE9BQU8sU0FBUyxHQUFHO0FBQ25CLGdCQUFVLFNBQVMsTUFBTTtBQUFBLFFBQ3JCLE1BQU0sYUFBYSxPQUFPLFNBQVM7QUFBQSxNQUN2QyxDQUFDO0FBQ0QsWUFBTSxRQUFRLFVBQVUsU0FBUyxJQUFJO0FBQ3JDLGFBQU8sUUFBUSxDQUFDLE1BQU07QUFDbEIsY0FBTSxLQUFLLE1BQU0sU0FBUyxJQUFJO0FBQzlCLGNBQU0sUUFDRixFQUFFLFdBQVcsV0FDUCxPQUNBLEVBQUUsV0FBVyxVQUNYLE9BQ0E7QUFDWixZQUFJLENBQUMsS0FBSyxVQUFVLEVBQUUsV0FBVyxRQUFRO0FBQ3JDLGdCQUFNLE9BQU8sR0FBRyxTQUFTLEtBQUs7QUFBQSxZQUMxQixNQUFNLFFBQVEsRUFBRTtBQUFBLFlBQ2hCLEtBQUs7QUFBQSxVQUNULENBQUM7QUFDRCxlQUFLLGlCQUFpQixTQUFTLENBQUMsTUFBTTtBQUNsQyxjQUFFLGVBQWU7QUFDakIsaUJBQUssSUFBSSxVQUFVLGFBQWEsRUFBRSxNQUFNLElBQUksS0FBSztBQUNqRCxpQkFBSyxNQUFNO0FBQUEsVUFDZixDQUFDO0FBQUEsUUFDTCxPQUFPO0FBQ0gsYUFBRyxRQUFRLFFBQVEsRUFBRSxJQUFJO0FBQUEsUUFDN0I7QUFBQSxNQUNKLENBQUM7QUFBQSxJQUNMO0FBRUEsUUFBSSxTQUFTLFNBQVMsR0FBRztBQUNyQixnQkFBVSxTQUFTLE1BQU07QUFBQSxRQUNyQixNQUFNLGVBQWUsU0FBUyxTQUFTO0FBQUEsTUFDM0MsQ0FBQztBQUNELFlBQU0sUUFBUSxVQUFVLFNBQVMsSUFBSTtBQUNyQyxlQUFTLFFBQVEsQ0FBQyxNQUFNO0FBQ3BCLGNBQU0sS0FBSyxNQUFNLFNBQVMsSUFBSTtBQUM5QixjQUFNLFFBQ0YsRUFBRSxXQUFXLFdBQ1AsT0FDQSxFQUFFLFdBQVcsVUFDWCxPQUNBO0FBQ1osWUFBSSxDQUFDLEtBQUssVUFBVSxFQUFFLFdBQVcsUUFBUTtBQUNyQyxnQkFBTSxPQUFPLEdBQUcsU0FBUyxLQUFLO0FBQUEsWUFDMUIsTUFBTSxRQUFRLEVBQUU7QUFBQSxZQUNoQixLQUFLO0FBQUEsVUFDVCxDQUFDO0FBQ0QsZUFBSyxpQkFBaUIsU0FBUyxDQUFDLE1BQU07QUFDbEMsY0FBRSxlQUFlO0FBQ2pCLGlCQUFLLElBQUksVUFBVSxhQUFhLEVBQUUsTUFBTSxJQUFJLEtBQUs7QUFDakQsaUJBQUssTUFBTTtBQUFBLFVBQ2YsQ0FBQztBQUFBLFFBQ0wsT0FBTztBQUNILGFBQUcsUUFBUSxRQUFRLEVBQUUsSUFBSTtBQUFBLFFBQzdCO0FBQUEsTUFDSixDQUFDO0FBQUEsSUFDTDtBQUVBLFVBQU0sU0FBUyxLQUFLLFNBQ2QsaURBQ0E7QUFDTixjQUFVLFNBQVMsS0FBSztBQUFBLE1BQ3BCLE1BQU07QUFBQSxNQUNOLEtBQUs7QUFBQSxJQUNULENBQUM7QUFBQSxFQUNMO0FBQUEsRUFFQSxVQUFVO0FBQ04sU0FBSyxVQUFVLE1BQU07QUFBQSxFQUN6QjtBQUNKO0FBTUEsSUFBTSw0QkFBTixjQUF3QyxpQ0FBaUI7QUFBQSxFQUdyRCxZQUFZLEtBQVUsUUFBK0I7QUFDakQsVUFBTSxLQUFLLE1BQU07QUFDakIsU0FBSyxTQUFTO0FBQUEsRUFDbEI7QUFBQSxFQUVBLFVBQVU7QUFDTixVQUFNLEVBQUUsWUFBWSxJQUFJO0FBQ3hCLFVBQU0sRUFBRSxPQUFPLElBQUk7QUFDbkIsZ0JBQVksTUFBTTtBQUVsQixnQkFBWSxTQUFTLE1BQU0sRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBRXZELFVBQU0sU0FBUyxDQUFDLENBQUMsT0FBTyxTQUFTO0FBRWpDLFFBQUk7QUFDSixRQUFJLHdCQUFRLFdBQVcsRUFDbEIsUUFBUSxtQkFBbUIsRUFDM0I7QUFBQSxNQUNHLFNBQ00sNkVBQ0E7QUFBQSxJQUNWLEVBQ0MsUUFBUSxDQUFDLFNBQVM7QUFDZixvQkFBYztBQUNkLFdBQUssUUFBUSxPQUFPO0FBQ3BCLFdBQUssUUFBUSxNQUFNLFFBQVE7QUFDM0IsV0FBSztBQUFBLFFBQ0QsU0FDTSxxR0FDQTtBQUFBLE1BQ1Y7QUFBQSxJQUNKLENBQUMsRUFDQSxVQUFVLENBQUMsUUFBUTtBQUNoQixVQUFJLGNBQWMsVUFBVSxFQUN2QixPQUFPLEVBQ1AsUUFBUSxZQUFZO0FBQ2pCLGNBQU0sUUFBUSxZQUFZLFNBQVM7QUFDbkMsWUFBSSxTQUFTLE1BQU0sU0FBUyxJQUFJO0FBQzVCLGdCQUFNLE9BQU8sVUFBVSxLQUFLO0FBQzVCLHNCQUFZLFNBQVMsRUFBRTtBQUN2QixzQkFBWTtBQUFBLFlBQ1I7QUFBQSxVQUNKO0FBQ0EsY0FBSSx1QkFBTyw2QkFBNkIsR0FBSTtBQUFBLFFBQ2hELE9BQU87QUFDSCxjQUFJO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNKO0FBQUEsUUFDSjtBQUFBLE1BQ0osQ0FBQztBQUFBLElBQ1QsQ0FBQztBQUVMLFFBQUksUUFBUTtBQUNSLFVBQUksd0JBQVEsV0FBVyxFQUNsQixRQUFRLGVBQWUsRUFDdkIsUUFBUSwyQkFBMkIsRUFDbkMsVUFBVSxDQUFDLFFBQVE7QUFDaEIsWUFBSSxjQUFjLE9BQU8sRUFDcEIsV0FBVyxFQUNYLFFBQVEsWUFBWTtBQUNqQixnQkFBTSxPQUFPLFlBQVk7QUFDekIsY0FBSSx1QkFBTyxtQkFBbUIsR0FBSTtBQUNsQyxlQUFLLFFBQVE7QUFBQSxRQUNqQixDQUFDO0FBQUEsTUFDVCxDQUFDO0FBQUEsSUFDVDtBQUVBLFFBQUksUUFBUTtBQUNSLFVBQUksd0JBQVEsV0FBVyxFQUNsQixRQUFRLGlCQUFpQixFQUN6QixRQUFRLG9DQUFvQyxFQUM1QyxVQUFVLENBQUMsUUFBUTtBQUNoQixZQUFJLGNBQWMsTUFBTSxFQUFFLFFBQVEsWUFBWTtBQUMxQyxjQUFJLGNBQWMsWUFBWTtBQUM5QixjQUFJLFlBQVksSUFBSTtBQUNwQixnQkFBTSxTQUFTLE1BQU0sT0FBTyxlQUFlO0FBQzNDLGNBQUksWUFBWSxLQUFLO0FBQ3JCLGNBQUksT0FBTyxJQUFJO0FBQ1gsZ0JBQUksY0FBYyxLQUFLO0FBQ3ZCLGdCQUFJLHVCQUFPLE9BQU8sU0FBUyxHQUFJO0FBQUEsVUFDbkMsT0FBTztBQUNILGdCQUFJLGNBQWMsUUFBUTtBQUMxQixnQkFBSTtBQUFBLGNBQ0Esd0JBQXdCLE9BQU87QUFBQSxjQUMvQjtBQUFBLFlBQ0o7QUFBQSxVQUNKO0FBQ0EscUJBQVcsTUFBTTtBQUNiLGdCQUFJLGNBQWMsTUFBTTtBQUFBLFVBQzVCLEdBQUcsR0FBSTtBQUFBLFFBQ1gsQ0FBQztBQUFBLE1BQ0wsQ0FBQztBQUFBLElBQ1Q7QUFFQSxRQUFJLHdCQUFRLFdBQVcsRUFDbEIsUUFBUSxPQUFPLEVBQ2YsUUFBUSxvQ0FBb0MsRUFDNUMsWUFBWSxDQUFDLE9BQU87QUFDakIsU0FBRztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsTUFDSixFQUNLO0FBQUEsUUFDRztBQUFBLFFBQ0E7QUFBQSxNQUNKLEVBQ0M7QUFBQSxRQUNHO0FBQUEsUUFDQTtBQUFBLE1BQ0osRUFDQyxTQUFTLE9BQU8sU0FBUyxLQUFLLEVBQzlCLFNBQVMsT0FBTyxVQUFVO0FBQ3ZCLGVBQU8sU0FBUyxRQUFRO0FBQ3hCLGNBQU0sT0FBTyxhQUFhO0FBQUEsTUFDOUIsQ0FBQztBQUFBLElBQ1QsQ0FBQztBQUVMLGdCQUFZLFNBQVMsTUFBTSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQzVDLFVBQU0sUUFBUSxZQUFZLFNBQVMsS0FBSztBQUN4QyxVQUFNLFNBQVMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPO0FBQzdCLFNBQUcsU0FBUyxNQUFNO0FBQUEsUUFDZCxNQUFNO0FBQUEsTUFDVixDQUFDO0FBQ0QsU0FBRyxTQUFTLE1BQU0sRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLFNBQUcsU0FBUyxNQUFNO0FBQUEsUUFDZCxNQUFNO0FBQUEsTUFDVixDQUFDO0FBQ0QsU0FBRyxTQUFTLE1BQU07QUFBQSxRQUNkLE1BQU07QUFBQSxNQUNWLENBQUM7QUFBQSxJQUNMLENBQUM7QUFDRCxVQUFNLE1BQU0sWUFBWSxTQUFTLEtBQUs7QUFBQSxNQUNsQyxLQUFLO0FBQUEsSUFDVCxDQUFDO0FBQ0QsUUFBSTtBQUFBLE1BQ0E7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUNKOyIsCiAgIm5hbWVzIjogW10KfQo=
