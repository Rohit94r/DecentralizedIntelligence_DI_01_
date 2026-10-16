/**
 * Services behind Bug Bounty.
 *
 *   • Layerflow's programs (static code in @layerflow/core) are triaged
 *     instantly: right line + right kind of bug = confirmed, points paid.
 *     Where the bugs are never leaves this process.
 *   • Company / open-source programs are triaged by their owner (with their
 *     wallet PIN) or by an admin, and only pay points from the pool their plan
 *     unlocked. Owners can't report on — or approve reports for — themselves.
 *   • Paid plans go through Dodo Payments' hosted checkout; the program opens
 *     when Dodo confirms the payment (webhook, or a status check on return).
 */
import {
  BOUNTY_EXPLAINER,
  BOUNTY_PLANS,
  BUILT_IN_PROGRAMS,
  CATEGORIES,
  HUNTING_CHECKLIST,
  REPORTS_PER_DAY,
  SEVERITIES,
  SEVERITY_RANK,
  builtInProgram,
  getPlan,
  plantedBugs,
  publicBuiltIn,
  rewardFor,
  rupees,
  triageBuiltIn,
  validateProgram,
  validateReport,
  type BountySeverity,
  type BuiltInProgram,
  type ProgramInput,
  type ReportInput,
} from "@layerflow/core";
import type { LayerflowStore, ProgramRow, ReportRow, ReportStatus } from "@layerflow/db";
import { parseJsonReply, type Ai } from "./lib/ai.ts";
import { DodoError, configuredProduct, createCheckout, createProduct, dodoConfig, getPayment, paymentsEnabled, type DodoPayment } from "./lib/dodo.ts";
import { displayName } from "./learning.ts";
import { checkPin, setPin, syncStreakPoints, todayStartIso as TODAY_START } from "./rewards.ts";

export interface BountyCtx {
  store: LayerflowStore;
  ai: Ai | null;
  log?: (s: string) => void;
}

function err(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

/* ───────────────────────── reading ───────────────────────── */

function publicReport(r: ReportRow, opts: { withBody?: boolean } = {}) {
  return {
    id: r.id,
    program_id: r.program_id,
    learner_id: r.learner_id,
    title: r.title,
    category: r.category,
    severity: r.severity,
    final_severity: r.final_severity,
    file: r.file,
    line: r.line,
    status: r.status,
    points: r.points,
    triage_note: r.triage_note,
    created_at: r.created_at,
    triaged_at: r.triaged_at,
    ...(opts.withBody ? { description: r.description, steps: r.steps, impact: r.impact, fix: r.fix } : {}),
  };
}

/** Brand marks for the seeded programs; a program posted from the form shows its initial instead. */
const HOSTED_LOGO: Record<string, string> = { layerflow: "/brands/layerflow.svg", quickbite_security: "/brands/quickbite.svg" };

function companyView(store: LayerflowStore, p: ProgramRow) {
  const reports = store.reports({ program_id: p.id, limit: 1000 });
  const plan = getPlan(p.plan);
  return {
    id: p.id,
    kind: p.kind,
    company: p.company,
    logo: HOSTED_LOGO[p.owner_id] ?? null,
    title: p.title,
    tagline: p.summary.split(/(?<=[.!?])\s/)[0],
    summary: p.summary,
    owner_id: p.owner_id,
    owner_name: displayName(store, p.owner_id),
    repo_url: p.repo_url,
    website: p.website,
    scope: p.scope,
    out_of_scope: p.out_of_scope,
    rewards: p.rewards,
    plan: p.plan,
    plan_name: plan?.name ?? p.plan,
    points_pool: p.points_pool,
    points_left: p.points_pool - p.points_paid,
    pays_points: p.points_pool - p.points_paid > 0,
    status: p.status,
    created_at: p.created_at,
    stats: { reports: reports.length, valid: reports.filter((r) => r.status === "valid").length, hunters: new Set(reports.map((r) => r.learner_id)).size },
  };
}

function builtInStats(store: LayerflowStore, p: BuiltInProgram, viewer: string) {
  const reports = store.reports({ program_id: p.id, limit: 1000 });
  return {
    reports: reports.length,
    valid: reports.filter((r) => r.status === "valid").length,
    hunters: new Set(reports.map((r) => r.learner_id)).size,
    found_by_you: viewer ? store.validBugIds(viewer, p.id).size : 0,
  };
}

export function listPrograms(store: LayerflowStore, viewer = "") {
  const builtIn = BUILT_IN_PROGRAMS.map((p) => {
    const { files, ...rest } = publicBuiltIn(p);
    return { ...rest, file_count: files.length, stats: builtInStats(store, p, viewer) };
  });
  const others = store
    .programs()
    .filter((p) => p.status !== "awaiting_payment" || p.owner_id === viewer)
    .map((p) => companyView(store, p))
    .sort((a, b) => Number(b.plan === "growth") - Number(a.plan === "growth") || Number(b.pays_points) - Number(a.pays_points) || b.created_at.localeCompare(a.created_at));
  return {
    platform: builtIn,
    company: others.filter((p) => p.kind === "company"),
    open_source: others.filter((p) => p.kind === "open_source"),
    stats: { ...store.bountyStats(), programs: builtIn.length + others.filter((p) => p.status === "open").length, inr_paid: rupees(store.bountyStats().points_paid) },
    board: store.bountyBoard(10).map((b) => ({ ...b, name: displayName(store, b.learner_id), inr: rupees(b.points), signal: b.reports ? Math.round((b.valid / b.reports) * 100) : 0 })),
    plans: BOUNTY_PLANS,
    categories: CATEGORIES,
    severities: SEVERITIES,
    payments_enabled: paymentsEnabled(),
    payments_mode: paymentsEnabled() ? dodoConfig().mode : null,
  };
}

function programBoard(store: LayerflowStore, programId: string) {
  const by = new Map<string, { valid: number; points: number }>();
  for (const r of store.reports({ program_id: programId, status: "valid", limit: 1000 })) {
    const x = by.get(r.learner_id) ?? { valid: 0, points: 0 };
    x.valid++;
    x.points += r.points;
    by.set(r.learner_id, x);
  }
  return [...by.entries()]
    .map(([id, x]) => ({ learner_id: id, name: displayName(store, id), ...x }))
    .sort((a, b) => b.points - a.points || b.valid - a.valid)
    .slice(0, 8);
}

export function getProgram(store: LayerflowStore, id: string, viewer = "") {
  const b = builtInProgram(id);
  if (b) {
    const found = viewer ? store.validBugIds(viewer, b.id) : new Set<string>();
    const nudged = viewer ? new Set(store.nudges(viewer, b.id)) : new Set<string>();
    const bugs = plantedBugs(b);
    const mine = viewer ? store.reports({ program_id: b.id, learner_id: viewer, limit: 200 }) : [];
    return {
      ...publicBuiltIn(b),
      stats: builtInStats(store, b, viewer),
      board: programBoard(store, b.id),
      checklist: HUNTING_CHECKLIST,
      categories: CATEGORIES,
      severities: SEVERITIES,
      // only bugs THIS viewer has confirmed are revealed — with where they were
      found: bugs
        .filter((x) => found.has(x.id))
        .map((x) => ({ id: x.id, title: x.title, severity: x.severity, category: x.category, file: x.file, line: x.line, explanation: x.explanation, fix: x.fix, points: mine.find((r) => r.bug_id === x.id && r.status === "valid")?.points ?? 0 })),
      nudges_taken: [...nudged].filter((n) => !found.has(n)).length,
      my_reports: mine.map((r) => publicReport(r)),
      reports_left_today: viewer ? Math.max(0, REPORTS_PER_DAY - store.reportCountSince(viewer, b.id, TODAY_START())) : REPORTS_PER_DAY,
      is_owner: false,
    };
  }
  const p = store.program(id);
  if (!p) throw err("No such program.", 404);
  const owner = !!viewer && p.owner_id === viewer;
  if (p.status === "awaiting_payment" && !owner) throw err("No such program.", 404);
  const mine = viewer ? store.reports({ program_id: p.id, learner_id: viewer, limit: 200 }) : [];
  return {
    ...companyView(store, p),
    board: programBoard(store, p.id),
    checklist: HUNTING_CHECKLIST,
    categories: CATEGORIES,
    severities: SEVERITIES,
    my_reports: mine.map((r) => publicReport(r, { withBody: true })),
    reports_left_today: viewer ? Math.max(0, REPORTS_PER_DAY - store.reportCountSince(viewer, p.id, TODAY_START())) : REPORTS_PER_DAY,
    is_owner: owner,
    // the owner's triage queue: every report, newest first, with the full write-up
    queue: owner ? store.reports({ program_id: p.id, limit: 500 }).map((r) => ({ ...publicReport(r, { withBody: true }), reporter_name: displayName(store, r.learner_id) })) : [],
    payments: owner ? store.paymentsFor(p.id).map((x) => ({ id: x.id, status: x.status, amount: inr(x.amount_paise), checkout_url: x.status === "pending" ? x.checkout_url : null, created_at: x.created_at })) : [],
    payments_enabled: paymentsEnabled(),
  };
}

export function myReports(store: LayerflowStore, learnerId: string) {
  return store.reports({ learner_id: learnerId, limit: 300 }).map((r) => {
    const b = builtInProgram(r.program_id);
    return { ...publicReport(r), program_title: b?.title ?? store.program(r.program_id)?.title ?? r.program_id, company: b?.company ?? store.program(r.program_id)?.company ?? "" };
  });
}

/* ───────────────────────── reporting ───────────────────────── */

export function fileReport(ctx: BountyCtx, b: ReportInput & { program_id: string; learner_id: string }) {
  const { store } = ctx;
  const built = builtInProgram(b.program_id);
  const company = built ? null : store.program(b.program_id);
  if (!built && !company) throw err("No such program.", 404);
  if (company && company.status !== "open") throw err("This program isn't taking reports right now.", 409);
  if (company && company.owner_id === b.learner_id) throw err("You can't report bugs on your own program.", 403);
  const problem = validateReport(b, !!built);
  if (problem) throw err(problem, 400);
  if (built && !built.files.some((f) => f.path === b.file)) throw err("That file isn't part of this program.", 400);
  const used = store.reportCountSince(b.learner_id, b.program_id, TODAY_START());
  if (used >= REPORTS_PER_DAY) throw err(`That's ${REPORTS_PER_DAY} reports on this program today — come back tomorrow. Real programs reward careful reports, not guesses.`, 429);

  const id = store.createReport({
    program_id: b.program_id,
    learner_id: b.learner_id,
    title: b.title.trim(),
    category: b.category,
    severity: b.severity,
    file: b.file ?? null,
    line: b.line ?? null,
    description: b.description.trim(),
    steps: b.steps?.trim() || null,
    impact: b.impact?.trim() || null,
    fix: b.fix?.trim() || null,
  });

  if (!built) return { report: publicReport(store.report(id)!), outcome: "triage" as const, message: `Sent to ${company!.company}. They'll triage it — you'll see the result in “My reports”.` };

  const t = triageBuiltIn(built, { file: b.file, line: b.line, category: b.category });
  if (t.status !== "valid") {
    const r = store.triageReport(id, { status: t.status, note: t.message });
    return { report: publicReport(r), outcome: t.status, message: t.message };
  }
  if (store.validBugIds(b.learner_id, built.id).has(t.bug.id)) {
    const r = store.triageReport(id, { status: "duplicate", final_severity: t.bug.severity, note: "You've already reported this bug — nice consistency though!", bug_id: t.bug.id });
    return { report: publicReport(r), outcome: "duplicate" as const, message: r.triage_note! };
  }
  const nudged = store.nudges(b.learner_id, built.id).includes(t.bug.id);
  const points = rewardFor(built.rewards, t.bug.severity, nudged);
  const sevNote = t.bug.severity !== b.severity ? ` Triage rated it ${t.bug.severity} (you said ${b.severity}).` : "";
  const r = store.triageReport(id, { status: "valid", final_severity: t.bug.severity, points, note: `Confirmed: ${t.bug.title}.${sevNote}${nudged ? " Half reward — you took a nudge for this one." : ""}`, bug_id: t.bug.id });
  syncStreakPoints(store, b.learner_id);
  return {
    report: publicReport(r),
    outcome: "valid" as const,
    message: `Confirmed! +${points.toLocaleString("en-IN")} points (${rupees(points)}).`,
    bug: { id: t.bug.id, title: t.bug.title, severity: t.bug.severity, category: t.bug.category, file: t.bug.file, line: t.bug.line, explanation: t.bug.explanation, fix: t.bug.fix, points },
    remaining: built.bugs.length - store.validBugIds(b.learner_id, built.id).size,
  };
}

/** A prose nudge toward the easiest bug you haven't found. Costs half of that bug's reward. */
export function nudge(store: LayerflowStore, learnerId: string, programId: string) {
  const b = builtInProgram(programId);
  if (!b) throw err("Nudges are only for Layerflow's programs.", 400);
  const found = store.validBugIds(learnerId, b.id);
  const taken = store.nudges(learnerId, b.id);
  const open = b.bugs.filter((x) => !found.has(x.id)).sort((x, y) => SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity]);
  if (!open.length) return { nudge: "You've found every bug in this program — try another one!", severity: null, cost: 0, all_found: true };
  // repeat the nudge you already paid for before charging for a new one
  const bug = open.find((x) => taken.includes(x.id)) ?? open[0];
  const fresh = !taken.includes(bug.id);
  store.addNudge(learnerId, b.id, bug.id);
  return {
    nudge: bug.nudge,
    severity: bug.severity,
    cost: fresh ? Math.ceil(b.rewards[bug.severity] / 2) : 0,
    message: fresh ? `This nudge points at a ${bug.severity} bug — finding it now pays half (${Math.floor(b.rewards[bug.severity] / 2)} points).` : "Same nudge as before — no extra cost.",
    all_found: false,
  };
}

/* ───────────────────────── company programs ───────────────────────── */

export interface CreateProgramBody extends ProgramInput {
  pin: string;
  return_base?: string;
}

function safeBase(u: string | undefined): string | null {
  if (!u) return null;
  try {
    const x = new URL(u);
    return /^https?:$/.test(x.protocol) ? x.origin : null;
  } catch {
    return null;
  }
}

export async function createProgram(ctx: BountyCtx, b: CreateProgramBody) {
  const { store } = ctx;
  const input: ProgramInput = {
    owner_id: b.owner_id,
    kind: b.kind,
    company: (b.company ?? "").trim(),
    title: (b.title ?? "").trim(),
    summary: (b.summary ?? "").trim(),
    repo_url: b.repo_url?.trim() || null,
    website: b.website?.trim() || null,
    scope: (b.scope ?? []).map((s) => s.trim()).filter(Boolean),
    out_of_scope: (b.out_of_scope ?? []).map((s) => s.trim()).filter(Boolean),
    rewards: b.rewards,
    plan: b.plan,
  };
  const problem = validateProgram(input);
  if (problem) throw err(problem, 400);
  const plan = getPlan(input.plan)!;
  if (plan.price_inr > 0 && !paymentsEnabled()) throw err("Paid plans need payments to be set up on this server (DODO_PAYMENTS_API_KEY). Choose the Community plan for now.", 503);
  // the owner's PIN protects triage — it's where points get paid out
  if (!store.walletPin(input.owner_id)) setPin(store, input.owner_id, b.pin);
  else checkPin(store, input.owner_id, b.pin);

  const id = store.createProgram({ ...input, repo_url: input.repo_url ?? null, website: input.website ?? null, points_pool: 0, status: plan.price_inr > 0 ? "awaiting_payment" : "open" });
  if (plan.price_inr === 0) return { id, status: "open" as const, checkout_url: null };
  const base = safeBase(b.return_base);
  if (!base) throw err("Missing return address for the checkout.", 400);
  const checkout = await startPlanCheckout(ctx, id, plan.id, base);
  return { id, status: "awaiting_payment" as const, checkout_url: checkout.checkout_url };
}

async function planProduct(store: LayerflowStore, planId: string): Promise<string> {
  const plan = getPlan(planId)!;
  const fromEnv = configuredProduct(plan.id);
  if (fromEnv) return fromEnv;
  const sku = `bounty-plan-${plan.id}`;
  const mode = dodoConfig().mode;
  const cached = store.dodoProduct(sku, mode);
  if (cached) return cached;
  if (mode === "live_mode")
    throw new DodoError(
      `For live payments, create a one-time INR product for the ${plan.name} plan (₹${plan.price_inr.toLocaleString("en-IN")}) in your Dodo dashboard and put its id in .env as DODO_PRODUCT_BOUNTY_${plan.id.toUpperCase()}=pdt_… — Layerflow only creates products by itself in test mode.`,
      503,
    );
  const productId = await createProduct({
    name: `Layerflow Bug Bounty — ${plan.name} plan`,
    description: `Host a bug-bounty program on Layerflow: ${plan.perks.join(" · ")}`,
    price_paise: plan.price_inr * 100,
    sku,
  });
  store.saveDodoProduct(sku, mode, productId);
  return productId;
}

export async function startPlanCheckout(ctx: BountyCtx, programId: string, planId: string, base: string) {
  const { store } = ctx;
  const plan = getPlan(planId)!;
  const productId = await planProduct(store, plan.id);
  const payId = store.createPayment({ purpose: "bounty_plan", ref: programId, sku: `bounty-plan-${plan.id}`, amount_paise: plan.price_inr * 100 });
  try {
    const c = await createCheckout({
      product_id: productId,
      return_url: `${base}/bounty/${programId}?payment=${payId}`,
      cancel_url: `${base}/bounty/${programId}?payment=${payId}&cancelled=1`,
      metadata: { layerflow_payment: payId, purpose: "bounty_plan", program_id: programId, plan: plan.id },
    });
    store.updatePayment(payId, { session_id: c.session_id, checkout_url: c.checkout_url });
    ctx.log?.(`[payments] checkout ${c.session_id} for ${programId} (${plan.name}, ₹${plan.price_inr})`);
    return { payment: payId, checkout_url: c.checkout_url };
  } catch (e) {
    store.updatePayment(payId, { status: "failed" });
    throw e;
  }
}

export async function retryCheckout(ctx: BountyCtx, programId: string, ownerId: string, pin: string, base: string | undefined) {
  const p = ctx.store.program(programId);
  if (!p || p.owner_id !== ownerId) throw err("No such program.", 404);
  if (p.status !== "awaiting_payment") throw err("This program is already paid for.", 409);
  checkPin(ctx.store, ownerId, pin);
  const b = safeBase(base);
  if (!b) throw err("Missing return address for the checkout.", 400);
  return startPlanCheckout(ctx, p.id, p.plan, b);
}

/** Applies a confirmed Dodo payment. Idempotent — the webhook and the return page may both call it. */
export function applyPayment(ctx: BountyCtx, ourId: string, dodo: Pick<DodoPayment, "payment_id" | "status" | "total_amount" | "currency">) {
  const { store } = ctx;
  const pay = store.payment(ourId);
  if (!pay) return { ok: false, reason: "unknown payment" };
  const status = dodo.status === "succeeded" ? "succeeded" : dodo.status === "failed" ? "failed" : dodo.status === "cancelled" ? "cancelled" : "pending";
  if (status === "succeeded" && (dodo.currency !== "INR" || dodo.total_amount < pay.amount_paise)) {
    ctx.log?.(`[payments] ${ourId}: amount mismatch (${dodo.total_amount} ${dodo.currency}) — not applied`);
    return { ok: false, reason: "amount mismatch" };
  }
  store.updatePayment(ourId, { payment_id: dodo.payment_id, status });
  if (status === "succeeded" && pay.purpose === "bounty_plan") {
    const plan = getPlan(pay.sku.replace("bounty-plan-", ""));
    if (plan) store.activateProgram(pay.ref, plan.points_pool);
    ctx.log?.(`[payments] ${ourId} succeeded → program ${pay.ref} is open`);
  }
  return { ok: true, status };
}

/** The return page asks us to check with Dodo directly (in case the webhook hasn't arrived). */
export async function syncPayment(ctx: BountyCtx, ourId: string, dodoPaymentId: string) {
  const pay = ctx.store.payment(ourId);
  if (!pay) throw err("No such payment.", 404);
  if (pay.status === "succeeded") return { status: "succeeded" };
  const dodo = await getPayment(dodoPaymentId);
  if (String(dodo.metadata?.layerflow_payment ?? "") !== ourId) throw err("That payment belongs to a different checkout.", 400);
  const r = applyPayment(ctx, ourId, dodo);
  return { status: r.ok ? r.status : "failed" };
}

export function handleWebhook(ctx: BountyCtx, event: { type?: string; data?: Partial<DodoPayment> & { payload_type?: string } }) {
  const d = event.data;
  if (!d || d.payload_type !== "Payment" || !d.payment_id) return { ok: true, ignored: true };
  const ourId = String(d.metadata?.layerflow_payment ?? "");
  if (!ourId) return { ok: true, ignored: true };
  return applyPayment(ctx, ourId, { payment_id: d.payment_id, status: d.status ?? null, total_amount: Number(d.total_amount ?? 0), currency: String(d.currency ?? "") });
}

/* ───────────────────────── triage (company programs) ───────────────────────── */

export function triage(ctx: BountyCtx, reportId: string, b: { actor_id?: string; pin?: string; admin?: boolean; status: ReportStatus; final_severity?: BountySeverity; note?: string }) {
  const { store } = ctx;
  const r = store.report(reportId);
  if (!r) throw err("No such report.", 404);
  const p = store.program(r.program_id);
  if (!p) throw err("Layerflow's own programs are triaged automatically.", 400);
  if (!b.admin) {
    if (!b.actor_id || b.actor_id !== p.owner_id) throw err("Only the program's owner can triage its reports.", 403);
    if (b.actor_id === r.learner_id) throw err("You can't triage your own report.", 403);
    checkPin(store, b.actor_id, b.pin);
  }
  if (r.status !== "triage" && r.status !== "needs_info") throw err(`This report is already ${r.status}.`, 409);
  if (!["valid", "duplicate", "needs_info", "invalid"].includes(b.status)) throw err("Choose valid, duplicate, needs info or invalid.", 400);
  if (b.status === "valid" && !b.final_severity) throw err("Pick the severity you confirmed.", 400);
  const sev = b.final_severity ?? null;
  let points = 0;
  if (b.status === "valid" && sev) {
    const left = p.points_pool - p.points_paid;
    points = Math.min(p.rewards[sev] ?? 0, Math.max(0, left));
  }
  const note = b.note?.trim() || (b.status === "valid" ? (points ? `Confirmed — thank you! +${points} points.` : "Confirmed — thank you! (This program's plan pays reputation, not points.)") : null);
  const out = store.triageReport(reportId, { status: b.status, final_severity: sev, points, note, pool_program: points ? p.id : null });
  if (b.status === "valid") syncStreakPoints(store, r.learner_id);
  return { report: publicReport(out, { withBody: true }) };
}

/* ───────────────────────── the explainer ───────────────────────── */

const LANG_NAME: Record<string, string> = { hi: "Hindi (Devanagari script)", mr: "Marathi (Devanagari script)" };
const translated = new Map<string, string[]>();

/** The narrated explainer — translated by the AI provider when one is configured (cached per language). */
export async function explainer(ctx: BountyCtx, lang = "en") {
  const scenes = BOUNTY_EXPLAINER;
  if (!LANG_NAME[lang] || !ctx.ai) return { lang: "en", scenes };
  let says = translated.get(lang);
  if (!says) {
    const out = await ctx.ai.complete(
      [
        {
          role: "system",
          content: `Translate each string into natural, warm, spoken ${LANG_NAME[lang]} for a friendly teacher. Keep numbers, ₹ amounts and names like HackerOne, Bugcrowd, SQL, XSS and Layerflow exactly as written. Reply with JSON only: {"t": ["...", "..."]} in the same order.`,
        },
        { role: "user", content: JSON.stringify(scenes.map((s) => s.say)) },
      ],
      { maxTokens: 3000, temperature: 0.3, json: true, timeoutMs: 30_000 },
    );
    const t = out ? parseJsonReply<{ t: string[] }>(out.text)?.t : null;
    if (!t || t.length !== scenes.length || t.some((x) => typeof x !== "string" || !x.trim())) return { lang: "en", scenes };
    says = t.map((x) => x.trim());
    translated.set(lang, says);
  }
  return { lang, scenes: scenes.map((s, i) => ({ ...s, say: says![i] })) };
}

export { DodoError };
