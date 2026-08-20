var PubMedSearch = {
  pageSize: 20,
  page: 0,
  total: 0,
  results: [],
  selected: new Map(),
  requestSerial: 0,
  busy: false,
  io: null,

  init() {
    this.io = window.arguments?.[0]?.wrappedJSObject || window.arguments?.[0];
    if (!this.io?.libraryID) {
      throw new Error("No target Zotero library was provided");
    }

    const target = [this.io.libraryName, this.io.collectionName]
      .filter(Boolean)
      .join(" / ");
    document.getElementById("target-label").textContent = `导入至：${target}`;

    document.getElementById("search-form").addEventListener("submit", (event) => {
      event.preventDefault();
      this.page = 0;
      this.search();
    });
    document.getElementById("sort-select").addEventListener("change", () => {
      if (document.getElementById("query-input").value.trim()) {
        this.page = 0;
        this.search();
      }
    });
    document.getElementById("previous-button").addEventListener("click", () => {
      if (this.page > 0) {
        this.page--;
        this.search();
      }
    });
    document.getElementById("next-button").addEventListener("click", () => {
      if ((this.page + 1) * this.pageSize < this.total) {
        this.page++;
        this.search();
      }
    });
    document.getElementById("select-all").addEventListener("change", (event) => {
      this.selectCurrentPage(event.target.checked);
    });
    document.getElementById("import-button").addEventListener("click", () => {
      this.importSelected();
    });
    document.getElementById("close-button").addEventListener("click", () => window.close());

    this.updateControls();
    document.getElementById("query-input").focus();
  },

  async search() {
    const query = document.getElementById("query-input").value.trim();
    if (!query || this.busy) return;

    const serial = ++this.requestSerial;
    this.setBusy(true, "正在检索 PubMed...");
    try {
      const searchParams = new URLSearchParams({
        db: "pubmed",
        term: query,
        retmode: "json",
        retstart: String(this.page * this.pageSize),
        retmax: String(this.pageSize),
        sort: document.getElementById("sort-select").value,
        tool: "ZoteroPubMedImporter"
      });
      const searchData = await this.requestJSON(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`
      );
      if (serial !== this.requestSerial) return;

      const searchResult = searchData.esearchresult || {};
      const pmids = searchResult.idlist || [];
      this.total = Number(searchResult.count || 0);

      if (!pmids.length) {
        this.results = [];
        this.renderResults();
        this.setStatus("未找到匹配记录");
        return;
      }

      const summaryParams = new URLSearchParams({
        db: "pubmed",
        id: pmids.join(","),
        retmode: "json",
        tool: "ZoteroPubMedImporter"
      });
      const summaryData = await this.requestJSON(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams}`
      );
      if (serial !== this.requestSerial) return;

      let abstracts = new Map();
      try {
        abstracts = await this.fetchAbstracts(pmids);
      } catch (error) {
        Zotero.logError(error);
      }
      if (serial !== this.requestSerial) return;

      const existing = await this.findExistingPMIDs(pmids);
      this.results = pmids
        .map((pmid) => this.normalizeSummary(
          summaryData.result?.[pmid],
          existing.has(pmid),
          abstracts.get(pmid) || ""
        ))
        .filter(Boolean);
      this.renderResults();
      this.setStatus(`已载入 ${this.results.length} 条记录`);
    } catch (error) {
      Zotero.logError(error);
      this.results = [];
      this.renderResults();
      this.setStatus(`检索失败：${this.errorMessage(error)}`);
    } finally {
      if (serial === this.requestSerial) this.setBusy(false);
    }
  },

  async requestJSON(url) {
    const response = await Zotero.HTTP.request("GET", url, { timeout: 30000 });
    const text = response.responseText || response.response;
    return typeof text === "string" ? JSON.parse(text) : text;
  },

  async fetchAbstracts(pmids) {
    const params = new URLSearchParams({
      db: "pubmed",
      id: pmids.join(","),
      retmode: "xml",
      tool: "ZoteroPubMedImporter"
    });
    const response = await Zotero.HTTP.request(
      "GET",
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${params}`,
      { timeout: 30000 }
    );
    return this.parseAbstracts(response.responseText || response.response || "");
  },

  parseAbstracts(xmlText) {
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.querySelector("parsererror")) {
      throw new Error("PubMed 返回的摘要数据无法解析");
    }

    const abstracts = new Map();
    const records = [
      ...xml.getElementsByTagName("PubmedArticle"),
      ...xml.getElementsByTagName("PubmedBookArticle")
    ];
    for (const record of records) {
      const pmid = record.getElementsByTagName("PMID")[0]?.textContent?.trim();
      const abstract = record.getElementsByTagName("Abstract")[0];
      if (!pmid || !abstract) continue;

      const sections = [...abstract.getElementsByTagName("AbstractText")]
        .map((node) => {
          const text = node.textContent.replace(/\s+/g, " ").trim();
          const label = node.getAttribute("Label")?.trim();
          if (!text) return "";
          return label && !text.toLowerCase().startsWith(`${label.toLowerCase()}:`)
            ? `${label}: ${text}`
            : text;
        })
        .filter(Boolean);
      if (sections.length) abstracts.set(pmid, sections.join(" "));
    }
    return abstracts;
  },

  normalizeSummary(summary, existing, abstract) {
    if (!summary?.uid) return null;
    const doi = (summary.articleids || []).find((id) => id.idtype === "doi")?.value || "";
    const authors = (summary.authors || []).map((author) => author.name).filter(Boolean);
    const rawDate = summary.epubdate || summary.sortpubdate || summary.pubdate || "";
    return {
      pmid: String(summary.uid),
      doi,
      title: summary.title || "(无题名)",
      authors,
      journal: summary.fulljournalname || summary.source || "",
      date: rawDate.replace(/\s+00:00$/, ""),
      abstract,
      existing
    };
  },

  async findExistingPMIDs(pmids) {
    const existing = new Set();
    for (const pmid of pmids) {
      const search = new Zotero.Search();
      search.libraryID = this.io.libraryID;
      search.addCondition("PMID", "is", pmid);
      if ((await search.search()).length) existing.add(pmid);
    }
    return existing;
  },

  renderResults() {
    const body = document.getElementById("result-body");
    body.replaceChildren();

    for (const item of this.results) {
      const row = this.createElement("tr");
      if (item.existing) row.classList.add("existing");

      const selectCell = this.createElement("td");
      const checkbox = this.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = this.selected.has(item.pmid);
      checkbox.disabled = item.existing;
      checkbox.setAttribute("aria-label", `选择 PMID ${item.pmid}`);
      checkbox.addEventListener("change", () => {
        checkbox.checked ? this.selected.set(item.pmid, item) : this.selected.delete(item.pmid);
        this.updateControls();
      });
      selectCell.append(checkbox);

      const titleCell = this.createElement("td");
      titleCell.append(
        this.textElement("div", "title-text", item.title),
        this.textElement("div", "author-text", this.formatAuthors(item.authors))
      );
      const abstract = this.textElement(
        "div",
        "abstract-text",
        item.abstract || "暂无摘要"
      );
      if (!item.abstract) abstract.classList.add("no-abstract");
      titleCell.append(abstract);

      const journalCell = this.createElement("td");
      journalCell.append(this.textElement("div", "journal-text", item.journal));

      const dateCell = this.createElement("td");
      dateCell.append(this.textElement("div", "date-text", item.date));

      const idCell = this.createElement("td");
      const ids = this.textElement("div", "identifier-text", "");
      const pmidLink = this.createElement("a");
      pmidLink.href = `https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/`;
      pmidLink.textContent = `PMID ${item.pmid}`;
      pmidLink.target = "_blank";
      ids.append(pmidLink);
      if (item.doi) ids.append(this.createElement("br"), document.createTextNode(`DOI ${item.doi}`));
      idCell.append(ids);
      if (item.existing) idCell.append(this.textElement("span", "existing-badge", "已存在"));

      row.append(selectCell, titleCell, journalCell, dateCell, idCell);
      body.append(row);
    }

    document.getElementById("empty-state").hidden = this.results.length > 0;
    this.updateControls();
  },

  textElement(tag, className, text) {
    const element = this.createElement(tag);
    element.className = className;
    element.textContent = text || "";
    return element;
  },

  createElement(tag) {
    return document.createElementNS("http://www.w3.org/1999/xhtml", tag);
  },

  formatAuthors(authors) {
    if (!authors.length) return "";
    return authors.length > 6
      ? `${authors.slice(0, 6).join(", ")} 等`
      : authors.join(", ");
  },

  selectCurrentPage(checked) {
    for (const item of this.results) {
      if (item.existing) continue;
      checked ? this.selected.set(item.pmid, item) : this.selected.delete(item.pmid);
    }
    this.renderResults();
  },

  async importSelected() {
    if (!this.selected.size || this.busy) return;

    const records = [...this.selected.values()];
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    this.setBusy(true, `正在导入 0 / ${records.length}...`);

    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      this.setStatus(`正在导入 ${index + 1} / ${records.length}：PMID ${record.pmid}`);
      try {
        if ((await this.findExistingPMIDs([record.pmid])).has(record.pmid)) {
          skipped++;
        } else {
          await this.importPMID(record.pmid);
          imported++;
        }
      } catch (error) {
        failed++;
        Zotero.logError(error);
      }
      if (index < records.length - 1) await Zotero.Promise.delay(350);
    }

    for (const record of records) {
      record.existing = true;
      this.selected.delete(record.pmid);
    }
    this.renderResults();
    this.setBusy(false);
    this.setStatus(`导入完成：成功 ${imported}，已存在 ${skipped}，失败 ${failed}`);
  },

  async importPMID(pmid) {
    const translate = new Zotero.Translate.Search();
    translate.setIdentifier({ PMID: pmid });
    const translators = await translate.getTranslators();
    if (!translators.length) throw new Error(`没有可用于 PMID ${pmid} 的翻译器`);

    translate.setTranslator(translators);
    const items = await translate.translate({
      libraryID: this.io.libraryID,
      collections: this.io.collectionID ? [this.io.collectionID] : [],
      saveAttachments: false
    });
    if (!items.length) throw new Error(`PMID ${pmid} 未返回可导入记录`);
    return items[0];
  },

  setBusy(busy, status) {
    this.busy = busy;
    if (status) this.setStatus(status);
    document.getElementById("query-input").disabled = busy;
    document.getElementById("sort-select").disabled = busy;
    document.getElementById("search-button").disabled = busy;
    this.updateControls();
  },

  setStatus(message) {
    document.getElementById("status-text").textContent = message || "";
  },

  updateControls() {
    const pages = this.total ? Math.ceil(this.total / this.pageSize) : 0;
    document.getElementById("result-count").textContent = this.total
      ? `共 ${this.total.toLocaleString()} 条结果`
      : "尚无检索结果";
    document.getElementById("page-label").textContent = pages ? `${this.page + 1} / ${pages}` : "0 / 0";
    document.getElementById("previous-button").disabled = this.busy || this.page === 0;
    document.getElementById("next-button").disabled = this.busy || (this.page + 1) * this.pageSize >= this.total;
    document.getElementById("import-button").disabled = this.busy || this.selected.size === 0;
    document.getElementById("selected-count").textContent = `已选择 ${this.selected.size} 篇`;

    const available = this.results.filter((item) => !item.existing);
    const selectedOnPage = available.filter((item) => this.selected.has(item.pmid)).length;
    const selectAll = document.getElementById("select-all");
    selectAll.disabled = this.busy || available.length === 0;
    selectAll.checked = available.length > 0 && selectedOnPage === available.length;
    selectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < available.length;
  },

  errorMessage(error) {
    if (error?.status) return `HTTP ${error.status}`;
    return error?.message || String(error);
  }
};

window.addEventListener("load", () => PubMedSearch.init(), { once: true });
