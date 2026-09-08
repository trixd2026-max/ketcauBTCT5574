/** Đồng bộ localStorage giữa các tab module và tab Báo cáo (cùng tab + cross-tab). */
export const STORAGE_KEYS = {
  beams: 'ketcau-btct-5574-beams-v1',
  columns: 'ketcau-btct-5574-columns-v1',
  slabs: 'ketcau-btct-5574-slabs-v1',
  foundations: 'ketcau-btct-5574-foundations-v1',
  meta: 'ketcau-btct-5574-report-meta-v1',
} as const;

const EVENT = 'ketcau-storage';

export function saveList(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { key } }));
  } catch {
    /* ignore */
  }
}

export function loadListRaw(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Gọi trong ReportPanel / module để lắng nghe cập nhật */
export function subscribeStorage(onChange: () => void): () => void {
  const handler = () => onChange();
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  window.addEventListener('focus', handler);
  const onVis = () => {
    if (document.visibilityState === 'visible') onChange();
  };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
    window.removeEventListener('focus', handler);
    document.removeEventListener('visibilitychange', onVis);
  };
}
