/**
 * Demo Bug Bounty: an open-source program on Layerflow itself, a demo company
 * program, and a few reports from the seed learners — confirmed, pending and
 * "needs info" — so the hall of fame, My reports, the owner's triage queue and
 * the Rewards page all have something real to show. Points come only through
 * the same store calls the API uses (triage → ledger), never hand-written.
 */
import { BUILT_IN_PROGRAMS, plantedBugs, rewardFor, type BountySeverity } from "@layerflow/core";
import type { LayerflowStore } from "@layerflow/db";
import { syncStreakPoints } from "./rewards.ts";

const H = 3_600_000;

export function seedBounty(store: LayerflowStore, now = Date.now()): void {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * H).toISOString();

  store.upsertProfile({ id: "quickbite_security", display_name: "QuickBite Security", role: "student", bio: "Security team of QuickBite (a demo company).", at: at(300) });

  store.createProgram({
    owner_id: "layerflow",
    kind: "open_source",
    company: "Layerflow (open source)",
    title: "Layerflow — the app you're using",
    summary:
      "Hunt for real bugs in Layerflow itself: the Next.js web app, the Fastify API and the Python sandbox. It's open source, so you can read every line on GitHub, run it locally with npm start, and report what you find here.",
    repo_url: "https://github.com/Rohit94r/KURUKSHETRA-IMPIC",
    website: null,
    scope: ["apps/web — the Next.js web app", "apps/api — the Fastify API", "apps/runner — the sandbox that runs learner code", "packages/core and packages/db"],
    out_of_scope: ["Bugs that need a modified local copy", "Rate limiting / denial of service", "Missing security headers on localhost", "Anything in node_modules"],
    rewards: { critical: 2000, high: 1000, medium: 400, low: 150 },
    plan: "growth",
    points_pool: 30_000,
    status: "open",
    at: at(240),
  });

  const qb = store.createProgram({
    owner_id: "quickbite_security",
    kind: "company",
    company: "QuickBite (demo company)",
    title: "QuickBite — food ordering web app",
    summary:
      "QuickBite is a demo food-delivery startup listing, here to show how a company program works: scope, rules, rewards and a triage queue. Its website is a placeholder — practise the flow, then hunt for real on Layerflow's own programs.",
    repo_url: null,
    website: "https://quickbite.example",
    scope: ["quickbite.example — the customer web app", "api.quickbite.example — the REST API", "Only accounts you created yourself"],
    out_of_scope: ["The restaurant partner dashboard", "Payment provider pages", "Social engineering or phishing staff", "Denial of service"],
    rewards: { critical: 3000, high: 1500, medium: 600, low: 200 },
    plan: "starter",
    points_pool: 10_000,
    status: "open",
    at: at(120),
  });

  /** A report on a Layerflow program at the planted bug's real location, triaged like the API would. */
  const builtIn = (learner: string, programId: string, bugId: string, hoursAgo: number, text: { title: string; description: string; severity: BountySeverity }, nudged = false) => {
    const p = BUILT_IN_PROGRAMS.find((x) => x.id === programId)!;
    const bug = plantedBugs(p).find((b) => b.id === bugId)!;
    if (nudged) store.addNudge(learner, p.id, bug.id);
    const id = store.createReport({ program_id: p.id, learner_id: learner, title: text.title, category: bug.category, severity: text.severity, file: bug.file, line: bug.line, description: text.description, steps: null, impact: null, fix: null, at: at(hoursAgo) });
    const points = rewardFor(p.rewards, bug.severity, nudged);
    store.triageReport(id, { status: "valid", final_severity: bug.severity, points, note: `Confirmed: ${bug.title}.${nudged ? " Half reward — you took a nudge for this one." : ""}`, bug_id: bug.id, at: at(hoursAgo) });
  };

  builtIn("rohan", "shopkart", "shopkart-paging", 50, {
    title: "First page of products skips ten items",
    severity: "low",
    description: "page defaults to 1 but the offset is page * PAGE_SIZE, so the first request starts at row 11. The first ten products can never be seen by anyone.",
  });
  builtIn("rohan", "shopkart", "shopkart-sqli", 30, {
    title: "SQL injection in /search",
    severity: "critical",
    description: "The q parameter is pasted into the SQL with an f-string. q=' UNION SELECT email, password_hash, 1 FROM users -- returns every user's email and password hash.",
  });
  const miss = store.createReport({
    program_id: "shopkart",
    learner_id: "rohan",
    title: "Delivery fee is wrong for big carts",
    category: "logic",
    severity: "low",
    file: "pricing.py",
    line: 16,
    description: "I thought the free delivery check used the wrong comparison, but after tracing a 499 rupee cart it actually works as the README says.",
    steps: null,
    impact: null,
    fix: null,
    at: at(31),
  });
  store.triageReport(miss, { status: "invalid", note: "The triage team couldn't confirm a security or logic bug at that spot. Re-read the scope, follow the user's input through the code, and try again.", at: at(31) });

  builtIn("meera", "campusconnect", "campus-xss", 26, {
    title: "Stored XSS through the profile bio",
    severity: "high",
    description: "ProfileCard renders user.bio with dangerouslySetInnerHTML. A bio containing an img tag with an onerror handler runs script in every visitor's browser.",
  });
  builtIn("kabir", "shopkart", "shopkart-paging", 9, {
    title: "Products page 1 starts at product 11",
    severity: "medium",
    description: "With page=1 the offset is 10, so products 1 to 10 are skipped. I worked it out by hand after the nudge about where the first page starts counting.",
  }, true);

  // company program: one confirmed by the owner, one waiting in their queue
  const r1 = store.createReport({
    program_id: qb,
    learner_id: "rohan",
    title: "Order history shows other customers' orders (IDOR)",
    category: "broken_access",
    severity: "high",
    file: null,
    line: null,
    description: "GET /api/orders?user=<id> returns the orders of whatever user id you put in the query, including names and addresses. The server never checks it against the logged-in user.",
    steps: "1. Log in as test account A.\n2. Open /api/orders?user=<id of test account B>.\n3. B's orders and address are returned.",
    impact: "Any customer can read every other customer's order history and home address.",
    fix: "Ignore the user parameter and use the id from the session.",
    at: at(22),
  });
  store.triageReport(r1, { status: "valid", final_severity: "high", points: 1500, note: "Confirmed and fixed in v2.3 — thank you! +1500 points.", pool_program: qb, at: at(20) });
  store.createReport({
    program_id: qb,
    learner_id: "meera",
    title: "Coupon WELCOME50 can be applied twice",
    category: "business_logic",
    severity: "medium",
    file: null,
    line: null,
    description: "Sending the apply-coupon request twice in a row applies the 50% discount twice, so a ₹400 order costs ₹100.",
    steps: "1. Add items worth ₹400.\n2. POST /api/cart/coupon {code: WELCOME50} twice quickly.\n3. The total shows ₹100.",
    impact: "Customers can stack the same discount and pay a fraction of the price.",
    fix: "Store applied coupons on the cart and refuse a code that's already there; apply it in one transaction.",
    at: at(5),
  });

  for (const l of ["rohan", "meera", "kabir"]) syncStreakPoints(store, l);

  // a goodie that's already on its way, so the Rewards history isn't empty
  const r = store.createRedemption({
    learner_id: "rohan",
    kind: "goodie",
    item_id: "sticker-pack",
    points: 1500,
    amount_paise: 15_000,
    shipping: { name: "Rohan", phone: "9800000000", address: "Robotics Lab, Main Building", city: "Pune", pincode: "411001" },
    note: "Goodie · Bug Hunter sticker pack",
  });
  store.setRedemptionStatus(r.id, "shipped", { note: "Packed with love — arriving in 3–5 days.", payout_ref: "DTDC D41870264" });
}
