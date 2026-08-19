var chromeHandle;

function install() {}

async function startup({ rootURI }) {
  const normalizedRootURI = rootURI.endsWith("/") ? rootURI : `${rootURI}/`;
  const addonManagerStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"]
    .getService(Ci.amIAddonManagerStartup);
  chromeHandle = addonManagerStartup.registerChrome(
    Services.io.newURI(`${normalizedRootURI}manifest.json`),
    [["content", "zotero-pubmed-importer", "content/"]]
  );

  const context = { rootURI: normalizedRootURI };
  context._globalThis = context;
  Services.scriptloader.loadSubScript(
    `${normalizedRootURI}content/pubmed-importer.js`,
    context
  );
  await Zotero.PubMedImporter.startup();
}

function onMainWindowLoad({ window }) {
  Zotero.PubMedImporter?.scheduleToolbarButton(window);
}

function onMainWindowUnload({ window }) {
  Zotero.PubMedImporter?.removeToolbarButton(window);
}

function shutdown(_data, reason) {
  if (reason === APP_SHUTDOWN) return;
  Zotero.PubMedImporter?.shutdown();
  delete Zotero.PubMedImporter;
  chromeHandle?.destruct();
  chromeHandle = null;
}

function uninstall() {}
