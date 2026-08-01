/** A single "I ate this" record. `at` is an ISO timestamp of when it was logged. */
export interface CalorieEntry {
  id: string;
  kcal: number;
  at: string;
}
