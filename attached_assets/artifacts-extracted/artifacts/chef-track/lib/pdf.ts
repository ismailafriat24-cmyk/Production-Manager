import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import {
  Chef,
  Objective,
  ProblemReport,
  Production,
  WorkSession,
} from "@/types";

export interface CallRecord {
  id: string;
  chefId: string;
  chefName: string;
  createdAt: number;
  seen: boolean;
}

function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function durationMin(ms: number): string {
  if (ms <= 0) return "0m";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  return `${h}h ${rem}m`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ReportPayload {
  bossName: string;
  date: Date;
  chefs: Chef[];
  objectives: Objective[];
  workSessions: WorkSession[];
  productions: Production[];
  problems: ProblemReport[];
  bossSession: WorkSession | null;
  calls?: CallRecord[];
}

export function buildReportHtml(payload: ReportPayload): string {
  const {
    bossName, date, chefs, objectives,
    workSessions, productions, problems,
    bossSession, calls = [],
  } = payload;

  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // ── Per-operator data ──────────────────────────────────────────────────────
  const operatorRows = chefs.map((chef) => {
    const chefProds = productions.filter((p) => p.chefId === chef.id);
    const chefProbs = problems.filter((p) => p.chefId === chef.id);
    const chefSessions = workSessions.filter((w) => w.userId === chef.id && w.role === "chef");
    const chefCallCount = calls.filter((c) => c.chefId === chef.id).length;

    const totalQty = chefProds.reduce(
      (acc, p) => acc + p.items.reduce((s, it) => {
        const n = parseFloat(it.quantity); return s + (isNaN(n) ? 0 : n);
      }, 0),
      0,
    );

    // Earliest check-in, latest check-out across all sessions today
    const checkIns = chefSessions.map((w) => w.checkInAt).filter(Boolean);
    const checkOuts = chefSessions.map((w) => w.checkOutAt).filter((v): v is number => !!v);
    const firstIn = checkIns.length ? Math.min(...checkIns) : null;
    const lastOut = checkOuts.length ? Math.max(...checkOuts) : null;
    const totalSessionMs = chefSessions.reduce(
      (acc, w) => acc + ((w.checkOutAt ?? Date.now()) - w.checkInAt),
      0,
    );

    // Per-operator production items (compact: "ItemName ×qty, ...")
    const itemSummary = chefProds.length
      ? chefProds
          .flatMap((p) => p.items)
          .map((it) => `${escapeHtml(it.name)}${it.color ? ` (${escapeHtml(it.color)})` : ""} ×${escapeHtml(it.quantity)}`)
          .join(", ")
      : "—";

    return { chef, totalQty, chefProbs, chefCallCount, firstIn, lastOut, totalSessionMs, itemSummary, chefProds };
  });

  // ── Totals ─────────────────────────────────────────────────────────────────
  const grandQty = operatorRows.reduce((a, r) => a + r.totalQty, 0);
  const grandProblems = problems.length;
  const activeOperators = operatorRows.filter((r) => r.chefProds.length > 0 || r.firstIn !== null).length;
  const totalCalls = calls.length;

  // ── Operator summary table rows ────────────────────────────────────────────
  const tableRows = operatorRows
    .map((r, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      const probBadge = r.chefProbs.length > 0
        ? `<span class="badge-red">${r.chefProbs.length} ⚠</span>`
        : `<span class="badge-ok">✓</span>`;
      const callBadge = r.chefCallCount > 0
        ? `<span class="badge-purple">${r.chefCallCount}×</span>`
        : "";
      return `
        <tr style="background:${bg}">
          <td class="name-cell"><b>${escapeHtml(r.chef.name)}</b></td>
          <td>${r.firstIn ? fmtTime(r.firstIn) : "—"}</td>
          <td>${r.lastOut ? fmtTime(r.lastOut) : "<i>active</i>"}</td>
          <td>${r.firstIn ? durationMin(r.totalSessionMs) : "—"}</td>
          <td class="qty-cell">${r.totalQty}</td>
          <td style="font-size:11px;max-width:220px;color:#475569">${r.itemSummary}</td>
          <td>${probBadge}${callBadge ? " " + callBadge : ""}</td>
        </tr>`;
    })
    .join("");

  // ── Objectives ─────────────────────────────────────────────────────────────
  const objectivesHtml = objectives.length
    ? `<ul class="objectives">${objectives
        .flatMap((o) => o.texts)
        .map((t) => `<li>${escapeHtml(t)}</li>`)
        .join("")}</ul>`
    : `<p class="empty-block">No objectives set.</p>`;

  // ── Problems detail section ────────────────────────────────────────────────
  const problemsHtml = problems.length
    ? `<table class="inner prob-table">
        <thead>
          <tr>
            <th>Operator</th>
            <th>Type</th>
            <th>Time</th>
            <th>Downtime</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          ${problems.map((p) => `
            <tr>
              <td>${escapeHtml(p.chefName)}</td>
              <td><span class="type-tag">${escapeHtml(p.type)}</span></td>
              <td>${fmtDateTime(p.createdAt)}</td>
              <td>${durationMin(p.resumedAt - p.stoppedAt)}</td>
              <td style="color:#475569;font-style:italic">${escapeHtml(p.note || "—")}</td>
            </tr>`).join("")}
        </tbody>
      </table>`
    : `<p class="empty-block">No problems reported.</p>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0f172a; padding: 28px 32px; margin: 0; background: #fff; font-size: 13px;
  }

  /* ── Header ── */
  .header {
    display: flex; justify-content: space-between; align-items: flex-end;
    padding-bottom: 14px; border-bottom: 3px solid #7c3aed; margin-bottom: 20px;
  }
  .brand { font-size: 22px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px; }
  .brand span { color: #7c3aed; }
  .meta { text-align: right; font-size: 12px; color: #64748b; line-height: 1.6; }
  .meta b { color: #0f172a; font-size: 14px; }

  /* ── KPI bar ── */
  .kpi-bar {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 10px; margin-bottom: 20px;
  }
  .kpi {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 12px 14px;
  }
  .kpi span { font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.6px; font-weight: 700; }
  .kpi b { display: block; font-size: 24px; color: #0f172a; margin-top: 2px; font-weight: 800; }
  .kpi.highlight b { color: #7c3aed; }

  /* ── Section headings ── */
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b;
       font-weight: 700; margin: 20px 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }

  /* ── Objectives ── */
  .objectives { margin: 0; padding: 0 0 0 20px; }
  .objectives li { margin-bottom: 5px; font-size: 13px; color: #1e293b; }

  /* ── Main operator table ── */
  .op-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .op-table thead tr { background: #1e293b; color: white; }
  .op-table th { padding: 9px 10px; text-align: left; font-weight: 700; font-size: 11px;
                 text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; }
  .op-table td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .op-table tr:last-child td { border-bottom: none; }
  .name-cell { font-weight: 700; color: #0f172a; white-space: nowrap; }
  .qty-cell { font-weight: 800; color: #7c3aed; font-size: 15px; }
  .total-row td {
    background: #f0fdf4; border-top: 2px solid #7c3aed; font-weight: 700;
    color: #0f172a; padding: 10px 10px;
  }
  .total-row .qty-cell { color: #16a34a; font-size: 17px; }

  /* ── Badges ── */
  .badge-red   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;
                 border-radius: 6px; padding: 2px 7px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .badge-ok    { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0;
                 border-radius: 6px; padding: 2px 7px; font-size: 11px; }
  .badge-purple{ background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe;
                 border-radius: 6px; padding: 2px 7px; font-size: 11px; font-weight: 700; }

  /* ── Problems table ── */
  .inner { width: 100%; border-collapse: collapse; font-size: 12px; }
  .inner th { text-align: left; padding: 8px 10px; background: #f8fafc; color: #475569;
              font-weight: 600; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
  .inner td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a; }
  .type-tag { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa;
              border-radius: 5px; padding: 1px 6px; font-size: 11px; font-weight: 600; }

  .empty-block { color: #94a3b8; font-style: italic; font-size: 13px;
                 background: #f8fafc; border-radius: 8px; padding: 10px 14px; margin: 0; }

  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0;
            font-size: 11px; color: #94a3b8; text-align: center; }

  @media print {
    body { padding: 16px; }
    .op-table { page-break-inside: auto; }
  }
</style>
</head><body>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand">Stitch<span>Track</span></div>
      <div style="font-size:12px;color:#64748b;margin-top:3px;">Daily Production Report</div>
    </div>
    <div class="meta">
      <b>${escapeHtml(bossName)}</b><br/>
      ${escapeHtml(dateStr)}<br/>
      ${bossSession
        ? `Manager: ${fmtTime(bossSession.checkInAt)} → ${fmtTime(bossSession.checkOutAt ?? undefined)}`
        : ""}
    </div>
  </div>

  <!-- KPI bar -->
  <div class="kpi-bar">
    <div class="kpi highlight"><span>Total pieces</span><b>${grandQty}</b></div>
    <div class="kpi"><span>Operators present</span><b>${activeOperators} / ${chefs.length}</b></div>
    <div class="kpi"><span>Problems</span><b>${grandProblems}</b></div>
    <div class="kpi"><span>Office calls</span><b>${totalCalls}</b></div>
  </div>

  <!-- Objectives -->
  <h2>Objectives</h2>
  ${objectivesHtml}

  <!-- Combined operator table -->
  <h2>Operator summary</h2>
  <table class="op-table">
    <thead>
      <tr>
        <th>Operator</th>
        <th>Check-in</th>
        <th>Check-out</th>
        <th>Duration</th>
        <th>Pieces</th>
        <th>Items produced</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:18px;font-style:italic">No operator data for this day.</td></tr>`}
      <tr class="total-row">
        <td colspan="4"><b>TOTAL</b></td>
        <td class="qty-cell">${grandQty}</td>
        <td style="color:#64748b;font-size:11px">${activeOperators} operator${activeOperators !== 1 ? "s" : ""} · ${chefs.length} registered</td>
        <td><span class="badge-red" style="${grandProblems === 0 ? "display:none" : ""}">${grandProblems} problem${grandProblems !== 1 ? "s" : ""}</span>${grandProblems === 0 ? '<span class="badge-ok">All clear ✓</span>' : ""}</td>
      </tr>
    </tbody>
  </table>

  <!-- Problems -->
  ${grandProblems > 0 ? `<h2>Problems (${grandProblems})</h2>${problemsHtml}` : ""}

  <div class="footer">Generated ${new Date().toLocaleString()} · StitchTrack</div>
</body></html>`;
}

export async function generateAndSharePdf(payload: ReportPayload): Promise<void> {
  const html = buildReportHtml(payload);

  if (Platform.OS === "web") {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        try { win.print(); } catch { /* ignore */ }
      }, 400);
    }
    return;
  }

  // Native: share as PDF file, fall back to print dialog
  try {
    const file = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Save daily report",
      });
      return;
    }
  } catch {
    // sharing failed — fall through to print dialog
  }

  await Print.printAsync({ html });
}
