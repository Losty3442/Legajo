import type { RankingRow, Workspace } from "./models";

/** Ranking is advisory: equal scores share a position; no invented tie-break rule. */
export function ranking(data: Workspace, callId: string, vacancyId: string): RankingRow[] {
  const requests = data.requests.filter(r => r.callId === callId && r.vacancyId === vacancyId);
  const rows = requests.flatMap(r => {
    const e = data.evaluations.find(e => e.requestId === r.id);
    return e ? [{ requestId: r.id, evaluationId: e.id, teacherId: r.teacherId,
      name: e.teacherSnapshot.name, score: e.score, outcome: e.outcome, position: null as number | null, tied: false }] : [];
  }).sort((a, b) => Number(b.outcome === "apto") - Number(a.outcome === "apto") || b.score - a.score || a.name.localeCompare(b.name));
  rows.forEach((row, i) => {
    if (row.outcome !== "apto") return;
    row.position = rows.findIndex(other => other.outcome === "apto" && other.score === row.score) + 1;
    row.tied = rows.some((other, j) => j !== i && other.outcome === "apto" && other.score === row.score);
  });
  return rows;
}
export function rankingPending(data: Workspace, callId: string, vacancyId: string): boolean {
  return data.requests.some(r => r.callId === callId && r.vacancyId === vacancyId && ["presentada", "observada", "borrador"].includes(r.status));
}
