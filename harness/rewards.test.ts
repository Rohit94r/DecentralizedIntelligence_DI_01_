/**
 * T8 (our own) — Rewards, Bug Bounty and payments keep their promises:
 *   • a solve day pays 100 points exactly once; a failing day pays nothing
 *   • where the planted bugs are never leaves the API (like hidden tests)
 *   • triage is honest: wrong place → not reproduced, right place wrong kind →
 *     needs info, right place right kind → confirmed + points, again → duplicate
 *   • a nudge halves that bug's reward; reports are rate-limited per day
 *   • money needs the wallet PIN, can't go below zero, and refunds exactly once
 *   • a company program can't mint points: owners can't report or approve
 *     themselves, and the reward pool can't be overdrawn
 *   • Razorpay: the webhook rejects bad signatures and applies a payment once;
 *     checkout verification refuses a wrong order or a forged signature
 *   • plans: Free stops at its daily limits and the beginner program; Pro (a
 *     ₹349 / $4 demo checkout) lifts them; paying again adds a month; Pro
 *     ends when the paid time runs out; Custom requests are saved
 */
import { createHmac } from "node:crypto";
import { BUILT_IN_PROGRAMS, getChallenge, plantedBugs } from "../packages/core/src/index.ts";
import { REFERENCE } from "../packages/core/src/reference.ts";
import { check, connect, isMain, printSuite, type Check, type SuiteResult } from "./lib.ts";

export async function run(): Promise<SuiteResult> {
  const t0 = Date.now();
  const api = await connect();
  const checks: Check[] = [];
  const tag = Math.random().toString(36).slice(2, 7);
  const L = (s: string) => `harness_${s}_${tag}`;

  /* ── streak points ── */
  const solver = L("streak");
  const cp = getChallenge("count-passes")!;
  await api.post("/api/submit", { learner_id: solver, challenge_id: cp.id, code: REFERENCE[cp.id] });
  const r1 = await api.get(`/api/rewards/${solver}`);
  const r2 = await api.get(`/api/rewards/${solver}`);
  check(checks, "a solve day pays 100 points", r1.body?.points?.streak === 100 && r1.body?.streak?.current === 1 && r1.body?.streak?.today_done === true, JSON.stringify(r1.body?.points));
  check(checks, "…exactly once (viewing again pays nothing)", r2.body?.points?.balance === r1.body?.points?.balance, `${r1.body?.points?.balance} → ${r2.body?.points?.balance}`);
  await api.post("/api/submit", { learner_id: solver, challenge_id: cp.id, code: REFERENCE[cp.id] });
  const r3 = await api.get(`/api/rewards/${solver}/summary`);
  check(checks, "…and a second solve the same day doesn't pay again", r3.body?.points === 100, String(r3.body?.points));
  const failer = L("fail");
  await api.post("/api/submit", { learner_id: failer, challenge_id: cp.id, code: cp.starter });
  const rf = await api.get(`/api/rewards/${failer}/summary`);
  check(checks, "a day with only failing attempts pays nothing", rf.body?.points === 0 && rf.body?.streak === 0, JSON.stringify(rf.body));

  /* ── secrecy: planted bugs never leave the API ── */
  const list = await api.get("/api/bounty/programs?viewer=" + solver);
  let leaks = 0;
  for (const p of BUILT_IN_PROGRAMS) {
    const pub = await api.get(`/api/bounty/programs/${p.id}?viewer=${L("nobody")}`);
    for (const raw of [pub.raw, list.raw]) {
      for (const b of p.bugs) {
        for (const secret of [b.id, b.title, b.nudge, b.explanation, b.fix]) {
          if (raw.includes(secret)) {
            leaks++;
            check(checks, `planted bug ${b.id} stays secret`, false, `found "${secret.slice(0, 50)}"`);
          }
        }
      }
    }
    if (pub.body?.files?.length !== p.files.length) check(checks, `${p.id} serves its code`, false, `HTTP ${pub.status}`);
  }
  check(checks, `no planted bug (id, title, nudge, explanation, fix) appears in any public response`, leaks === 0, leaks ? `${leaks} leaks` : undefined);

  /* ── triage on a Layerflow program ── */
  const hunter = L("hunter");
  const shop = BUILT_IN_PROGRAMS.find((p) => p.id === "shopkart")!;
  const bugs = plantedBugs(shop);
  const sqli = bugs.find((b) => b.id === "shopkart-sqli")!;
  const report = (over: Record<string, unknown>) =>
    api.post("/api/bounty/reports", { program_id: "shopkart", learner_id: hunter, title: "Something looks wrong here", category: "injection", severity: "critical", file: sqli.file, line: sqli.line, description: "User input reaches the SQL string, so an attacker can change the query and read other tables.", ...over });
  const wrongPlace = await report({ file: "pricing.py", line: 1 });
  check(checks, "a report at the wrong place is 'not reproduced' and pays nothing", wrongPlace.body?.outcome === "invalid" && wrongPlace.body?.report?.points === 0, JSON.stringify(wrongPlace.body?.outcome));
  const wrongKind = await report({ category: "xss" });
  check(checks, "right place, wrong kind of bug → 'needs info', no points", wrongKind.body?.outcome === "needs_info" && wrongKind.body?.report?.points === 0, wrongKind.body?.outcome);
  const before = (await api.get(`/api/rewards/${hunter}/summary`)).body?.points ?? 0;
  const good = await report({});
  check(checks, "right place + right kind → confirmed with the critical reward", good.body?.outcome === "valid" && good.body?.report?.points === shop.rewards.critical, JSON.stringify(good.body?.report?.points));
  const after = (await api.get(`/api/rewards/${hunter}/summary`)).body?.points ?? 0;
  check(checks, "…paid into the wallet (plus the streak day it earned)", after - before === shop.rewards.critical + 100, `${before} → ${after}`);
  const dup = await report({ title: "Same SQL injection again" });
  check(checks, "reporting the same bug again is a duplicate worth 0", dup.body?.outcome === "duplicate" && dup.body?.report?.points === 0, dup.body?.outcome);
  const nudge = await api.post("/api/bounty/nudge", { learner_id: hunter, program_id: "shopkart" });
  const nudged = bugs.find((b) => b.nudge === nudge.body?.nudge);
  check(checks, "a nudge is prose that never names a file or line", !!nudged && !/\.(py|ts|tsx)\b|line \d/.test(nudge.body?.nudge ?? ""), nudge.body?.nudge);
  if (nudged) {
    const half = await report({ category: nudged.category, file: nudged.file, line: nudged.line, title: "Found it after the nudge" });
    check(checks, "…and halves that bug's reward", half.body?.report?.points === Math.floor(shop.rewards[nudged.severity] / 2), `${half.body?.report?.points}`);
  }
  // rate limit: 10 per program per day
  const spammer = L("spam");
  let last = 0;
  for (let i = 0; i < 11; i++) last = (await api.post("/api/bounty/reports", { program_id: "paylite", learner_id: spammer, title: `Guess number ${i + 1} here`, category: "crash", severity: "low", file: "wallet/fees.py", line: 1, description: "Guessing lines one by one to see what the triage says about each of them." })).status;
  check(checks, "the 11th report on a program in one day is refused (429)", last === 429, `HTTP ${last}`);
  const noFile = await report({ file: "../../etc/passwd", line: 1 });
  check(checks, "a report on a file outside the program is refused", noFile.status === 400, `HTTP ${noFile.status}`);

  /* ── money: PIN, limits, refunds (manual payouts: requests wait for the admin) ── */
  const payoutsWas = process.env.LAYERFLOW_PAYOUTS;
  process.env.LAYERFLOW_PAYOUTS = "manual";
  const noPin = await api.post("/api/rewards/redeem", { learner_id: hunter, pin: "1234", kind: "cash", points: 1000, upi_id: "hunter@okaxis" });
  check(checks, "no cash-out without a wallet PIN", noPin.status === 400 && /PIN/.test(noPin.body?.error ?? ""), noPin.body?.error);
  await api.post("/api/rewards/pin", { learner_id: hunter, pin: "4826" });
  const again = await api.post("/api/rewards/pin", { learner_id: hunter, pin: "1111" });
  check(checks, "a PIN can't be silently replaced", again.status === 409, `HTTP ${again.status}`);
  const badPin = await api.post("/api/rewards/redeem", { learner_id: hunter, pin: "0000", kind: "cash", points: 1000, upi_id: "hunter@okaxis" });
  check(checks, "a wrong PIN is refused", badPin.status === 403, `HTTP ${badPin.status}`);
  const small = await api.post("/api/rewards/redeem", { learner_id: hunter, pin: "4826", kind: "cash", points: 500, upi_id: "hunter@okaxis" });
  check(checks, "cash-outs below 1,000 points are refused", small.status === 400, small.body?.error);
  const bal0 = (await api.get(`/api/rewards/${hunter}/summary`)).body?.points ?? 0;
  const huge = await api.post("/api/rewards/redeem", { learner_id: hunter, pin: "4826", kind: "cash", points: bal0 + 1000 - (bal0 % 100), upi_id: "hunter@okaxis" });
  check(checks, "you can't cash out more than you have", huge.status === 400, huge.body?.error);
  const cash = await api.post("/api/rewards/redeem", { learner_id: hunter, pin: "4826", kind: "cash", points: 1000, upi_id: "hunter@okaxis" });
  const bal1 = (await api.get(`/api/rewards/${hunter}/summary`)).body?.points ?? 0;
  check(checks, "a valid cash-out holds exactly those points", cash.status === 200 && bal1 === bal0 - 1000, `${bal0} → ${bal1}`);
  check(checks, "…and the UPI ID only ever comes back masked", !cash.raw.includes("hunter@okaxis") && /•/.test(cash.body?.redemption?.upi ?? ""), cash.body?.redemption?.upi);
  const cancel = await api.post(`/api/rewards/redemptions/${cash.body?.redemption?.id}/cancel`, { learner_id: hunter, pin: "4826" });
  const cancelTwice = await api.post(`/api/rewards/redemptions/${cash.body?.redemption?.id}/cancel`, { learner_id: hunter, pin: "4826" });
  const bal2 = (await api.get(`/api/rewards/${hunter}/summary`)).body?.points ?? 0;
  check(checks, "cancelling refunds the points exactly once", cancel.status === 200 && cancelTwice.status === 409 && bal2 === bal0, `${bal0} → ${bal1} → ${bal2}`);
  const goodieNoAddr = await api.post("/api/rewards/redeem", { learner_id: hunter, pin: "4826", kind: "goodie", item_id: "sticker-pack" });
  check(checks, "a goodie needs a delivery address", goodieNoAddr.status === 400, goodieNoAddr.body?.error);

  // demo payouts: the withdrawal completes in the app — and says plainly that no money moved
  process.env.LAYERFLOW_PAYOUTS = "demo";
  const demo = await api.post("/api/rewards/redeem", { learner_id: hunter, pin: "4826", kind: "cash", points: 1000, upi_id: "hunter@okaxis" });
  const bal3 = (await api.get(`/api/rewards/${hunter}/summary`)).body?.points ?? 0;
  check(
    checks,
    "demo payouts complete straight away, labelled as demo (DEMO reference, 'no real money')",
    demo.body?.redemption?.status === "paid" && /^DEMO/.test(demo.body?.redemption?.payout_ref ?? "") && /no real money/i.test(`${demo.body?.redemption?.note} ${demo.body?.message}`) && bal3 === bal0 - 1000,
    JSON.stringify(demo.body?.redemption ?? demo.body),
  );
  const demoCancel = await api.post(`/api/rewards/redemptions/${demo.body?.redemption?.id}/cancel`, { learner_id: hunter, pin: "4826" });
  check(checks, "…and a completed payout can't be cancelled for a refund", demoCancel.status === 409, `HTTP ${demoCancel.status}`);
  if (payoutsWas === undefined) delete process.env.LAYERFLOW_PAYOUTS;
  else process.env.LAYERFLOW_PAYOUTS = payoutsWas;

  /* ── company programs can't mint points ── */
  const owner = L("owner");
  const prog = await api.post("/api/bounty/programs", {
    owner_id: owner,
    pin: "2468",
    kind: "company",
    company: "Harness Co",
    title: "Harness test program",
    summary: "A program the harness uses to check triage permissions and the reward pool.",
    website: "https://harness.example",
    scope: ["harness.example"],
    out_of_scope: [],
    rewards: { critical: 2000, high: 1000, medium: 400, low: 100 },
    plan: "community",
    return_base: "http://localhost:3000",
  });
  check(checks, "a free Community program opens straight away", prog.status === 200 && prog.body?.status === "open", JSON.stringify(prog.body));
  const pid = prog.body?.id;
  const self = await api.post("/api/bounty/reports", { program_id: pid, learner_id: owner, title: "Reporting on my own program", category: "logic", severity: "high", description: "Trying to report a bug on my own program to earn points from it, which should be refused." });
  check(checks, "an owner can't report on their own program", self.status === 403, `HTTP ${self.status}`);
  const rep = await api.post("/api/bounty/reports", { program_id: pid, learner_id: hunter, title: "IDOR on invoices endpoint", category: "broken_access", severity: "high", description: "Changing the invoice id in the URL returns other customers' invoices with their names and addresses." });
  check(checks, "a hunter's report on a company program waits for triage", rep.body?.outcome === "triage", rep.body?.outcome);
  const stranger = await api.post(`/api/bounty/reports/${rep.body?.report?.id}/triage`, { actor_id: hunter, pin: "4826", status: "valid", final_severity: "high" });
  check(checks, "only the owner can triage (not the reporter, not a stranger)", stranger.status === 403, `HTTP ${stranger.status}`);
  const tri = await api.post(`/api/bounty/reports/${rep.body?.report?.id}/triage`, { actor_id: owner, pin: "2468", status: "valid", final_severity: "high" });
  check(checks, "a Community-plan program confirms bugs but pays no points (no pool)", tri.status === 200 && tri.body?.report?.points === 0, JSON.stringify(tri.body?.report?.points ?? tri.body));

  if (api.rt) {
    const store = api.rt.store;
    const pooled = store.createProgram({ owner_id: owner, kind: "company", company: "Pool Co", title: "Pool test", summary: "Pool cap test program for the harness suite.", repo_url: null, website: "https://pool.example", scope: ["x"], out_of_scope: [], rewards: { critical: 2000, high: 1000, medium: 400, low: 100 }, plan: "starter", points_pool: 300, status: "open" });
    const a = await api.post("/api/bounty/reports", { program_id: pooled, learner_id: hunter, title: "First bug on the pool program", category: "logic", severity: "high", description: "A long enough description of a bug so the report validator accepts it." });
    const b = await api.post("/api/bounty/reports", { program_id: pooled, learner_id: hunter, title: "Second bug on the pool program", category: "logic", severity: "high", description: "Another long enough description of a different bug for the pool test." });
    const ta = await api.post(`/api/bounty/reports/${a.body?.report?.id}/triage`, { actor_id: owner, pin: "2468", status: "valid", final_severity: "high" });
    const tb = await api.post(`/api/bounty/reports/${b.body?.report?.id}/triage`, { actor_id: owner, pin: "2468", status: "valid", final_severity: "high" });
    check(checks, "the reward pool can't be overdrawn (1,000-point bug capped to the 300 left, then 0)", ta.body?.report?.points === 300 && tb.body?.report?.points === 0 && store.program(pooled)!.points_paid === 300, `${ta.body?.report?.points} / ${tb.body?.report?.points}`);

    /* ── Razorpay webhook + checkout verification ── */
    const secret = `harness-${tag}-webhook-secret`;
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const waiting = store.createProgram({ owner_id: owner, kind: "company", company: "Paid Co", title: "Paid plan test", summary: "Waits for a Razorpay payment in the harness suite.", repo_url: null, website: "https://paid.example", scope: ["x"], out_of_scope: [], rewards: { critical: 2000, high: 1000, medium: 400, low: 100 }, plan: "starter", points_pool: 0, status: "awaiting_payment" });
    const payId = store.createPayment({ purpose: "bounty_plan", ref: waiting, sku: "bounty-plan-starter", amount_paise: 199_900, currency: "INR", provider: "razorpay" });
    store.updatePayment(payId, { session_id: "order_harness01" });
    const body = JSON.stringify({ entity: "event", event: "payment.captured", payload: { payment: { entity: { id: "pay_harness01", order_id: "order_harness01", status: "captured", amount: 199_900, currency: "INR", notes: { layerflow_payment: payId } } } } });
    const sign = (raw: string) => createHmac("sha256", secret).update(raw).digest("hex");
    const hook = (id: string, sig: string, raw = body) => api.postRaw("/api/payments/razorpay/webhook", raw, { "x-razorpay-signature": sig, "x-razorpay-event-id": id });
    const forged = await hook("evt_forged", "0".repeat(64));
    const tampered = await hook("evt_tamper", sign(body), body.replace("199900", "1"));
    check(checks, "the Razorpay webhook rejects a forged or tampered signature", forged.status === 401 && tampered.status === 401, `${forged.status} / ${tampered.status}`);
    const wrongOrder = await api.post("/api/payments/razorpay/verify", { payment: payId, razorpay_order_id: "order_someoneelse", razorpay_payment_id: "pay_harness01", razorpay_signature: "a".repeat(64) });
    const forgedSig = await api.post("/api/payments/razorpay/verify", { payment: payId, razorpay_order_id: "order_harness01", razorpay_payment_id: "pay_harness01", razorpay_signature: "b".repeat(64) });
    check(checks, "checkout verification refuses another order or a forged signature", wrongOrder.status === 400 && forgedSig.status === 400 && /signature/.test(forgedSig.body?.error ?? ""), `${wrongOrder.status} / ${forgedSig.status}`);
    check(checks, "…and the program stays closed until a real payment", store.program(waiting)!.status === "awaiting_payment");
    const ok = await hook("evt_real", sign(body));
    const replay = await hook("evt_real", sign(body));
    check(checks, "a signed payment.captured opens the program and unlocks its pool", ok.status === 200 && store.program(waiting)!.status === "open" && store.program(waiting)!.points_pool === 10_000, JSON.stringify(store.program(waiting)));
    check(checks, "…and a replayed webhook is ignored", replay.body?.duplicate === true, replay.raw.slice(0, 120));
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  }

  /* ── plans: Free limits, Pro through the (demo) checkout, Custom requests ── */
  const limitsWas = process.env.LAYERFLOW_LIMITS;
  const checkoutWas = process.env.LAYERFLOW_CHECKOUT;
  process.env.LAYERFLOW_LIMITS = "on";
  process.env.LAYERFLOW_CHECKOUT = "demo"; // the suite never opens a real checkout
  const campus = BUILT_IN_PROGRAMS.find((p) => p.difficulty !== "beginner")!;
  const shopP = BUILT_IN_PROGRAMS.find((p) => p.difficulty === "beginner")!;
  const planReport = (learner: string, p: typeof campus) => api.post("/api/bounty/reports", { program_id: p.id, learner_id: learner, title: "Harness plan-gate report", category: "logic", severity: "low", file: p.files[0].path, line: 1, description: "A long enough description so the validator accepts this report for the plan test." });

  const free = L("free");
  const analyses = [];
  for (let i = 0; i < 4; i++) analyses.push(await api.post("/api/repo/analyze", { local: true, learner_id: free }));
  check(checks, "Free: 3 Repo / Website analyses a day, then 402 with the Pro offer", analyses.slice(0, 3).every((r) => r.status === 200) && analyses[3].status === 402 && /go Pro/.test(analyses[3].body?.error ?? ""), analyses.map((r) => r.status).join(","));
  const chats = [];
  for (let i = 0; i < 21; i++) chats.push((await api.post("/api/chat", { learner_id: free, message: "What should I practise next?" })).status);
  check(checks, "Free: 20 chat messages with Priya a day, then 402", chats.slice(0, 20).every((s) => s === 200) && chats[20] === 402, chats.join(","));
  const freeCampus = await planReport(free, campus);
  const freeShop = await planReport(free, shopP);
  check(checks, `Free: ${shopP.company} takes reports, ${campus.company} asks for Pro`, freeShop.status === 200 && freeCampus.status === 402, `${freeShop.status} / ${freeCampus.status} ${freeCampus.body?.error ?? ""}`);

  const pro = L("pro");
  const co = await api.post("/api/plans/checkout", { learner_id: pro, currency: "INR" });
  const strangerPay = await api.post("/api/payments/demo/complete", { payment: co.body?.payment, owner_id: L("stranger2") });
  const paid = await api.post("/api/payments/demo/complete", { payment: co.body?.payment, owner_id: pro });
  const v1 = await api.get(`/api/plans?learner_id=${pro}`);
  const twice = await api.post("/api/payments/demo/complete", { payment: co.body?.payment, owner_id: pro });
  const v2 = await api.get(`/api/plans?learner_id=${pro}`);
  const badge = await api.get(`/api/rewards/${pro}/summary`);
  check(checks, "Pro: a ₹349 checkout switches Pro on — only for the learner who started it", co.body?.mode === "demo" && co.body?.demo_checkout?.amount === 34_900 && co.body?.demo_checkout?.currency === "INR" && strangerPay.status === 403 && paid.body?.status === "succeeded" && v1.body?.me?.plan === "pro" && badge.body?.plan === "pro", `${co.status} ${strangerPay.status} ${paid.raw.slice(0, 80)} ${v1.body?.me?.plan}`);
  check(checks, "…and completing the same checkout twice doesn't add a second month", twice.body?.status === "succeeded" && v2.body?.me?.subscription?.current_period_end === v1.body?.me?.subscription?.current_period_end, `${v1.body?.me?.subscription?.current_period_end} → ${v2.body?.me?.subscription?.current_period_end}`);
  const usd = await api.post("/api/plans/checkout", { learner_id: L("usd"), currency: "USD" });
  check(checks, "…the dollar price is $4", usd.body?.demo_checkout?.amount === 400 && usd.body?.demo_checkout?.currency === "USD", usd.raw.slice(0, 120));
  const proRuns = [];
  for (let i = 0; i < 4; i++) proRuns.push((await api.post("/api/repo/analyze", { local: true, learner_id: pro })).status);
  const proCampus = await planReport(pro, campus);
  check(checks, `Pro: no daily limit, and ${campus.company} takes the report`, proRuns.every((s) => s === 200) && proCampus.status === 200, `${proRuns.join(",")} / ${proCampus.status}`);
  const another = await api.post("/api/plans/checkout", { learner_id: pro, currency: "INR" });
  await api.post("/api/payments/demo/complete", { payment: another.body?.payment, owner_id: pro });
  const v3 = await api.get(`/api/plans?learner_id=${pro}`);
  const added = Date.parse(v3.body?.me?.subscription?.current_period_end ?? "") - Date.parse(v1.body?.me?.subscription?.current_period_end ?? "");
  check(checks, "paying again adds another month on top (prepaid, no auto-debit)", Math.abs(added - 30 * 86_400_000) < 60_000, `+${Math.round(added / 86_400_000)} days`);

  if (api.rt) {
    const sub = api.rt.store.subscription(pro)!;
    api.rt.store.saveSubscription({ ...sub, current_period_end: new Date(Date.now() - 1000).toISOString() });
    const v4 = await api.get(`/api/plans?learner_id=${pro}`);
    const after = await api.get(`/api/rewards/${pro}/summary`);
    check(checks, "Pro ends when the paid time runs out — back on Free", v4.body?.me?.plan === "free" && after.body?.plan === "free", `${v4.body?.me?.plan} / ${after.body?.plan}`);
  }

  const lead = await api.post("/api/plans/contact", { name: "Harness Teacher", email: "teacher@college.example", organisation: "Harness College", kind: "college", seats: 60, message: "Pro for one class." });
  const badLead = await api.post("/api/plans/contact", { name: "Harness Teacher", email: "not-an-email", organisation: "Harness College", kind: "college" });
  check(checks, "Custom: “Talk to us” saves the request and checks the email", lead.status === 200 && /^lead_/.test(lead.body?.id ?? "") && badLead.status === 400, `${lead.status} ${badLead.status}`);
  if (limitsWas === undefined) delete process.env.LAYERFLOW_LIMITS;
  else process.env.LAYERFLOW_LIMITS = limitsWas;
  if (checkoutWas === undefined) delete process.env.LAYERFLOW_CHECKOUT;
  else process.env.LAYERFLOW_CHECKOUT = checkoutWas;

  return {
    suite: "rewards.test.ts — T8 streak · points · bug bounty · payments",
    points: "bonus",
    checks,
    summary: `${checks.filter((c) => c.ok).length}/${checks.length} · bounty secrets ${leaks ? "LEAKED" : "safe"}`,
    ms: Date.now() - t0,
  };
}

if (isMain(import.meta.url)) {
  const r = await run();
  printSuite(r);
  await (await connect()).close();
  process.exit(r.checks.every((c) => c.ok) ? 0 : 1);
}
