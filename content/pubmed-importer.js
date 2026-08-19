var PubMedImporter = {
  pluginID: "zotero-pubmed-importer@duyang.dev",
  menuID: "pubmed-search-import-menuitem",
  menuLabel: "检索 PubMed 并导入...",
  toolbarButtonID: "zotero-pubmed-importer-toolbar-button",
  menuRegistrationID: null,
  rootURI,
  dialogURI: "chrome://zotero-pubmed-importer/content/pubmed-search.xhtml",

  async startup() {
    this.menuRegistrationID = Zotero.MenuManager.registerMenu({
      pluginID: this.pluginID,
      menuID: this.menuID,
      target: "main/menubar/tools",
      menus: [{
        menuType: "menuitem",
        enableForTabTypes: ["library"],
        onShowing: (_event, context) => {
          context.menuElem?.setAttribute("label", this.menuLabel);
          context.setEnabled(Boolean(Zotero.getActiveZoteroPane()?.canEdit()));
        },
        onCommand: (_event, context) => {
          this.openSearchWindow(context.menuElem?.ownerGlobal);
        }
      }]
    });

    if (!this.menuRegistrationID) {
      throw new Error("Failed to register the PubMed search menu");
    }

    for (const win of Zotero.getMainWindows()) {
      this.scheduleToolbarButton(win);
    }
  },

  scheduleToolbarButton(win) {
    win.setTimeout(() => {
      if (Zotero.PubMedImporter === this) this.addToolbarButton(win);
    }, 0);
  },

  addToolbarButton(win) {
    const doc = win.document;
    if (doc.getElementById(this.toolbarButtonID)) return;

    const toolbar = doc.getElementById("zotero-items-toolbar");
    if (!toolbar) return;

    const button = doc.createXULElement("toolbarbutton");
    button.id = this.toolbarButtonID;
    button.classList.add("zotero-tb-button");
    button.setAttribute("tabindex", "-1");
    button.setAttribute("tooltiptext", this.menuLabel);
    button.addEventListener("command", () => this.openSearchWindow(win));

    const icon = doc.createXULElement("image");
    icon.classList.add("toolbarbutton-icon");
    icon.style.setProperty("list-style-image", `url("${this.rootURI}icon.svg")`);
    icon.style.width = "20px";
    icon.style.height = "20px";
    button.append(icon);

    const spacer = [...toolbar.children].find((element) => element.localName === "spacer");
    toolbar.insertBefore(button, spacer || null);
  },

  removeToolbarButton(win) {
    win.document.getElementById(this.toolbarButtonID)?.remove();
  },

  openSearchWindow(ownerWindow) {
    const existing = Services.wm.getMostRecentWindow("zotero:pubmed-importer");
    if (existing) {
      existing.focus();
      return;
    }

    const win = ownerWindow || Zotero.getMainWindow();
    const pane = win.ZoteroPane || Zotero.getActiveZoteroPane();
    const libraryID = pane.getSelectedLibraryID();
    const collection = pane.getSelectedCollection();
    const library = Zotero.Libraries.get(libraryID);
    const io = {
      libraryID,
      libraryName: library?.name || "Zotero",
      collectionID: collection?.id || null,
      collectionName: collection?.name || "",
      wrappedJSObject: null
    };
    io.wrappedJSObject = io;

    win.openDialog(
      this.dialogURI,
      "zotero-pubmed-importer",
      "chrome,dialog=no,centerscreen,resizable=yes,width=1120,height=760",
      io
    );
  },

  shutdown() {
    if (this.menuRegistrationID) {
      Zotero.MenuManager.unregisterMenu(this.menuRegistrationID);
      this.menuRegistrationID = null;
    }

    for (const win of Zotero.getMainWindows()) {
      this.removeToolbarButton(win);
    }

    const dialog = Services.wm.getMostRecentWindow("zotero:pubmed-importer");
    dialog?.close();
  }
};

Zotero.PubMedImporter = PubMedImporter;
