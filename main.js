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
var SYSTEM_PROMPT = "You are an expert at analyzing book highlights and extracting structured entity data. You return only valid JSON, no markdown fencing.";
var EXTRACTION_PROMPT_WITH_REFS = 'Analyze this book note (Kindle highlights) and extract all notable entities.\n\nReturn a JSON object with this exact structure:\n{\n  "people": [\n    {\n      "name": "Full Name",\n      "aliases": ["Nickname"],\n      "major": true,\n      "highlights": [\n        {"ref": "ref-XXXXX", "summary": "Brief 5-10 word description"}\n      ],\n      "connections": [\n        {"entity": "Other Entity Name", "relationship": "brief description"}\n      ]\n    }\n  ],\n  "concepts": [\n    {\n      "name": "Concept Name",\n      "aliases": ["alternate name"],\n      "major": true,\n      "highlights": [\n        {"ref": "ref-XXXXX", "summary": "Brief description"}\n      ],\n      "connections": [\n        {"entity": "Person or Concept Name", "relationship": "brief description"}\n      ]\n    }\n  ]\n}\n\nRules:\n- "major" is true if the entity has significant coverage (multiple highlights or central to the narrative), false for brief/passing mentions\n- Only use ref IDs that actually appear in the text (they look like ^ref-XXXXX at the end of highlights)\n- A highlight can be associated with multiple entities\n- For connections, only link to other entities you are extracting (not external figures)\n- People connections should include relationships like "co-developer", "student", "advisor", "colleague", "critic"\n- Concept connections should link to related people AND related concepts\n- Include ALL people mentioned by name, even briefly \u2014 they become stubs\n- For concepts, focus on technical/intellectual concepts, not general terms\n- Return ONLY the JSON object, no markdown fencing or explanation\n\nBook note content:\n';
var EXTRACTION_PROMPT_NO_REFS = 'Analyze this book note (highlights from Readwise or similar) and extract all notable entities.\nThis note does NOT have ^ref-XXXXX block IDs. Instead, provide a "quote" field with a short excerpt (first ~80 chars) from the relevant highlight text.\n\nReturn a JSON object with this exact structure:\n{\n  "people": [\n    {\n      "name": "Full Name",\n      "aliases": ["Nickname"],\n      "major": true,\n      "highlights": [\n        {"quote": "First ~80 chars of the highlight text...", "summary": "Brief 5-10 word description"}\n      ],\n      "connections": [\n        {"entity": "Other Entity Name", "relationship": "brief description"}\n      ]\n    }\n  ],\n  "concepts": [\n    {\n      "name": "Concept Name",\n      "aliases": ["alternate name"],\n      "major": true,\n      "highlights": [\n        {"quote": "First ~80 chars of the highlight text...", "summary": "Brief description"}\n      ],\n      "connections": [\n        {"entity": "Person or Concept Name", "relationship": "brief description"}\n      ]\n    }\n  ]\n}\n\nRules:\n- "major" is true if the entity has significant coverage (multiple highlights or central to the narrative), false for brief/passing mentions\n- For "quote", use the first ~80 characters of the actual highlight text from the note (enough to identify it)\n- A highlight can be associated with multiple entities\n- For connections, only link to other entities you are extracting (not external figures)\n- People connections should include relationships like "co-developer", "student", "advisor", "colleague", "critic"\n- Concept connections should link to related people AND related concepts\n- Include ALL people mentioned by name, even briefly \u2014 they become stubs\n- For concepts, focus on technical/intellectual concepts, not general terms\n- Return ONLY the JSON object, no markdown fencing or explanation\n\nBook note content:\n';
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
function parseBookNote(content) {
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled";
  const refs = /* @__PURE__ */ new Set();
  const re = /\^(ref-\d+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    refs.add(m[1]);
  }
  let hasReadwiseHighlights = false;
  if (refs.size === 0) {
    hasReadwiseHighlights = /\(\[Location\s+\d+\]\(/.test(content) || /^>\s+.{10,}/m.test(content) || /\n---\n/.test(content);
  }
  return { title, refs, hasReadwiseHighlights };
}
function formatReadingSection(bookTitle, highlights) {
  if (!highlights || highlights.length === 0) {
    return "### [[" + bookTitle + "]]\n- Mentioned in text\n";
  }
  const lines = highlights.map((h) => {
    if (h.ref) {
      return "- " + h.summary + " ![[" + bookTitle + "#^" + h.ref + "]]";
    }
    return "- " + h.summary;
  });
  return "### [[" + bookTitle + "]]\n" + lines.join("\n") + "\n";
}
function buildEntityNote(type, entity, bookTitle) {
  let aliasYaml = "";
  if (entity.aliases && entity.aliases.length > 0) {
    aliasYaml = "aliases:\n" + entity.aliases.map((a) => "  - " + a).join("\n") + "\n";
  }
  const readingSection = formatReadingSection(bookTitle, entity.highlights);
  let connections = "";
  if (entity.connections && entity.connections.length > 0) {
    const lines = entity.connections.map(
      (c) => "- [[" + c.entity + "]] \u2014 " + c.relationship
    );
    connections = "## Connected To\n" + lines.join("\n") + "\n";
  }
  return "---\ntype: " + type + "\ntags:\n  - " + type + "\n" + aliasYaml + "---\n\n# " + entity.name + "\n\n## From My Reading\n\n" + readingSection + "\n" + connections + "\n## Mentioned In\n- [[" + bookTitle + "]]\n";
}

// src/main.ts
var EntityExtractorPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "extract-entities",
      name: "Extract entities from current book note",
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
  async createOrMergeNote(type, entity, bookTitle, dryRun) {
    const folder = type === "person" ? "People" : "Concepts";
    const filename = sanitizeFilename(entity.name);
    const path = folder + "/" + filename + ".md";
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing && existing instanceof import_obsidian.TFile) {
      const content = await this.app.vault.read(existing);
      if (content.includes("[[" + bookTitle + "]]")) {
        return { action: "skip", path };
      }
      if (!dryRun) {
        let updated = content;
        const newSection = formatReadingSection(
          bookTitle,
          entity.highlights
        );
        const mentionedLine = "- [[" + bookTitle + "]]";
        if (updated.includes("## Connected To")) {
          updated = updated.replace(
            "## Connected To",
            newSection + "\n## Connected To"
          );
        } else if (updated.includes("## From My Reading")) {
          updated += "\n" + newSection;
        }
        if (!updated.includes(mentionedLine)) {
          if (updated.includes("## Mentioned In")) {
            updated = updated.replace(
              "## Mentioned In",
              "## Mentioned In\n" + mentionedLine
            );
          } else {
            updated += "\n\n## Mentioned In\n" + mentionedLine + "\n";
          }
        }
        await this.app.vault.modify(existing, updated);
      }
      return { action: "merge", path };
    }
    if (!dryRun) {
      const note = buildEntityNote(type, entity, bookTitle);
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
      const parsed = parseBookNote(content);
      const { title, refs } = parsed;
      const hasRefs = refs.size > 0;
      if (!hasRefs && !parsed.hasReadwiseHighlights) {
        new import_obsidian.Notice(
          "No highlights found in this note (no ^ref- markers or Readwise highlights).",
          5e3
        );
        return;
      }
      const promptTemplate = hasRefs ? EXTRACTION_PROMPT_WITH_REFS : EXTRACTION_PROMPT_NO_REFS;
      const mode = dryRun ? " (DRY RUN)" : "";
      new import_obsidian.Notice(
        'Extracting entities from "' + title + '"...' + mode,
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
};
var ResultsModal = class extends import_obsidian.Modal {
  constructor(app, bookTitle, results, dryRun) {
    super(app);
    this.bookTitle = bookTitle;
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
    const heading = this.dryRun ? "Dry Run: " + this.bookTitle : "Extraction Complete";
    contentEl.createEl("h2", { text: heading });
    const parts = [];
    if (created > 0) parts.push(created + " created");
    if (merged > 0) parts.push(merged + " merged");
    if (skipped > 0) parts.push(skipped + " skipped");
    contentEl.createEl("p", {
      text: this.dryRun ? "Would process " + this.results.length + " entities from " + this.bookTitle : parts.join(", ") + " \u2014 from " + this.bookTitle
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
    const legend = this.dryRun ? 'Run without "dry run" to create these notes.' : "+ created, ~ merged with existing, = already had this book";
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
        text: "Open a book note with highlights (Kindle ^ref- markers or Readwise format)"
      });
      ol.createEl("li", { text: "Open Command Palette (Cmd/Ctrl + P)" });
      ol.createEl("li", {
        text: 'Run "Entity Extractor: Extract entities from current book note"'
      });
      ol.createEl("li", {
        text: "Entity notes appear in People/ and Concepts/ folders"
      });
    });
    const tip = containerEl.createEl("p", {
      cls: "setting-item-description"
    });
    tip.setText(
      'Use "Extract entities (dry run)" to preview what would be created without writing any files.'
    );
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2NyeXB0by50cyIsICJzcmMvY29uc3RhbnRzLnRzIiwgInNyYy9oZWxwZXJzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBQbHVnaW4sIE1vZGFsLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nLCBURmlsZSwgTm90aWNlLCBBcHAgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBnZW5lcmF0ZUVuY0tleSwgZW5jcnlwdFN0ciwgZGVjcnlwdFN0ciB9IGZyb20gJy4vY3J5cHRvJztcbmltcG9ydCB7XG4gICAgU1lTVEVNX1BST01QVCxcbiAgICBFWFRSQUNUSU9OX1BST01QVF9XSVRIX1JFRlMsXG4gICAgRVhUUkFDVElPTl9QUk9NUFRfTk9fUkVGUyxcbiAgICBERUZBVUxUX1NFVFRJTkdTLFxufSBmcm9tICcuL2NvbnN0YW50cyc7XG5pbXBvcnQgdHlwZSB7IEVudGl0eUV4dHJhY3RvclNldHRpbmdzIH0gZnJvbSAnLi9jb25zdGFudHMnO1xuaW1wb3J0IHtcbiAgICBzYW5pdGl6ZUZpbGVuYW1lLFxuICAgIHBhcnNlQm9va05vdGUsXG4gICAgZm9ybWF0UmVhZGluZ1NlY3Rpb24sXG4gICAgYnVpbGRFbnRpdHlOb3RlLFxufSBmcm9tICcuL2hlbHBlcnMnO1xuaW1wb3J0IHR5cGUgeyBFbnRpdHkgfSBmcm9tICcuL2hlbHBlcnMnO1xuXG5pbnRlcmZhY2UgRXh0cmFjdGlvblJlc3VsdCB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHR5cGU6IHN0cmluZztcbiAgICBhY3Rpb246IHN0cmluZztcbiAgICBwYXRoOiBzdHJpbmc7XG4gICAgY291bnQ/OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBBcGlSZXNwb25zZSB7XG4gICAgY29udGVudDogeyB0ZXh0OiBzdHJpbmcgfVtdO1xuICAgIGVycm9yPzogeyBtZXNzYWdlOiBzdHJpbmcgfTtcbn1cblxuaW50ZXJmYWNlIEV4dHJhY3Rpb25EYXRhIHtcbiAgICBwZW9wbGU6IEVudGl0eVtdO1xuICAgIGNvbmNlcHRzOiBFbnRpdHlbXTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRW50aXR5RXh0cmFjdG9yUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgICBzZXR0aW5ncyE6IEVudGl0eUV4dHJhY3RvclNldHRpbmdzO1xuXG4gICAgYXN5bmMgb25sb2FkKCkge1xuICAgICAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG4gICAgICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICAgICAgICBpZDogJ2V4dHJhY3QtZW50aXRpZXMnLFxuICAgICAgICAgICAgbmFtZTogJ0V4dHJhY3QgZW50aXRpZXMgZnJvbSBjdXJyZW50IGJvb2sgbm90ZScsXG4gICAgICAgICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgICAgICAgICAgICBpZiAoZmlsZSAmJiBmaWxlLmV4dGVuc2lvbiA9PT0gJ21kJykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNoZWNraW5nKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5ydW5FeHRyYWN0aW9uKGZpbGUsIGZhbHNlKS5jYXRjaCgoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0VudGl0eSBFeHRyYWN0b3I6JywgZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0VudGl0eSBleHRyYWN0aW9uIGVycm9yOiAnICsgKGUubWVzc2FnZSB8fCBlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTAwMDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgICAgICAgIGlkOiAnZXh0cmFjdC1lbnRpdGllcy1kcnktcnVuJyxcbiAgICAgICAgICAgIG5hbWU6ICdFeHRyYWN0IGVudGl0aWVzIChkcnkgcnVuIFx1MjAxNCBwcmV2aWV3IG9ubHkpJyxcbiAgICAgICAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgICAgICAgICAgICAgIGlmIChmaWxlICYmIGZpbGUuZXh0ZW5zaW9uID09PSAnbWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY2hlY2tpbmcpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJ1bkV4dHJhY3Rpb24oZmlsZSwgdHJ1ZSkuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFbnRpdHkgRXh0cmFjdG9yOicsIGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdFbnRpdHkgZXh0cmFjdGlvbiBlcnJvcjogJyArIChlLm1lc3NhZ2UgfHwgZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEwMDAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgRW50aXR5RXh0cmFjdG9yU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuICAgIH1cblxuICAgIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICAgICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oXG4gICAgICAgICAgICB7fSxcbiAgICAgICAgICAgIERFRkFVTFRfU0VUVElOR1MsXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmxvYWREYXRhKCksXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgICAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICAgIH1cblxuICAgIGFzeW5jIGdldEFwaUtleSgpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICAgICAgY29uc3QgcyA9IHRoaXMuc2V0dGluZ3M7XG4gICAgICAgIGlmICghcy5lbmNyeXB0ZWRBcGlLZXkgfHwgIXMuZW5jcnlwdGlvbktleSB8fCAhcy5pdikgcmV0dXJuIG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZGVjcnlwdFN0cihzLmVuY3J5cHRlZEFwaUtleSwgcy5pdiwgcy5lbmNyeXB0aW9uS2V5KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHNldEFwaUtleShwbGFpbjogc3RyaW5nKSB7XG4gICAgICAgIGlmICghdGhpcy5zZXR0aW5ncy5lbmNyeXB0aW9uS2V5KSB7XG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLmVuY3J5cHRpb25LZXkgPSBhd2FpdCBnZW5lcmF0ZUVuY0tleSgpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGVuY3J5cHRTdHIocGxhaW4sIHRoaXMuc2V0dGluZ3MuZW5jcnlwdGlvbktleSk7XG4gICAgICAgIHRoaXMuc2V0dGluZ3MuZW5jcnlwdGVkQXBpS2V5ID0gcmVzdWx0LmN0O1xuICAgICAgICB0aGlzLnNldHRpbmdzLml2ID0gcmVzdWx0Lml2O1xuICAgICAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgIH1cblxuICAgIGFzeW5jIGNsZWFyQXBpS2V5KCkge1xuICAgICAgICB0aGlzLnNldHRpbmdzLmVuY3J5cHRlZEFwaUtleSA9ICcnO1xuICAgICAgICB0aGlzLnNldHRpbmdzLml2ID0gJyc7XG4gICAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgfVxuXG4gICAgYXN5bmMgX2FwaUZldGNoKGFwaUtleTogc3RyaW5nLCBib2R5OiBvYmplY3QpOiBQcm9taXNlPEFwaVJlc3BvbnNlPiB7XG4gICAgICAgIGNvbnN0IGh0dHBzID0gcmVxdWlyZSgnaHR0cHMnKTtcbiAgICAgICAgY29uc3QgcG9zdERhdGEgPSBKU09OLnN0cmluZ2lmeShib2R5KTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgaG9zdG5hbWU6ICdhcGkuYW50aHJvcGljLmNvbScsXG4gICAgICAgICAgICAgICAgcGF0aDogJy92MS9tZXNzYWdlcycsXG4gICAgICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgICAgICAneC1hcGkta2V5JzogYXBpS2V5LFxuICAgICAgICAgICAgICAgICAgICAnYW50aHJvcGljLXZlcnNpb24nOiAnMjAyMy0wNi0wMScsXG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LUxlbmd0aCc6IEJ1ZmZlci5ieXRlTGVuZ3RoKHBvc3REYXRhKSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNvbnN0IHJlcSA9IGh0dHBzLnJlcXVlc3QoXG4gICAgICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgICAgICAocmVzOiB7IHN0YXR1c0NvZGU6IG51bWJlcjsgb246IEZ1bmN0aW9uIH0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2h1bmtzOiBCdWZmZXJbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICByZXMub24oJ2RhdGEnLCAoY2h1bms6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2h1bmtzLnB1c2goY2h1bmspO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmVzLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByYXcgPSBCdWZmZXIuY29uY2F0KGNodW5rcykudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UocmF3KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID49IDIwMCAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA8IDMwMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1zZyA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZGF0YS5lcnJvciAmJiBkYXRhLmVycm9yLm1lc3NhZ2UpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnSFRUUCAnICsgcmVzLnN0YXR1c0NvZGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IobXNnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCByZXNwb25zZTogJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmF3LnN1YnN0cmluZygwLCAyMDApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmVxLm9uKCdlcnJvcicsIChlOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ05ldHdvcmsgZXJyb3I6ICcgKyBlLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmVxLnNldFRpbWVvdXQoMTIwMDAwLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVxLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdSZXF1ZXN0IHRpbWVkIG91dCcpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmVxLndyaXRlKHBvc3REYXRhKTtcbiAgICAgICAgICAgIHJlcS5lbmQoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgYXN5bmMgY2FsbENsYXVkZShcbiAgICAgICAgYXBpS2V5OiBzdHJpbmcsXG4gICAgICAgIGNvbnRlbnQ6IHN0cmluZyxcbiAgICAgICAgcHJvbXB0VGVtcGxhdGU6IHN0cmluZyxcbiAgICApOiBQcm9taXNlPEV4dHJhY3Rpb25EYXRhPiB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLl9hcGlGZXRjaChhcGlLZXksIHtcbiAgICAgICAgICAgIG1vZGVsOiB0aGlzLnNldHRpbmdzLm1vZGVsLFxuICAgICAgICAgICAgbWF4X3Rva2VuczogODE5MixcbiAgICAgICAgICAgIHN5c3RlbTogU1lTVEVNX1BST01QVCxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbeyByb2xlOiAndXNlcicsIGNvbnRlbnQ6IHByb21wdFRlbXBsYXRlICsgY29udGVudCB9XSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV0IHRleHQ6IHN0cmluZztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRleHQgPSBkYXRhLmNvbnRlbnRbMF0udGV4dC50cmltKCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgICAnRW50aXR5IEV4dHJhY3RvcjogdW5leHBlY3RlZCByZXNwb25zZSBzaGFwZTonLFxuICAgICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIEFQSSByZXNwb25zZSBmb3JtYXQnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGV4dC5zdGFydHNXaXRoKCdgYGAnKSkge1xuICAgICAgICAgICAgdGV4dCA9IHRleHRcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvXmBgYFxcdypcXG4/LywgJycpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcbj9gYGAkLywgJycpXG4gICAgICAgICAgICAgICAgLnRyaW0oKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UodGV4dCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgICAnRW50aXR5IEV4dHJhY3RvcjogZmFpbGVkIHRvIHBhcnNlIEpTT04gZnJvbSBDbGF1ZGU6JyxcbiAgICAgICAgICAgICAgICB0ZXh0LnN1YnN0cmluZygwLCA1MDApLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2xhdWRlIHJldHVybmVkIGludmFsaWQgSlNPTiBcdTIwMTQgdHJ5IGFnYWluJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyB0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPHsgb2s6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG4gICAgICAgIGNvbnN0IGFwaUtleSA9IGF3YWl0IHRoaXMuZ2V0QXBpS2V5KCk7XG4gICAgICAgIGlmICghYXBpS2V5KSB7XG4gICAgICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIG1lc3NhZ2U6ICdObyBBUEkga2V5IGNvbmZpZ3VyZWQnIH07XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuX2FwaUZldGNoKGFwaUtleSwge1xuICAgICAgICAgICAgICAgIG1vZGVsOiB0aGlzLnNldHRpbmdzLm1vZGVsLFxuICAgICAgICAgICAgICAgIG1heF90b2tlbnM6IDE2LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbeyByb2xlOiAndXNlcicsIGNvbnRlbnQ6ICdTYXkgXCJva1wiJyB9XSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBvazogdHJ1ZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQ29ubmVjdGVkISBNb2RlbDogJyArIHRoaXMuc2V0dGluZ3MubW9kZWwsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgbWVzc2FnZTogZS5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBlbnN1cmVGb2xkZXIocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIGlmICghdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpKSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGVGb2xkZXIocGF0aCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBjcmVhdGVPck1lcmdlTm90ZShcbiAgICAgICAgdHlwZTogc3RyaW5nLFxuICAgICAgICBlbnRpdHk6IEVudGl0eSxcbiAgICAgICAgYm9va1RpdGxlOiBzdHJpbmcsXG4gICAgICAgIGRyeVJ1bjogYm9vbGVhbixcbiAgICApOiBQcm9taXNlPHsgYWN0aW9uOiBzdHJpbmc7IHBhdGg6IHN0cmluZzsgY291bnQ/OiBudW1iZXIgfT4ge1xuICAgICAgICBjb25zdCBmb2xkZXIgPSB0eXBlID09PSAncGVyc29uJyA/ICdQZW9wbGUnIDogJ0NvbmNlcHRzJztcbiAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBzYW5pdGl6ZUZpbGVuYW1lKGVudGl0eS5uYW1lKTtcbiAgICAgICAgY29uc3QgcGF0aCA9IGZvbGRlciArICcvJyArIGZpbGVuYW1lICsgJy5tZCc7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xuXG4gICAgICAgIGlmIChleGlzdGluZyAmJiBleGlzdGluZyBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChleGlzdGluZyk7XG5cbiAgICAgICAgICAgIGlmIChjb250ZW50LmluY2x1ZGVzKCdbWycgKyBib29rVGl0bGUgKyAnXV0nKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ3NraXAnLCBwYXRoIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZHJ5UnVuKSB7XG4gICAgICAgICAgICAgICAgbGV0IHVwZGF0ZWQgPSBjb250ZW50O1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld1NlY3Rpb24gPSBmb3JtYXRSZWFkaW5nU2VjdGlvbihcbiAgICAgICAgICAgICAgICAgICAgYm9va1RpdGxlLFxuICAgICAgICAgICAgICAgICAgICBlbnRpdHkuaGlnaGxpZ2h0cyxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lbnRpb25lZExpbmUgPSAnLSBbWycgKyBib29rVGl0bGUgKyAnXV0nO1xuXG4gICAgICAgICAgICAgICAgaWYgKHVwZGF0ZWQuaW5jbHVkZXMoJyMjIENvbm5lY3RlZCBUbycpKSB7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQgPSB1cGRhdGVkLnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAnIyMgQ29ubmVjdGVkIFRvJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1NlY3Rpb24gKyAnXFxuIyMgQ29ubmVjdGVkIFRvJyxcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHVwZGF0ZWQuaW5jbHVkZXMoJyMjIEZyb20gTXkgUmVhZGluZycpKSB7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQgKz0gJ1xcbicgKyBuZXdTZWN0aW9uO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghdXBkYXRlZC5pbmNsdWRlcyhtZW50aW9uZWRMaW5lKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodXBkYXRlZC5pbmNsdWRlcygnIyMgTWVudGlvbmVkIEluJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQgPSB1cGRhdGVkLnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJyMjIE1lbnRpb25lZCBJbicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJyMjIE1lbnRpb25lZCBJblxcbicgKyBtZW50aW9uZWRMaW5lLFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQgKz1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnXFxuXFxuIyMgTWVudGlvbmVkIEluXFxuJyArIG1lbnRpb25lZExpbmUgKyAnXFxuJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShleGlzdGluZywgdXBkYXRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdtZXJnZScsIHBhdGggfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZHJ5UnVuKSB7XG4gICAgICAgICAgICBjb25zdCBub3RlID0gYnVpbGRFbnRpdHlOb3RlKHR5cGUsIGVudGl0eSwgYm9va1RpdGxlKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZShwYXRoLCBub3RlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYWN0aW9uOiAnY3JlYXRlJyxcbiAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICBjb3VudDogKGVudGl0eS5oaWdobGlnaHRzIHx8IFtdKS5sZW5ndGgsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgYXN5bmMgcnVuRXh0cmFjdGlvbihmaWxlOiBURmlsZSwgZHJ5UnVuOiBib29sZWFuKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhcGlLZXkgPSBhd2FpdCB0aGlzLmdldEFwaUtleSgpO1xuICAgICAgICAgICAgaWYgKCFhcGlLZXkpIHtcbiAgICAgICAgICAgICAgICBuZXcgTm90aWNlKFxuICAgICAgICAgICAgICAgICAgICAnTm8gQVBJIGtleSBjb25maWd1cmVkLiBHbyB0byBTZXR0aW5ncyBcdTIxOTIgRW50aXR5IEV4dHJhY3RvciB0byBhZGQgeW91ciBBbnRocm9waWMgQVBJIGtleS4nLFxuICAgICAgICAgICAgICAgICAgICA4MDAwLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlQm9va05vdGUoY29udGVudCk7XG4gICAgICAgICAgICBjb25zdCB7IHRpdGxlLCByZWZzIH0gPSBwYXJzZWQ7XG4gICAgICAgICAgICBjb25zdCBoYXNSZWZzID0gcmVmcy5zaXplID4gMDtcblxuICAgICAgICAgICAgaWYgKCFoYXNSZWZzICYmICFwYXJzZWQuaGFzUmVhZHdpc2VIaWdobGlnaHRzKSB7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgJ05vIGhpZ2hsaWdodHMgZm91bmQgaW4gdGhpcyBub3RlIChubyBecmVmLSBtYXJrZXJzIG9yIFJlYWR3aXNlIGhpZ2hsaWdodHMpLicsXG4gICAgICAgICAgICAgICAgICAgIDUwMDAsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHByb21wdFRlbXBsYXRlID0gaGFzUmVmc1xuICAgICAgICAgICAgICAgID8gRVhUUkFDVElPTl9QUk9NUFRfV0lUSF9SRUZTXG4gICAgICAgICAgICAgICAgOiBFWFRSQUNUSU9OX1BST01QVF9OT19SRUZTO1xuXG4gICAgICAgICAgICBjb25zdCBtb2RlID0gZHJ5UnVuID8gJyAoRFJZIFJVTiknIDogJyc7XG4gICAgICAgICAgICBuZXcgTm90aWNlKFxuICAgICAgICAgICAgICAgICdFeHRyYWN0aW5nIGVudGl0aWVzIGZyb20gXCInICsgdGl0bGUgKyAnXCIuLi4nICsgbW9kZSxcbiAgICAgICAgICAgICAgICA1MDAwLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgbGV0IGRhdGE6IEV4dHJhY3Rpb25EYXRhO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBkYXRhID0gYXdhaXQgdGhpcy5jYWxsQ2xhdWRlKGFwaUtleSwgY29udGVudCwgcHJvbXB0VGVtcGxhdGUpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgJ0FQSSBjYWxsIGZhaWxlZDogJyArIChlLm1lc3NhZ2UgfHwgZSksXG4gICAgICAgICAgICAgICAgICAgIDEwMDAwLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwZW9wbGUgPSBkYXRhLnBlb3BsZSB8fCBbXTtcbiAgICAgICAgICAgIGNvbnN0IGNvbmNlcHRzID0gZGF0YS5jb25jZXB0cyB8fCBbXTtcblxuICAgICAgICAgICAgaWYgKGhhc1JlZnMpIHtcbiAgICAgICAgICAgICAgICBbcGVvcGxlLCBjb25jZXB0c10uZm9yRWFjaCgobGlzdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsaXN0LmZvckVhY2goKGVudGl0eSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZW50aXR5LmhpZ2hsaWdodHMgPSAoZW50aXR5LmhpZ2hsaWdodHMgfHwgW10pLmZpbHRlcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoaCkgPT4gaC5yZWYgIT0gbnVsbCAmJiByZWZzLmhhcyhoLnJlZiksXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAnRm91bmQgJyArXG4gICAgICAgICAgICAgICAgICAgIHBlb3BsZS5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAnIHBlb3BsZSwgJyArXG4gICAgICAgICAgICAgICAgICAgIGNvbmNlcHRzLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgICcgY29uY2VwdHMuJyArXG4gICAgICAgICAgICAgICAgICAgIG1vZGUsXG4gICAgICAgICAgICAgICAgNTAwMCxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IEV4dHJhY3Rpb25SZXN1bHRbXSA9IFtdO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAoIWRyeVJ1bikge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZUZvbGRlcignUGVvcGxlJyk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuZW5zdXJlRm9sZGVyKCdDb25jZXB0cycpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcGVyc29uIG9mIHBlb3BsZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByID0gYXdhaXQgdGhpcy5jcmVhdGVPck1lcmdlTm90ZShcbiAgICAgICAgICAgICAgICAgICAgICAgICdwZXJzb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGVyc29uLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBkcnlSdW4sXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBwZXJzb24ubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwZXJzb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgLi4ucixcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY29uY2VwdCBvZiBjb25jZXB0cykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByID0gYXdhaXQgdGhpcy5jcmVhdGVPck1lcmdlTm90ZShcbiAgICAgICAgICAgICAgICAgICAgICAgICdjb25jZXB0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmNlcHQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRyeVJ1bixcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGNvbmNlcHQubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdjb25jZXB0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnIsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghY29udGVudC5pbmNsdWRlcygnIyMgRW50aXRpZXMnKSAmJiAhZHJ5UnVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBMaW5rcyA9IHBlb3BsZVxuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgocCkgPT4gJ1tbJyArIHAubmFtZSArICddXScpXG4gICAgICAgICAgICAgICAgICAgICAgICAuam9pbignLCAnKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY0xpbmtzID0gY29uY2VwdHNcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKGMpID0+ICdbWycgKyBjLm5hbWUgKyAnXV0nKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmpvaW4oJywgJyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1bW1hcnkgPVxuICAgICAgICAgICAgICAgICAgICAgICAgJ1xcbiMjIEVudGl0aWVzXFxuXFxuKipQZW9wbGU6KiogJyArXG4gICAgICAgICAgICAgICAgICAgICAgICBwTGlua3MgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1xcblxcbioqQ29uY2VwdHM6KiogJyArXG4gICAgICAgICAgICAgICAgICAgICAgICBjTGlua3MgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1xcbic7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCBjb250ZW50ICsgc3VtbWFyeSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRW50aXR5IEV4dHJhY3RvcjogZXJyb3IgY3JlYXRpbmcgbm90ZXM6JywgZSk7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgJ0Vycm9yIGNyZWF0aW5nIG5vdGVzOiAnICsgKGUubWVzc2FnZSB8fCBlKSxcbiAgICAgICAgICAgICAgICAgICAgMTAwMDAsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbW9kYWwgPSBuZXcgUmVzdWx0c01vZGFsKHRoaXMuYXBwLCB0aXRsZSwgcmVzdWx0cywgZHJ5UnVuKTtcbiAgICAgICAgICAgIG1vZGFsLm9wZW4oKTtcbiAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFbnRpdHkgRXh0cmFjdG9yOiB1bmV4cGVjdGVkIGVycm9yOicsIGUpO1xuICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAnRW50aXR5IGV4dHJhY3Rpb24gZXJyb3I6ICcgKyAoZS5tZXNzYWdlIHx8IGUpLFxuICAgICAgICAgICAgICAgIDEwMDAwLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBSZXN1bHRzIE1vZGFsXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuY2xhc3MgUmVzdWx0c01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICAgIHByaXZhdGUgYm9va1RpdGxlOiBzdHJpbmc7XG4gICAgcHJpdmF0ZSByZXN1bHRzOiBFeHRyYWN0aW9uUmVzdWx0W107XG4gICAgcHJpdmF0ZSBkcnlSdW46IGJvb2xlYW47XG5cbiAgICBjb25zdHJ1Y3RvcihcbiAgICAgICAgYXBwOiBBcHAsXG4gICAgICAgIGJvb2tUaXRsZTogc3RyaW5nLFxuICAgICAgICByZXN1bHRzOiBFeHRyYWN0aW9uUmVzdWx0W10sXG4gICAgICAgIGRyeVJ1bjogYm9vbGVhbixcbiAgICApIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcbiAgICAgICAgdGhpcy5ib29rVGl0bGUgPSBib29rVGl0bGU7XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHM7XG4gICAgICAgIHRoaXMuZHJ5UnVuID0gZHJ5UnVuO1xuICAgIH1cblxuICAgIG9uT3BlbigpIHtcbiAgICAgICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgICAgIGNvbnN0IGNyZWF0ZWQgPSB0aGlzLnJlc3VsdHMuZmlsdGVyKFxuICAgICAgICAgICAgKHIpID0+IHIuYWN0aW9uID09PSAnY3JlYXRlJyxcbiAgICAgICAgKS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IG1lcmdlZCA9IHRoaXMucmVzdWx0cy5maWx0ZXIoXG4gICAgICAgICAgICAocikgPT4gci5hY3Rpb24gPT09ICdtZXJnZScsXG4gICAgICAgICkubGVuZ3RoO1xuICAgICAgICBjb25zdCBza2lwcGVkID0gdGhpcy5yZXN1bHRzLmZpbHRlcihcbiAgICAgICAgICAgIChyKSA9PiByLmFjdGlvbiA9PT0gJ3NraXAnLFxuICAgICAgICApLmxlbmd0aDtcblxuICAgICAgICBjb25zdCBoZWFkaW5nID0gdGhpcy5kcnlSdW5cbiAgICAgICAgICAgID8gJ0RyeSBSdW46ICcgKyB0aGlzLmJvb2tUaXRsZVxuICAgICAgICAgICAgOiAnRXh0cmFjdGlvbiBDb21wbGV0ZSc7XG4gICAgICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6IGhlYWRpbmcgfSk7XG5cbiAgICAgICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGlmIChjcmVhdGVkID4gMCkgcGFydHMucHVzaChjcmVhdGVkICsgJyBjcmVhdGVkJyk7XG4gICAgICAgIGlmIChtZXJnZWQgPiAwKSBwYXJ0cy5wdXNoKG1lcmdlZCArICcgbWVyZ2VkJyk7XG4gICAgICAgIGlmIChza2lwcGVkID4gMCkgcGFydHMucHVzaChza2lwcGVkICsgJyBza2lwcGVkJyk7XG4gICAgICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHtcbiAgICAgICAgICAgIHRleHQ6IHRoaXMuZHJ5UnVuXG4gICAgICAgICAgICAgICAgPyAnV291bGQgcHJvY2VzcyAnICtcbiAgICAgICAgICAgICAgICAgIHRoaXMucmVzdWx0cy5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgJyBlbnRpdGllcyBmcm9tICcgK1xuICAgICAgICAgICAgICAgICAgdGhpcy5ib29rVGl0bGVcbiAgICAgICAgICAgICAgICA6IHBhcnRzLmpvaW4oJywgJykgKyAnIFx1MjAxNCBmcm9tICcgKyB0aGlzLmJvb2tUaXRsZSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcGVvcGxlID0gdGhpcy5yZXN1bHRzLmZpbHRlcigocikgPT4gci50eXBlID09PSAncGVyc29uJyk7XG4gICAgICAgIGNvbnN0IGNvbmNlcHRzID0gdGhpcy5yZXN1bHRzLmZpbHRlcigocikgPT4gci50eXBlID09PSAnY29uY2VwdCcpO1xuXG4gICAgICAgIGlmIChwZW9wbGUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMycsIHtcbiAgICAgICAgICAgICAgICB0ZXh0OiAnUGVvcGxlICgnICsgcGVvcGxlLmxlbmd0aCArICcpJyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgcExpc3QgPSBjb250ZW50RWwuY3JlYXRlRWwoJ3VsJyk7XG4gICAgICAgICAgICBwZW9wbGUuZm9yRWFjaCgocikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpID0gcExpc3QuY3JlYXRlRWwoJ2xpJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFkZ2UgPVxuICAgICAgICAgICAgICAgICAgICByLmFjdGlvbiA9PT0gJ2NyZWF0ZSdcbiAgICAgICAgICAgICAgICAgICAgICAgID8gJysgJ1xuICAgICAgICAgICAgICAgICAgICAgICAgOiByLmFjdGlvbiA9PT0gJ21lcmdlJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICA/ICd+ICdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgOiAnPSAnO1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5kcnlSdW4gJiYgci5hY3Rpb24gIT09ICdza2lwJykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaW5rID0gbGkuY3JlYXRlRWwoJ2EnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiBiYWRnZSArIHIubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsczogJ2ludGVybmFsLWxpbmsnLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgbGluay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KHIucGF0aCwgJycsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbGkuc2V0VGV4dChiYWRnZSArIHIubmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29uY2VwdHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMycsIHtcbiAgICAgICAgICAgICAgICB0ZXh0OiAnQ29uY2VwdHMgKCcgKyBjb25jZXB0cy5sZW5ndGggKyAnKScsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGNMaXN0ID0gY29udGVudEVsLmNyZWF0ZUVsKCd1bCcpO1xuICAgICAgICAgICAgY29uY2VwdHMuZm9yRWFjaCgocikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpID0gY0xpc3QuY3JlYXRlRWwoJ2xpJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFkZ2UgPVxuICAgICAgICAgICAgICAgICAgICByLmFjdGlvbiA9PT0gJ2NyZWF0ZSdcbiAgICAgICAgICAgICAgICAgICAgICAgID8gJysgJ1xuICAgICAgICAgICAgICAgICAgICAgICAgOiByLmFjdGlvbiA9PT0gJ21lcmdlJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICA/ICd+ICdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgOiAnPSAnO1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5kcnlSdW4gJiYgci5hY3Rpb24gIT09ICdza2lwJykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaW5rID0gbGkuY3JlYXRlRWwoJ2EnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiBiYWRnZSArIHIubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsczogJ2ludGVybmFsLWxpbmsnLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgbGluay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KHIucGF0aCwgJycsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbGkuc2V0VGV4dChiYWRnZSArIHIubmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsZWdlbmQgPSB0aGlzLmRyeVJ1blxuICAgICAgICAgICAgPyAnUnVuIHdpdGhvdXQgXCJkcnkgcnVuXCIgdG8gY3JlYXRlIHRoZXNlIG5vdGVzLidcbiAgICAgICAgICAgIDogJysgY3JlYXRlZCwgfiBtZXJnZWQgd2l0aCBleGlzdGluZywgPSBhbHJlYWR5IGhhZCB0aGlzIGJvb2snO1xuICAgICAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7XG4gICAgICAgICAgICB0ZXh0OiBsZWdlbmQsXG4gICAgICAgICAgICBjbHM6ICdzZXR0aW5nLWl0ZW0tZGVzY3JpcHRpb24nLFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBvbkNsb3NlKCkge1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIH1cbn1cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTZXR0aW5ncyBUYWJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5jbGFzcyBFbnRpdHlFeHRyYWN0b3JTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gICAgcGx1Z2luOiBFbnRpdHlFeHRyYWN0b3JQbHVnaW47XG5cbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBFbnRpdHlFeHRyYWN0b3JQbHVnaW4pIHtcbiAgICAgICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB9XG5cbiAgICBkaXNwbGF5KCkge1xuICAgICAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgICAgICBjb25zdCB7IHBsdWdpbiB9ID0gdGhpcztcbiAgICAgICAgY29udGFpbmVyRWwuZW1wdHkoKTtcblxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdFbnRpdHkgRXh0cmFjdG9yJyB9KTtcblxuICAgICAgICBjb25zdCBoYXNLZXkgPSAhIXBsdWdpbi5zZXR0aW5ncy5lbmNyeXB0ZWRBcGlLZXk7XG5cbiAgICAgICAgLy8gQVBJIEtleVxuICAgICAgICBsZXQgYXBpS2V5SW5wdXQ6IGFueTtcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZSgnQW50aHJvcGljIEFQSSBrZXknKVxuICAgICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICAgICAgaGFzS2V5XG4gICAgICAgICAgICAgICAgICAgID8gJ0FQSSBrZXkgaXMgc2F2ZWQgYW5kIGVuY3J5cHRlZCBhdCByZXN0LiBFbnRlciBhIG5ldyB2YWx1ZSB0byByZXBsYWNlIGl0LidcbiAgICAgICAgICAgICAgICAgICAgOiAnRW50ZXIgeW91ciBBUEkga2V5IGZyb20gY29uc29sZS5hbnRocm9waWMuY29tLiBJdCB3aWxsIGJlIGVuY3J5cHRlZCBhdCByZXN0LicsXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAuYWRkVGV4dCgodGV4dCkgPT4ge1xuICAgICAgICAgICAgICAgIGFwaUtleUlucHV0ID0gdGV4dDtcbiAgICAgICAgICAgICAgICB0ZXh0LmlucHV0RWwudHlwZSA9ICdwYXNzd29yZCc7XG4gICAgICAgICAgICAgICAgdGV4dC5pbnB1dEVsLnN0eWxlLndpZHRoID0gJzMwMHB4JztcbiAgICAgICAgICAgICAgICB0ZXh0LnNldFBsYWNlaG9sZGVyKFxuICAgICAgICAgICAgICAgICAgICBoYXNLZXlcbiAgICAgICAgICAgICAgICAgICAgICAgID8gJ1xcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjInXG4gICAgICAgICAgICAgICAgICAgICAgICA6ICdzay1hbnQtLi4uJyxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5hZGRCdXR0b24oKGJ0bikgPT4ge1xuICAgICAgICAgICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdTYXZlIGtleScpXG4gICAgICAgICAgICAgICAgICAgIC5zZXRDdGEoKVxuICAgICAgICAgICAgICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGFwaUtleUlucHV0LmdldFZhbHVlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWUgJiYgdmFsdWUubGVuZ3RoID4gMTApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBwbHVnaW4uc2V0QXBpS2V5KHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcGlLZXlJbnB1dC5zZXRWYWx1ZSgnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBpS2V5SW5wdXQuc2V0UGxhY2Vob2xkZXIoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyXFx1MjAyMlxcdTIwMjJcXHUyMDIyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoJ0FQSSBrZXkgc2F2ZWQgKGVuY3J5cHRlZCknLCAzMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1BsZWFzZSBlbnRlciBhIHZhbGlkIEFQSSBrZXknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAzMDAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKGhhc0tleSkge1xuICAgICAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAgICAgLnNldE5hbWUoJ0NsZWFyIEFQSSBrZXknKVxuICAgICAgICAgICAgICAgIC5zZXREZXNjKCdSZW1vdmUgdGhlIHN0b3JlZCBBUEkga2V5JylcbiAgICAgICAgICAgICAgICAuYWRkQnV0dG9uKChidG4pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ0NsZWFyJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5zZXRXYXJuaW5nKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBwbHVnaW4uY2xlYXJBcGlLZXkoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgTm90aWNlKCdBUEkga2V5IGNsZWFyZWQnLCAzMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXkoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhc0tleSkge1xuICAgICAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAgICAgLnNldE5hbWUoJ1Rlc3QgY29ubmVjdGlvbicpXG4gICAgICAgICAgICAgICAgLnNldERlc2MoJ1ZlcmlmeSB5b3VyIEFQSSBrZXkgYW5kIG1vZGVsIHdvcmsnKVxuICAgICAgICAgICAgICAgIC5hZGRCdXR0b24oKGJ0bikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnVGVzdCcpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1Rlc3RpbmcuLi4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ0bi5zZXREaXNhYmxlZCh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBsdWdpbi50ZXN0Q29ubmVjdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnRuLnNldERpc2FibGVkKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQub2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBidG4uc2V0QnV0dG9uVGV4dCgnT0shJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShyZXN1bHQubWVzc2FnZSwgNTAwMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KCdGYWlsZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgTm90aWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnQ29ubmVjdGlvbiBmYWlsZWQ6ICcgKyByZXN1bHQubWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgODAwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoJ1Rlc3QnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIDMwMDApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoJ01vZGVsJylcbiAgICAgICAgICAgIC5zZXREZXNjKCdDbGF1ZGUgbW9kZWwgdG8gdXNlIGZvciBleHRyYWN0aW9uJylcbiAgICAgICAgICAgIC5hZGREcm9wZG93bigoZGQpID0+IHtcbiAgICAgICAgICAgICAgICBkZC5hZGRPcHRpb24oXG4gICAgICAgICAgICAgICAgICAgICdjbGF1ZGUtc29ubmV0LTQtNicsXG4gICAgICAgICAgICAgICAgICAgICdDbGF1ZGUgU29ubmV0IDQgKHJlY29tbWVuZGVkKScsXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAuYWRkT3B0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2NsYXVkZS1oYWlrdS00LTUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0NsYXVkZSBIYWlrdSA0LjUgKGZhc3Rlci9jaGVhcGVyKScsXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgLmFkZE9wdGlvbihcbiAgICAgICAgICAgICAgICAgICAgICAgICdjbGF1ZGUtb3B1cy00LTYnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0NsYXVkZSBPcHVzIDQuNiAobW9zdCBjYXBhYmxlKScsXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKHBsdWdpbi5zZXR0aW5ncy5tb2RlbClcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGx1Z2luLnNldHRpbmdzLm1vZGVsID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBwbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAnVXNhZ2UnIH0pO1xuICAgICAgICBjb25zdCB1c2FnZSA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdkaXYnKTtcbiAgICAgICAgdXNhZ2UuY3JlYXRlRWwoJ29sJywge30sIChvbCkgPT4ge1xuICAgICAgICAgICAgb2wuY3JlYXRlRWwoJ2xpJywge1xuICAgICAgICAgICAgICAgIHRleHQ6ICdPcGVuIGEgYm9vayBub3RlIHdpdGggaGlnaGxpZ2h0cyAoS2luZGxlIF5yZWYtIG1hcmtlcnMgb3IgUmVhZHdpc2UgZm9ybWF0KScsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIG9sLmNyZWF0ZUVsKCdsaScsIHsgdGV4dDogJ09wZW4gQ29tbWFuZCBQYWxldHRlIChDbWQvQ3RybCArIFApJyB9KTtcbiAgICAgICAgICAgIG9sLmNyZWF0ZUVsKCdsaScsIHtcbiAgICAgICAgICAgICAgICB0ZXh0OiAnUnVuIFwiRW50aXR5IEV4dHJhY3RvcjogRXh0cmFjdCBlbnRpdGllcyBmcm9tIGN1cnJlbnQgYm9vayBub3RlXCInLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBvbC5jcmVhdGVFbCgnbGknLCB7XG4gICAgICAgICAgICAgICAgdGV4dDogJ0VudGl0eSBub3RlcyBhcHBlYXIgaW4gUGVvcGxlLyBhbmQgQ29uY2VwdHMvIGZvbGRlcnMnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCB0aXAgPSBjb250YWluZXJFbC5jcmVhdGVFbCgncCcsIHtcbiAgICAgICAgICAgIGNsczogJ3NldHRpbmctaXRlbS1kZXNjcmlwdGlvbicsXG4gICAgICAgIH0pO1xuICAgICAgICB0aXAuc2V0VGV4dChcbiAgICAgICAgICAgICdVc2UgXCJFeHRyYWN0IGVudGl0aWVzIChkcnkgcnVuKVwiIHRvIHByZXZpZXcgd2hhdCB3b3VsZCBiZSBjcmVhdGVkIHdpdGhvdXQgd3JpdGluZyBhbnkgZmlsZXMuJyxcbiAgICAgICAgKTtcbiAgICB9XG59XG4iLCAiZXhwb3J0IGZ1bmN0aW9uIGhleFRvQnl0ZXMoaGV4OiBzdHJpbmcpOiBVaW50OEFycmF5IHtcbiAgICBjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KGhleC5sZW5ndGggLyAyKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGhleC5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICBieXRlc1tpIC8gMl0gPSBwYXJzZUludChoZXguc3Vic3RyKGksIDIpLCAxNik7XG4gICAgfVxuICAgIHJldHVybiBieXRlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ5dGVzVG9IZXgoYnl0ZXM6IFVpbnQ4QXJyYXkpOiBzdHJpbmcge1xuICAgIHJldHVybiBBcnJheS5mcm9tKGJ5dGVzKVxuICAgICAgICAubWFwKChiKSA9PiBiLnRvU3RyaW5nKDE2KS5wYWRTdGFydCgyLCAnMCcpKVxuICAgICAgICAuam9pbignJyk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZUVuY0tleSgpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IGtleSA9IGF3YWl0IGNyeXB0by5zdWJ0bGUuZ2VuZXJhdGVLZXkoXG4gICAgICAgIHsgbmFtZTogJ0FFUy1HQ00nLCBsZW5ndGg6IDI1NiB9LFxuICAgICAgICB0cnVlLFxuICAgICAgICBbJ2VuY3J5cHQnLCAnZGVjcnlwdCddLFxuICAgICk7XG4gICAgY29uc3QgcmF3ID0gYXdhaXQgY3J5cHRvLnN1YnRsZS5leHBvcnRLZXkoJ3JhdycsIGtleSk7XG4gICAgcmV0dXJuIGJ5dGVzVG9IZXgobmV3IFVpbnQ4QXJyYXkocmF3KSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbXBvcnRFbmNLZXkoaGV4OiBzdHJpbmcpOiBQcm9taXNlPENyeXB0b0tleT4ge1xuICAgIHJldHVybiBjcnlwdG8uc3VidGxlLmltcG9ydEtleShcbiAgICAgICAgJ3JhdycsXG4gICAgICAgIGhleFRvQnl0ZXMoaGV4KS5idWZmZXIgYXMgQXJyYXlCdWZmZXIsXG4gICAgICAgIHsgbmFtZTogJ0FFUy1HQ00nIH0sXG4gICAgICAgIGZhbHNlLFxuICAgICAgICBbJ2VuY3J5cHQnLCAnZGVjcnlwdCddLFxuICAgICk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmNyeXB0U3RyKFxuICAgIHRleHQ6IHN0cmluZyxcbiAgICBrZXlIZXg6IHN0cmluZyxcbik6IFByb21pc2U8eyBjdDogc3RyaW5nOyBpdjogc3RyaW5nIH0+IHtcbiAgICBjb25zdCBrZXkgPSBhd2FpdCBpbXBvcnRFbmNLZXkoa2V5SGV4KTtcbiAgICBjb25zdCBpdiA9IGNyeXB0by5nZXRSYW5kb21WYWx1ZXMobmV3IFVpbnQ4QXJyYXkoMTIpKTtcbiAgICBjb25zdCBjdCA9IGF3YWl0IGNyeXB0by5zdWJ0bGUuZW5jcnlwdChcbiAgICAgICAgeyBuYW1lOiAnQUVTLUdDTScsIGl2IH0sXG4gICAgICAgIGtleSxcbiAgICAgICAgbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKHRleHQpLFxuICAgICk7XG4gICAgcmV0dXJuIHsgY3Q6IGJ5dGVzVG9IZXgobmV3IFVpbnQ4QXJyYXkoY3QpKSwgaXY6IGJ5dGVzVG9IZXgoaXYpIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBkZWNyeXB0U3RyKFxuICAgIGN0SGV4OiBzdHJpbmcsXG4gICAgaXZIZXg6IHN0cmluZyxcbiAgICBrZXlIZXg6IHN0cmluZyxcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3Qga2V5ID0gYXdhaXQgaW1wb3J0RW5jS2V5KGtleUhleCk7XG4gICAgY29uc3QgcHQgPSBhd2FpdCBjcnlwdG8uc3VidGxlLmRlY3J5cHQoXG4gICAgICAgIHsgbmFtZTogJ0FFUy1HQ00nLCBpdjogaGV4VG9CeXRlcyhpdkhleCkuYnVmZmVyIGFzIEFycmF5QnVmZmVyIH0sXG4gICAgICAgIGtleSxcbiAgICAgICAgaGV4VG9CeXRlcyhjdEhleCkuYnVmZmVyIGFzIEFycmF5QnVmZmVyLFxuICAgICk7XG4gICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShwdCk7XG59XG4iLCAiZXhwb3J0IGludGVyZmFjZSBFbnRpdHlFeHRyYWN0b3JTZXR0aW5ncyB7XG4gICAgZW5jcnlwdGVkQXBpS2V5OiBzdHJpbmc7XG4gICAgZW5jcnlwdGlvbktleTogc3RyaW5nO1xuICAgIGl2OiBzdHJpbmc7XG4gICAgbW9kZWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IFNZU1RFTV9QUk9NUFQgPVxuICAgICdZb3UgYXJlIGFuIGV4cGVydCBhdCBhbmFseXppbmcgYm9vayBoaWdobGlnaHRzIGFuZCBleHRyYWN0aW5nIHN0cnVjdHVyZWQgZW50aXR5IGRhdGEuICcgK1xuICAgICdZb3UgcmV0dXJuIG9ubHkgdmFsaWQgSlNPTiwgbm8gbWFya2Rvd24gZmVuY2luZy4nO1xuXG5leHBvcnQgY29uc3QgRVhUUkFDVElPTl9QUk9NUFRfV0lUSF9SRUZTID1cbiAgICAnQW5hbHl6ZSB0aGlzIGJvb2sgbm90ZSAoS2luZGxlIGhpZ2hsaWdodHMpIGFuZCBleHRyYWN0IGFsbCBub3RhYmxlIGVudGl0aWVzLlxcbicgK1xuICAgICdcXG4nICtcbiAgICAnUmV0dXJuIGEgSlNPTiBvYmplY3Qgd2l0aCB0aGlzIGV4YWN0IHN0cnVjdHVyZTpcXG4nICtcbiAgICAne1xcbicgK1xuICAgICcgIFwicGVvcGxlXCI6IFtcXG4nICtcbiAgICAnICAgIHtcXG4nICtcbiAgICAnICAgICAgXCJuYW1lXCI6IFwiRnVsbCBOYW1lXCIsXFxuJyArXG4gICAgJyAgICAgIFwiYWxpYXNlc1wiOiBbXCJOaWNrbmFtZVwiXSxcXG4nICtcbiAgICAnICAgICAgXCJtYWpvclwiOiB0cnVlLFxcbicgK1xuICAgICcgICAgICBcImhpZ2hsaWdodHNcIjogW1xcbicgK1xuICAgICcgICAgICAgIHtcInJlZlwiOiBcInJlZi1YWFhYWFwiLCBcInN1bW1hcnlcIjogXCJCcmllZiA1LTEwIHdvcmQgZGVzY3JpcHRpb25cIn1cXG4nICtcbiAgICAnICAgICAgXSxcXG4nICtcbiAgICAnICAgICAgXCJjb25uZWN0aW9uc1wiOiBbXFxuJyArXG4gICAgJyAgICAgICAge1wiZW50aXR5XCI6IFwiT3RoZXIgRW50aXR5IE5hbWVcIiwgXCJyZWxhdGlvbnNoaXBcIjogXCJicmllZiBkZXNjcmlwdGlvblwifVxcbicgK1xuICAgICcgICAgICBdXFxuJyArXG4gICAgJyAgICB9XFxuJyArXG4gICAgJyAgXSxcXG4nICtcbiAgICAnICBcImNvbmNlcHRzXCI6IFtcXG4nICtcbiAgICAnICAgIHtcXG4nICtcbiAgICAnICAgICAgXCJuYW1lXCI6IFwiQ29uY2VwdCBOYW1lXCIsXFxuJyArXG4gICAgJyAgICAgIFwiYWxpYXNlc1wiOiBbXCJhbHRlcm5hdGUgbmFtZVwiXSxcXG4nICtcbiAgICAnICAgICAgXCJtYWpvclwiOiB0cnVlLFxcbicgK1xuICAgICcgICAgICBcImhpZ2hsaWdodHNcIjogW1xcbicgK1xuICAgICcgICAgICAgIHtcInJlZlwiOiBcInJlZi1YWFhYWFwiLCBcInN1bW1hcnlcIjogXCJCcmllZiBkZXNjcmlwdGlvblwifVxcbicgK1xuICAgICcgICAgICBdLFxcbicgK1xuICAgICcgICAgICBcImNvbm5lY3Rpb25zXCI6IFtcXG4nICtcbiAgICAnICAgICAgICB7XCJlbnRpdHlcIjogXCJQZXJzb24gb3IgQ29uY2VwdCBOYW1lXCIsIFwicmVsYXRpb25zaGlwXCI6IFwiYnJpZWYgZGVzY3JpcHRpb25cIn1cXG4nICtcbiAgICAnICAgICAgXVxcbicgK1xuICAgICcgICAgfVxcbicgK1xuICAgICcgIF1cXG4nICtcbiAgICAnfVxcbicgK1xuICAgICdcXG4nICtcbiAgICAnUnVsZXM6XFxuJyArXG4gICAgJy0gXCJtYWpvclwiIGlzIHRydWUgaWYgdGhlIGVudGl0eSBoYXMgc2lnbmlmaWNhbnQgY292ZXJhZ2UgKG11bHRpcGxlIGhpZ2hsaWdodHMgb3IgY2VudHJhbCB0byB0aGUgbmFycmF0aXZlKSwgZmFsc2UgZm9yIGJyaWVmL3Bhc3NpbmcgbWVudGlvbnNcXG4nICtcbiAgICAnLSBPbmx5IHVzZSByZWYgSURzIHRoYXQgYWN0dWFsbHkgYXBwZWFyIGluIHRoZSB0ZXh0ICh0aGV5IGxvb2sgbGlrZSBecmVmLVhYWFhYIGF0IHRoZSBlbmQgb2YgaGlnaGxpZ2h0cylcXG4nICtcbiAgICAnLSBBIGhpZ2hsaWdodCBjYW4gYmUgYXNzb2NpYXRlZCB3aXRoIG11bHRpcGxlIGVudGl0aWVzXFxuJyArXG4gICAgJy0gRm9yIGNvbm5lY3Rpb25zLCBvbmx5IGxpbmsgdG8gb3RoZXIgZW50aXRpZXMgeW91IGFyZSBleHRyYWN0aW5nIChub3QgZXh0ZXJuYWwgZmlndXJlcylcXG4nICtcbiAgICAnLSBQZW9wbGUgY29ubmVjdGlvbnMgc2hvdWxkIGluY2x1ZGUgcmVsYXRpb25zaGlwcyBsaWtlIFwiY28tZGV2ZWxvcGVyXCIsIFwic3R1ZGVudFwiLCBcImFkdmlzb3JcIiwgXCJjb2xsZWFndWVcIiwgXCJjcml0aWNcIlxcbicgK1xuICAgICctIENvbmNlcHQgY29ubmVjdGlvbnMgc2hvdWxkIGxpbmsgdG8gcmVsYXRlZCBwZW9wbGUgQU5EIHJlbGF0ZWQgY29uY2VwdHNcXG4nICtcbiAgICAnLSBJbmNsdWRlIEFMTCBwZW9wbGUgbWVudGlvbmVkIGJ5IG5hbWUsIGV2ZW4gYnJpZWZseSBcdTIwMTQgdGhleSBiZWNvbWUgc3R1YnNcXG4nICtcbiAgICAnLSBGb3IgY29uY2VwdHMsIGZvY3VzIG9uIHRlY2huaWNhbC9pbnRlbGxlY3R1YWwgY29uY2VwdHMsIG5vdCBnZW5lcmFsIHRlcm1zXFxuJyArXG4gICAgJy0gUmV0dXJuIE9OTFkgdGhlIEpTT04gb2JqZWN0LCBubyBtYXJrZG93biBmZW5jaW5nIG9yIGV4cGxhbmF0aW9uXFxuJyArXG4gICAgJ1xcbicgK1xuICAgICdCb29rIG5vdGUgY29udGVudDpcXG4nO1xuXG5leHBvcnQgY29uc3QgRVhUUkFDVElPTl9QUk9NUFRfTk9fUkVGUyA9XG4gICAgJ0FuYWx5emUgdGhpcyBib29rIG5vdGUgKGhpZ2hsaWdodHMgZnJvbSBSZWFkd2lzZSBvciBzaW1pbGFyKSBhbmQgZXh0cmFjdCBhbGwgbm90YWJsZSBlbnRpdGllcy5cXG4nICtcbiAgICAnVGhpcyBub3RlIGRvZXMgTk9UIGhhdmUgXnJlZi1YWFhYWCBibG9jayBJRHMuIEluc3RlYWQsIHByb3ZpZGUgYSBcInF1b3RlXCIgZmllbGQgd2l0aCBhIHNob3J0IGV4Y2VycHQgKGZpcnN0IH44MCBjaGFycykgZnJvbSB0aGUgcmVsZXZhbnQgaGlnaGxpZ2h0IHRleHQuXFxuJyArXG4gICAgJ1xcbicgK1xuICAgICdSZXR1cm4gYSBKU09OIG9iamVjdCB3aXRoIHRoaXMgZXhhY3Qgc3RydWN0dXJlOlxcbicgK1xuICAgICd7XFxuJyArXG4gICAgJyAgXCJwZW9wbGVcIjogW1xcbicgK1xuICAgICcgICAge1xcbicgK1xuICAgICcgICAgICBcIm5hbWVcIjogXCJGdWxsIE5hbWVcIixcXG4nICtcbiAgICAnICAgICAgXCJhbGlhc2VzXCI6IFtcIk5pY2tuYW1lXCJdLFxcbicgK1xuICAgICcgICAgICBcIm1ham9yXCI6IHRydWUsXFxuJyArXG4gICAgJyAgICAgIFwiaGlnaGxpZ2h0c1wiOiBbXFxuJyArXG4gICAgJyAgICAgICAge1wicXVvdGVcIjogXCJGaXJzdCB+ODAgY2hhcnMgb2YgdGhlIGhpZ2hsaWdodCB0ZXh0Li4uXCIsIFwic3VtbWFyeVwiOiBcIkJyaWVmIDUtMTAgd29yZCBkZXNjcmlwdGlvblwifVxcbicgK1xuICAgICcgICAgICBdLFxcbicgK1xuICAgICcgICAgICBcImNvbm5lY3Rpb25zXCI6IFtcXG4nICtcbiAgICAnICAgICAgICB7XCJlbnRpdHlcIjogXCJPdGhlciBFbnRpdHkgTmFtZVwiLCBcInJlbGF0aW9uc2hpcFwiOiBcImJyaWVmIGRlc2NyaXB0aW9uXCJ9XFxuJyArXG4gICAgJyAgICAgIF1cXG4nICtcbiAgICAnICAgIH1cXG4nICtcbiAgICAnICBdLFxcbicgK1xuICAgICcgIFwiY29uY2VwdHNcIjogW1xcbicgK1xuICAgICcgICAge1xcbicgK1xuICAgICcgICAgICBcIm5hbWVcIjogXCJDb25jZXB0IE5hbWVcIixcXG4nICtcbiAgICAnICAgICAgXCJhbGlhc2VzXCI6IFtcImFsdGVybmF0ZSBuYW1lXCJdLFxcbicgK1xuICAgICcgICAgICBcIm1ham9yXCI6IHRydWUsXFxuJyArXG4gICAgJyAgICAgIFwiaGlnaGxpZ2h0c1wiOiBbXFxuJyArXG4gICAgJyAgICAgICAge1wicXVvdGVcIjogXCJGaXJzdCB+ODAgY2hhcnMgb2YgdGhlIGhpZ2hsaWdodCB0ZXh0Li4uXCIsIFwic3VtbWFyeVwiOiBcIkJyaWVmIGRlc2NyaXB0aW9uXCJ9XFxuJyArXG4gICAgJyAgICAgIF0sXFxuJyArXG4gICAgJyAgICAgIFwiY29ubmVjdGlvbnNcIjogW1xcbicgK1xuICAgICcgICAgICAgIHtcImVudGl0eVwiOiBcIlBlcnNvbiBvciBDb25jZXB0IE5hbWVcIiwgXCJyZWxhdGlvbnNoaXBcIjogXCJicmllZiBkZXNjcmlwdGlvblwifVxcbicgK1xuICAgICcgICAgICBdXFxuJyArXG4gICAgJyAgICB9XFxuJyArXG4gICAgJyAgXVxcbicgK1xuICAgICd9XFxuJyArXG4gICAgJ1xcbicgK1xuICAgICdSdWxlczpcXG4nICtcbiAgICAnLSBcIm1ham9yXCIgaXMgdHJ1ZSBpZiB0aGUgZW50aXR5IGhhcyBzaWduaWZpY2FudCBjb3ZlcmFnZSAobXVsdGlwbGUgaGlnaGxpZ2h0cyBvciBjZW50cmFsIHRvIHRoZSBuYXJyYXRpdmUpLCBmYWxzZSBmb3IgYnJpZWYvcGFzc2luZyBtZW50aW9uc1xcbicgK1xuICAgICctIEZvciBcInF1b3RlXCIsIHVzZSB0aGUgZmlyc3QgfjgwIGNoYXJhY3RlcnMgb2YgdGhlIGFjdHVhbCBoaWdobGlnaHQgdGV4dCBmcm9tIHRoZSBub3RlIChlbm91Z2ggdG8gaWRlbnRpZnkgaXQpXFxuJyArXG4gICAgJy0gQSBoaWdobGlnaHQgY2FuIGJlIGFzc29jaWF0ZWQgd2l0aCBtdWx0aXBsZSBlbnRpdGllc1xcbicgK1xuICAgICctIEZvciBjb25uZWN0aW9ucywgb25seSBsaW5rIHRvIG90aGVyIGVudGl0aWVzIHlvdSBhcmUgZXh0cmFjdGluZyAobm90IGV4dGVybmFsIGZpZ3VyZXMpXFxuJyArXG4gICAgJy0gUGVvcGxlIGNvbm5lY3Rpb25zIHNob3VsZCBpbmNsdWRlIHJlbGF0aW9uc2hpcHMgbGlrZSBcImNvLWRldmVsb3BlclwiLCBcInN0dWRlbnRcIiwgXCJhZHZpc29yXCIsIFwiY29sbGVhZ3VlXCIsIFwiY3JpdGljXCJcXG4nICtcbiAgICAnLSBDb25jZXB0IGNvbm5lY3Rpb25zIHNob3VsZCBsaW5rIHRvIHJlbGF0ZWQgcGVvcGxlIEFORCByZWxhdGVkIGNvbmNlcHRzXFxuJyArXG4gICAgJy0gSW5jbHVkZSBBTEwgcGVvcGxlIG1lbnRpb25lZCBieSBuYW1lLCBldmVuIGJyaWVmbHkgXHUyMDE0IHRoZXkgYmVjb21lIHN0dWJzXFxuJyArXG4gICAgJy0gRm9yIGNvbmNlcHRzLCBmb2N1cyBvbiB0ZWNobmljYWwvaW50ZWxsZWN0dWFsIGNvbmNlcHRzLCBub3QgZ2VuZXJhbCB0ZXJtc1xcbicgK1xuICAgICctIFJldHVybiBPTkxZIHRoZSBKU09OIG9iamVjdCwgbm8gbWFya2Rvd24gZmVuY2luZyBvciBleHBsYW5hdGlvblxcbicgK1xuICAgICdcXG4nICtcbiAgICAnQm9vayBub3RlIGNvbnRlbnQ6XFxuJztcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEVudGl0eUV4dHJhY3RvclNldHRpbmdzID0ge1xuICAgIGVuY3J5cHRlZEFwaUtleTogJycsXG4gICAgZW5jcnlwdGlvbktleTogJycsXG4gICAgaXY6ICcnLFxuICAgIG1vZGVsOiAnY2xhdWRlLXNvbm5ldC00LTYnLFxufTtcbiIsICJleHBvcnQgaW50ZXJmYWNlIFBhcnNlZEJvb2tOb3RlIHtcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIHJlZnM6IFNldDxzdHJpbmc+O1xuICAgIGhhc1JlYWR3aXNlSGlnaGxpZ2h0czogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIaWdobGlnaHQge1xuICAgIHJlZj86IHN0cmluZztcbiAgICBxdW90ZT86IHN0cmluZztcbiAgICBzdW1tYXJ5OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29ubmVjdGlvbiB7XG4gICAgZW50aXR5OiBzdHJpbmc7XG4gICAgcmVsYXRpb25zaGlwOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRW50aXR5IHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgYWxpYXNlcz86IHN0cmluZ1tdO1xuICAgIG1ham9yPzogYm9vbGVhbjtcbiAgICBoaWdobGlnaHRzPzogSGlnaGxpZ2h0W107XG4gICAgY29ubmVjdGlvbnM/OiBDb25uZWN0aW9uW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzYW5pdGl6ZUZpbGVuYW1lKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIG5hbWUucmVwbGFjZSgvW1xcXFwvOio/XCI8PnxdL2csICctJyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUJvb2tOb3RlKGNvbnRlbnQ6IHN0cmluZyk6IFBhcnNlZEJvb2tOb3RlIHtcbiAgICBjb25zdCB0aXRsZU1hdGNoID0gY29udGVudC5tYXRjaCgvXiMgKC4rKSQvbSk7XG4gICAgY29uc3QgdGl0bGUgPSB0aXRsZU1hdGNoID8gdGl0bGVNYXRjaFsxXS50cmltKCkgOiAnVW50aXRsZWQnO1xuICAgIGNvbnN0IHJlZnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCByZSA9IC9cXF4ocmVmLVxcZCspL2c7XG4gICAgbGV0IG07XG4gICAgd2hpbGUgKChtID0gcmUuZXhlYyhjb250ZW50KSkgIT09IG51bGwpIHtcbiAgICAgICAgcmVmcy5hZGQobVsxXSk7XG4gICAgfVxuXG4gICAgLy8gRGV0ZWN0IFJlYWR3aXNlLXN0eWxlIGhpZ2hsaWdodHM6IHBhcmFncmFwaHMgc2VwYXJhdGVkIGJ5IC0tLSB3aXRoIChbTG9jYXRpb24gLi4uXSkgbGlua3MsXG4gICAgLy8gb3IgcGxhaW4gYmxvY2txdW90ZSBsaW5lcyAoPiAuLi4pXG4gICAgbGV0IGhhc1JlYWR3aXNlSGlnaGxpZ2h0cyA9IGZhbHNlO1xuICAgIGlmIChyZWZzLnNpemUgPT09IDApIHtcbiAgICAgICAgaGFzUmVhZHdpc2VIaWdobGlnaHRzID1cbiAgICAgICAgICAgIC9cXChcXFtMb2NhdGlvblxccytcXGQrXFxdXFwoLy50ZXN0KGNvbnRlbnQpIHx8XG4gICAgICAgICAgICAvXj5cXHMrLnsxMCx9L20udGVzdChjb250ZW50KSB8fFxuICAgICAgICAgICAgL1xcbi0tLVxcbi8udGVzdChjb250ZW50KTtcbiAgICB9XG5cbiAgICByZXR1cm4geyB0aXRsZSwgcmVmcywgaGFzUmVhZHdpc2VIaWdobGlnaHRzIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRSZWFkaW5nU2VjdGlvbihcbiAgICBib29rVGl0bGU6IHN0cmluZyxcbiAgICBoaWdobGlnaHRzOiBIaWdobGlnaHRbXSB8IHVuZGVmaW5lZCxcbik6IHN0cmluZyB7XG4gICAgaWYgKCFoaWdobGlnaHRzIHx8IGhpZ2hsaWdodHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiAnIyMjIFtbJyArIGJvb2tUaXRsZSArICddXVxcbi0gTWVudGlvbmVkIGluIHRleHRcXG4nO1xuICAgIH1cbiAgICBjb25zdCBsaW5lcyA9IGhpZ2hsaWdodHMubWFwKChoKSA9PiB7XG4gICAgICAgIGlmIChoLnJlZikge1xuICAgICAgICAgICAgcmV0dXJuICctICcgKyBoLnN1bW1hcnkgKyAnICFbWycgKyBib29rVGl0bGUgKyAnI14nICsgaC5yZWYgKyAnXV0nO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAnLSAnICsgaC5zdW1tYXJ5O1xuICAgIH0pO1xuICAgIHJldHVybiAnIyMjIFtbJyArIGJvb2tUaXRsZSArICddXVxcbicgKyBsaW5lcy5qb2luKCdcXG4nKSArICdcXG4nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRFbnRpdHlOb3RlKFxuICAgIHR5cGU6IHN0cmluZyxcbiAgICBlbnRpdHk6IEVudGl0eSxcbiAgICBib29rVGl0bGU6IHN0cmluZyxcbik6IHN0cmluZyB7XG4gICAgbGV0IGFsaWFzWWFtbCA9ICcnO1xuICAgIGlmIChlbnRpdHkuYWxpYXNlcyAmJiBlbnRpdHkuYWxpYXNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGFsaWFzWWFtbCA9XG4gICAgICAgICAgICAnYWxpYXNlczpcXG4nICtcbiAgICAgICAgICAgIGVudGl0eS5hbGlhc2VzLm1hcCgoYSkgPT4gJyAgLSAnICsgYSkuam9pbignXFxuJykgK1xuICAgICAgICAgICAgJ1xcbic7XG4gICAgfVxuXG4gICAgY29uc3QgcmVhZGluZ1NlY3Rpb24gPSBmb3JtYXRSZWFkaW5nU2VjdGlvbihib29rVGl0bGUsIGVudGl0eS5oaWdobGlnaHRzKTtcblxuICAgIGxldCBjb25uZWN0aW9ucyA9ICcnO1xuICAgIGlmIChlbnRpdHkuY29ubmVjdGlvbnMgJiYgZW50aXR5LmNvbm5lY3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgbGluZXMgPSBlbnRpdHkuY29ubmVjdGlvbnMubWFwKFxuICAgICAgICAgICAgKGMpID0+ICctIFtbJyArIGMuZW50aXR5ICsgJ11dIFxcdTIwMTQgJyArIGMucmVsYXRpb25zaGlwLFxuICAgICAgICApO1xuICAgICAgICBjb25uZWN0aW9ucyA9ICcjIyBDb25uZWN0ZWQgVG9cXG4nICsgbGluZXMuam9pbignXFxuJykgKyAnXFxuJztcbiAgICB9XG5cbiAgICByZXR1cm4gKFxuICAgICAgICAnLS0tXFxuJyArXG4gICAgICAgICd0eXBlOiAnICsgdHlwZSArICdcXG4nICtcbiAgICAgICAgJ3RhZ3M6XFxuJyArXG4gICAgICAgICcgIC0gJyArIHR5cGUgKyAnXFxuJyArXG4gICAgICAgIGFsaWFzWWFtbCArXG4gICAgICAgICctLS1cXG4nICtcbiAgICAgICAgJ1xcbicgK1xuICAgICAgICAnIyAnICsgZW50aXR5Lm5hbWUgKyAnXFxuJyArXG4gICAgICAgICdcXG4nICtcbiAgICAgICAgJyMjIEZyb20gTXkgUmVhZGluZ1xcbicgK1xuICAgICAgICAnXFxuJyArXG4gICAgICAgIHJlYWRpbmdTZWN0aW9uICtcbiAgICAgICAgJ1xcbicgK1xuICAgICAgICBjb25uZWN0aW9ucyArXG4gICAgICAgICdcXG4nICtcbiAgICAgICAgJyMjIE1lbnRpb25lZCBJblxcbicgK1xuICAgICAgICAnLSBbWycgKyBib29rVGl0bGUgKyAnXV1cXG4nXG4gICAgKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQUE2RTs7O0FDQXRFLFNBQVMsV0FBVyxLQUF5QjtBQUNoRCxRQUFNLFFBQVEsSUFBSSxXQUFXLElBQUksU0FBUyxDQUFDO0FBQzNDLFdBQVMsSUFBSSxHQUFHLElBQUksSUFBSSxRQUFRLEtBQUssR0FBRztBQUNwQyxVQUFNLElBQUksQ0FBQyxJQUFJLFNBQVMsSUFBSSxPQUFPLEdBQUcsQ0FBQyxHQUFHLEVBQUU7QUFBQSxFQUNoRDtBQUNBLFNBQU87QUFDWDtBQUVPLFNBQVMsV0FBVyxPQUEyQjtBQUNsRCxTQUFPLE1BQU0sS0FBSyxLQUFLLEVBQ2xCLElBQUksQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUUsU0FBUyxHQUFHLEdBQUcsQ0FBQyxFQUMxQyxLQUFLLEVBQUU7QUFDaEI7QUFFQSxlQUFzQixpQkFBa0M7QUFDcEQsUUFBTSxNQUFNLE1BQU0sT0FBTyxPQUFPO0FBQUEsSUFDNUIsRUFBRSxNQUFNLFdBQVcsUUFBUSxJQUFJO0FBQUEsSUFDL0I7QUFBQSxJQUNBLENBQUMsV0FBVyxTQUFTO0FBQUEsRUFDekI7QUFDQSxRQUFNLE1BQU0sTUFBTSxPQUFPLE9BQU8sVUFBVSxPQUFPLEdBQUc7QUFDcEQsU0FBTyxXQUFXLElBQUksV0FBVyxHQUFHLENBQUM7QUFDekM7QUFFQSxlQUFzQixhQUFhLEtBQWlDO0FBQ2hFLFNBQU8sT0FBTyxPQUFPO0FBQUEsSUFDakI7QUFBQSxJQUNBLFdBQVcsR0FBRyxFQUFFO0FBQUEsSUFDaEIsRUFBRSxNQUFNLFVBQVU7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
