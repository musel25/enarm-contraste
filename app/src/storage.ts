import { useEffect, useState } from "react";

export interface ReviewContext {
  axisId: string;
  section: string;
  label: string;
  caseId?: string;
}
export interface ReviewNote {
  id: string;
  text: string;
  category: string;
  createdAt: string;
  context: ReviewContext;
}
export const REVIEW_KEY = "enarm-contraste-review-v1";
export const PRACTICE_KEY = "enarm-contraste-practice-v1";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validReviews(value: unknown): value is ReviewNote[] {
  return (
    Array.isArray(value) &&
    value.every(
      (note) =>
        record(note) &&
        typeof note.id === "string" &&
        typeof note.text === "string" &&
        note.text.length <= 10000 &&
        typeof note.category === "string" &&
        typeof note.createdAt === "string" &&
        record(note.context) &&
        typeof note.context.axisId === "string" &&
        typeof note.context.section === "string" &&
        typeof note.context.label === "string" &&
        (note.context.caseId === undefined ||
          typeof note.context.caseId === "string"),
    )
  );
}

export function validPractice(
  value: unknown,
): value is Record<string, "known" | "again"> {
  return (
    record(value) &&
    Object.values(value).every((item) => item === "known" || item === "again")
  );
}

export function readState<T>(
  key: string,
  valid: (value: unknown) => value is T,
  fallback: T,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function useLocalData<T>(
  key: string,
  valid: (value: unknown) => value is T,
  fallback: T,
) {
  const [data, setData] = useState<T>(() => readState(key, valid, fallback));
  const [persisted, setPersisted] = useState(true);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      setPersisted(true);
    } catch {
      setPersisted(false);
    }
  }, [key, data]);
  return [data, setData, persisted] as const;
}
