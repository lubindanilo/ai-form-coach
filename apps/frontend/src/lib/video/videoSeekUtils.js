export function waitForVideoMetadata(videoEl) {
  return new Promise((resolve, reject) => {
    if (videoEl.readyState >= 1 && Number.isFinite(videoEl.duration)) return resolve();

    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Impossible de charger les metadata de la vidéo"));
    };
    const cleanup = () => {
      videoEl.removeEventListener("loadedmetadata", onLoaded);
      videoEl.removeEventListener("error", onError);
    };

    videoEl.addEventListener("loadedmetadata", onLoaded);
    videoEl.addEventListener("error", onError);
  });
}

export function seekTo(videoEl, timeSec) {
  return new Promise((resolve, reject) => {
    const duration = Number.isFinite(videoEl.duration) ? videoEl.duration : null;
    const target = duration ? Math.min(Math.max(timeSec, 0), duration) : Math.max(timeSec, 0);

    const onSeeked = () => {
      cleanup();
      // laisse le navigateur stabiliser le frame rendu
      requestAnimationFrame(() => resolve());
    };
    const onError = () => {
      cleanup();
      reject(new Error("Erreur pendant le seek vidéo"));
    };
    const cleanup = () => {
      videoEl.removeEventListener("seeked", onSeeked);
      videoEl.removeEventListener("error", onError);
    };

    videoEl.addEventListener("seeked", onSeeked);
    videoEl.addEventListener("error", onError);

    // déclenche le seek
    videoEl.currentTime = target;
  });
}