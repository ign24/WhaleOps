export const BACKGROUND_MOTION_STORAGE_KEY = "cgn-agent-background-motion";
export const BACKGROUND_MOTION_EVENT = "cgn-agent-background-motion:changed";

export const isBackgroundMotionEnabledSnapshot = (): boolean => {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(BACKGROUND_MOTION_STORAGE_KEY) !== "0";
};

export const setBackgroundMotionEnabled = (enabled: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(BACKGROUND_MOTION_STORAGE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event(BACKGROUND_MOTION_EVENT));
};

export const subscribeBackgroundMotion = (onStoreChange: () => void): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const notify = () => onStoreChange();
  window.addEventListener("storage", notify);
  window.addEventListener(BACKGROUND_MOTION_EVENT, notify);

  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(BACKGROUND_MOTION_EVENT, notify);
  };
};
