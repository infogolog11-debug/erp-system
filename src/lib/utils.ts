import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number|string,
  currency = "USD",
  locale = "ar-SA"
): string {
  return new Intl.NumberFormat(locale,{
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatDate(date: Date|string, locale = "ar-SA"): string {
  return new Intl.DateTimeFormat(locale,{
    year: "numeric", month: "long", day: "numeric",
  }).format(new Date(date));
}

// توليد كود فريد لكل وحدة
export function generateCode(prefix: string, sequence: number): string {
  return `${prefix}-${new Date().getFullYear()}-${String(sequence).padStart(5,"0")}`;
}
