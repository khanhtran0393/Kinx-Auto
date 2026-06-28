"use strict";
const {
  contextBridge: d,
  ipcRenderer: o,
  clipboard: i,
  shell: a,
} = require("electron");
d.exposeInMainWorld("electronAPI", {
  fetch: (e, t, n) => o.invoke("fetch-api", { url: e, cookie: t, options: n }),
  startBrowserAutomation: (e) => o.send("browser:start-automation", e),
  stopBrowserAutomation: () => o.send("browser:stop-automation"),
  videoCreateFromFrames: (e) => o.send("video:create-from-frames", e),
  videoCreateFromReferences: (e) => o.send("video:create-from-references", e),
  videoCreateExtended: (e) => o.send("extended-video:start", e),
  stopExtendedVideo: () => o.send("extended-video:stop"),
  mergeVideos: (e) => o.invoke("merge-videos", e),
  selectVideoFiles: () => o.invoke("select-video-files"),
  stopMerge: () => o.invoke("stop-merge"),
  getVideoMetadata: (e) => o.invoke("get-video-metadata", e),
  getLoadableVideoSrc: (e) => o.invoke("get-loadable-video-src", e),
  cutVideo: (e) => o.invoke("video:cut", e),
  extractFrames: (e) => o.invoke("video:extract-frames", e),
  stopCut: () => o.invoke("video:stop-cut"),
  downloadVideo: (e) => o.send("download-video", e),
  downloadImage: (e) => o.send("download-image", e),
  selectDownloadDirectory: () => o.invoke("select-download-directory"),
  importPromptsFromFile: () => o.invoke("import-prompts-from-file"),
  importJsonPromptsFromFile: () => o.invoke("import-prompts-from-json"),
  getAppVersion: () => o.invoke("get-app-version"),
  saveImageToDisk: (config) => o.invoke("save-image-to-disk", config),
  downloadAndSaveVideo: (config) => o.invoke("download-and-save-video", config),
  onDownloadComplete: (e) => {
    const t = (n, r) => e(r);
    return (
      o.on("download-complete", t),
      () => o.removeListener("download-complete", t)
    );
  },
  onBrowserLog: (e) => {
    const t = (n, r) => e(r);
    return o.on("browser:log", t), () => o.removeListener("browser:log", t);
  },
  onExtendedVideoLog: (e) => {
    const t = (n, r) => e(r);
    return (
      o.on("extended-video:log", t),
      () => o.removeListener("extended-video:log", t)
    );
  },
  onCookieUpdate: (e) => {
    const t = (n, r) => e(r);
    return (
      o.on("browser:cookie-update", t),
      () => o.removeListener("browser:cookie-update", t)
    );
  },
  onNavigateToView: (e) => {
    const t = (n, r) => e(r);
    return (
      o.on("navigate-to-view", t), () => o.removeListener("navigate-to-view", t)
    );
  },
  onMergeProgress: (e) => {
    const t = (n, r) => e(r);
    return (
      o.on("merge-progress", t), () => o.removeListener("merge-progress", t)
    );
  },
  onCutProgress: (e) => {
    const t = (n, r) => e(r);
    return o.on("cut-progress", t), () => o.removeListener("cut-progress", t);
  },
  checkForUpdates: () => o.send("check-for-updates"),
  downloadUpdate: () => o.send("download-update"),
  onUpdateMessage: (e) => {
    const t = (n, r, s) => e(r, s);
    return (
      o.on("update-message", t), () => o.removeListener("update-message", t)
    );
  },
  restartAndInstall: () => o.send("restart-and-install"),
  forceReloadWindow: () => o.send("app:force-reload-window"),
  copyText: (e) => i.writeText(e),
  openExternalLink: (e) => o.send("app:open-external", e),
  // Gemini API methods
  geminiSaveApiKey: (key) => o.invoke("gemini:save-api-key", key),
  geminiGetApiKey: () => o.invoke("gemini:get-api-key"),
  geminiTestApiKey: (key) => o.invoke("gemini:test-api-key", key),
  geminiGenerateImage: (params) => o.invoke("gemini:generate-image", params),
  geminiGenerateVideo: (params) => o.invoke("gemini:generate-video", params),
  geminiPollVideoOperation: (operationName, apiKey) =>
    o.invoke("gemini:poll-video-operation", operationName, apiKey),
  geminiDownloadVideo: (videoUri, apiKey) =>
    o.invoke("gemini:download-video", videoUri, apiKey),
  startAutoProductMaker: (e) => o.send("video:auto-product-maker", e),
  onAutoProductLog: (e) => {
    const t = (n, r) => e(r);
    return o.on("auto-product:log", t), () => o.removeListener("auto-product:log", t);
  },
  // --- Bê từ Dự án 2 sang để sửa lỗi onWhiskImageResult ---
  whiskStartImageAutomation: (e) => o.invoke("whisk:start-image-automation", e),
  whiskStoreImage: (e, t) => o.invoke("whisk:store-image", { key: e, base64: t }),
  whiskClearImages: () => o.invoke("whisk:clear-images"),
  onWhiskImageResult: (e) => {
    const t = (n, r) => e(r);
    o.on("whisk:image-result", t);
    return t; // Trả về function để có thể remove sau này
  },
  removeWhiskImageResult: (e) => {
    o.removeListener("whisk:image-result", e);
  },
  // -------------------------------------------------------
  geminiStartWebAutomation: (e) => o.invoke("gemini:start-web-automation", e),
  studioSaveCharacters: (chars) => o.invoke("studio:save-characters", chars),
  studioLoadCharacters: () => o.invoke("studio:load-characters"),
  studioImportCharactersFromFolder: () => o.invoke("studio:import-characters-from-folder"),
  studioSaveCharacterImage: (data) => o.invoke("studio:save-character-image", data),
  commerceSaveTasks: (tasks) => o.invoke("commerce:save-tasks", tasks),
  commerceLoadTasks: () => o.invoke("commerce:load-tasks"),
  extensionCheckStatus: () => o.invoke("extension:check-status"),
  // === NÚT THOÁT & POPUP BẢO TRÌ ===
  exitApplication: () => o.invoke("app:exit-application"),
  showMaintenancePopup: (data) => o.invoke("app:show-maintenance-popup", data),
  getEstimatedTime: (data) => o.invoke("app:get-estimated-time", data),
  getAppStatus: () => o.invoke("app:get-status"),
  onAppClosing: (callback) => {
    const handler = (event, data) => callback(data);
    o.on("app:closing", handler);
    return () => o.removeListener("app:closing", handler);
  },
  onMaintenancePopup: (callback) => {
    const handler = (event, data) => callback(data);
    o.on("app:show-maintenance-popup", handler);
    return () => o.removeListener("app:show-maintenance-popup", handler);
  },
  onEstimatedTimeUpdate: (callback) => {
    const handler = (event, data) => callback(data);
    o.on("estimated-time:update", handler);
    return () => o.removeListener("estimated-time:update", handler);
  },
  // Generic invoke for any IPC handler
  invoke: (channel, ...args) => o.invoke(channel, ...args),
  receive: (channel, callback) => {
    const handler = (event, data) => callback(data);
    o.on(channel, handler);
    return () => o.removeListener(channel, handler);
  },
  // === TTS Voice API ===
  ttsGetVoices: () => o.invoke("tts:get-voices"),
  ttsGenerate: (data) => o.invoke("tts:generate", data),
  ttsPreview: (data) => o.invoke("tts:preview", data),
  ttsGenerateBatch: (data) => o.invoke("tts:generate-batch", data),
  ttsSetOutputDir: () => o.invoke("tts:set-output-dir"),
  ttsGetOutputDir: () => o.invoke("tts:get-output-dir"),
  ttsOpenOutputDir: () => o.invoke("tts:open-output-dir"),
  onTtsBatchProgress: (cb) => {
    const handler = (event, data) => cb(data);
    o.on("tts:batch-progress", handler);
    return () => o.removeListener("tts:batch-progress", handler);
  },
  onTtsChunkProgress: (cb) => {
    const handler = (event, data) => cb(data);
    o.on("tts:chunk-progress", handler);
    return () => o.removeListener("tts:chunk-progress", handler);
  },
});



