// Central registry of @tanstack/react-query keys. Previously every screen
// defined its own inline key array, which made mismatched invalidation easy
// (a mutation invalidating the wrong key silently leaves a list stale).
//
// All expense lists/details live under the `expenses` root, so invalidating
// `queryKeys.expenses` cascades to timeline, inbox, insights, and detail.
export const queryKeys = {
  expenses: ["expenses"] as const,
  timeline: ["expenses", "timeline"] as const,
  inbox: ["expenses", "inbox"] as const,
  insights: ["expenses", "insights"] as const,
  expenseDetail: (id: number) => ["expenses", "detail", id] as const,
  expenseDigest: ["preferences", "expense-digest"] as const,
  mobileConfig: ["expense-mobile-config"] as const,
};
