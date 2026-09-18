// منطق طابور المزامنة بدون اتصال — الأجزاء القابلة للاختبار بمعزل عن IndexedDB

export type QueuedFormType = "beneficiary_registration" | "distribution";

export interface QueueItem<T = any> {
  id: string;
  formType: QueuedFormType;
  payload: T;
  queuedAt: string; // ISO timestamp
  attempts: number;
  lastError?: string;
}

export function createQueueItem<T>(formType: QueuedFormType, payload: T): QueueItem<T> {
  return {
    id: `${formType}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    formType,
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
}

const MAX_ATTEMPTS = 5;

export function isRetryExceeded(item: QueueItem): boolean {
  return item.attempts >= MAX_ATTEMPTS;
}

// تأخير تصاعدي بين محاولات المزامنة (exponential backoff) — بالثواني
export function nextRetryDelaySeconds(attempts: number): number {
  return Math.min(60 * 2 ** attempts, 3600); // سقف ساعة واحدة
}

export function sortByQueuedAt<T>(items: QueueItem<T>[]): QueueItem<T>[] {
  return [...items].sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());
}
