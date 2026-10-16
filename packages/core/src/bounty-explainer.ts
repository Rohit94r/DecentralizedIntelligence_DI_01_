/**
 * "How bug bounty works" — the narrated explainer on the Bug Bounty page.
 *
 * Each scene is one line Priya says plus a visual the player animates. The
 * web app voices it with the same speaker as Mentoring (ElevenLabs when the
 * server has a key, the browser's voice otherwise) and paces the scene by the
 * narration, so it plays like a short video with captions and chapters.
 */

export type ExplainerVisual =
  | { kind: "title"; heading: string; sub: string }
  | { kind: "flow"; steps: { icon: string; label: string }[] }
  | { kind: "scope"; inside: string[]; outside: string[] }
  | { kind: "recon"; tree: string[]; focus: string; to: string }
  | { kind: "classes"; items: { icon: string; label: string; ask: string }[] }
  | { kind: "prove"; code: string[]; line: number; note: string }
  | { kind: "report"; fields: { label: string; value: string }[] }
  | { kind: "reward"; rows: { severity: string; points: number; color: string }[]; rate: string }
  | { kind: "rules"; rules: { icon: string; text: string }[] }
  | { kind: "outro"; cta: string[] };

export interface ExplainerScene {
  id: string;
  chapter: string;
  say: string;
  visual: ExplainerVisual;
}

export const BOUNTY_EXPLAINER: ExplainerScene[] = [
  {
    id: "intro",
    chapter: "Welcome",
    say: "Hi, I'm Priya. In the next three minutes you'll learn how bug bounty hunting works — first right here on Layerflow, then in real companies' programs.",
    visual: { kind: "title", heading: "Bug bounty, explained", sub: "Find real bugs · report them well · get rewarded" },
  },
  {
    id: "what",
    chapter: "What is a bug bounty?",
    say: "A bug bounty is a deal. A company says: find a real problem in our software, tell us privately, and we'll reward you. Thousands of companies run them, from startups to banks. You're rewarded for finding problems — not for writing features.",
    visual: {
      kind: "flow",
      steps: [
        { icon: "🏢", label: "Company opens a program" },
        { icon: "🕵️", label: "You hunt inside the scope" },
        { icon: "📝", label: "You report it privately" },
        { icon: "✅", label: "They confirm & fix it" },
        { icon: "🏆", label: "You get the reward" },
      ],
    },
  },
  {
    id: "scope",
    chapter: "Read the scope",
    say: "Every program starts with its scope: exactly which apps, files or websites you may test, and what is off-limits. Testing outside the scope isn't hunting — it's breaking in. Always read the scope and the rules first.",
    visual: {
      kind: "scope",
      inside: ["app.py — every route", "auth.py — login and tokens", "Your own test accounts"],
      outside: ["Other customers' real data", "Flooding the servers", "Anything not listed"],
    },
  },
  {
    id: "recon",
    chapter: "Map the target",
    say: "Next, map the target. On Layerflow you get the code. Open the files and find where input comes in — routes, forms, URL parameters. Then follow that input to where it's used: the database, money, or other people's data.",
    visual: { kind: "recon", tree: ["app.py", "auth.py", "pricing.py", "db.py"], focus: "GET /search?q=…", to: "db.query(…)" },
  },
  {
    id: "hunt",
    chapter: "Hunt the classics",
    say: "Now hunt for the classic mistakes. Input glued into SQL. An order page that never checks whose order it is. A quantity that can go negative. A login token that's read but never verified. Keep asking: what if I'm not who they expect? What if this number is zero, negative or huge? What if two requests arrive at once?",
    visual: {
      kind: "classes",
      items: [
        { icon: "💉", label: "Injection", ask: "Does my text end up inside a query?" },
        { icon: "🔓", label: "Broken access", ask: "Is this actually mine?" },
        { icon: "🪪", label: "Broken auth", ask: "Is the token really checked?" },
        { icon: "🧮", label: "Business logic", ask: "What if it's negative or huge?" },
        { icon: "⚡", label: "Race condition", ask: "What if two requests race?" },
        { icon: "🧨", label: "XSS", ask: "Does my text run as code?" },
      ],
    },
  },
  {
    id: "prove",
    chapter: "Prove it safely",
    say: "Found something? Prove it without hurting anyone. Find the smallest steps that trigger it, and explain the impact — what an attacker could really do. On Layerflow, you click the line, pick the kind of bug, and describe the impact.",
    visual: {
      kind: "prove",
      code: ['@app.get("/search")', "def search():", '    q = request.args.get("q", "")', "    rows = db.query(f\"SELECT … LIKE '%{q}%'\")", "    return jsonify(results=rows)"],
      line: 4,
      note: "q = ' UNION SELECT email, password_hash … --",
    },
  },
  {
    id: "report",
    chapter: "Write the report",
    say: "A great report has a clear title, the exact location, steps to reproduce, the impact, and a suggested fix. Keep it short, specific and polite. Triage teams read hundreds of reports — make yours easy to say yes to.",
    visual: {
      kind: "report",
      fields: [
        { label: "Title", value: "SQL injection in product search" },
        { label: "Where", value: "app.py · line 32" },
        { label: "Steps", value: "1. GET /search?q=' UNION SELECT …  2. Read the response" },
        { label: "Impact", value: "Any visitor can dump every user's email and password hash." },
        { label: "Fix", value: "Use a ? placeholder and pass q as a parameter." },
      ],
    },
  },
  {
    id: "reward",
    chapter: "Triage & rewards",
    say: "When the bug is confirmed, you earn points by severity: critical, high, medium or low. On Layerflow, a hundred points are worth ten rupees, and you can cash them out or spend them on goodies. Stuck? Take a nudge — but it halves that bug's reward.",
    visual: {
      kind: "reward",
      rows: [
        { severity: "Critical", points: 1000, color: "#b42318" },
        { severity: "High", points: 600, color: "#c64e27" },
        { severity: "Medium", points: 300, color: "#f59e0b" },
        { severity: "Low", points: 120, color: "#0586d2" },
      ],
      rate: "100 points = ₹10",
    },
  },
  {
    id: "enterprise",
    chapter: "Real company programs",
    say: "Real company programs, on platforms like HackerOne or Bugcrowd, follow the same steps, plus three golden rules. Never touch real users' data. Never disrupt the service. And disclose responsibly — tell only the company, and wait until they've fixed it.",
    visual: {
      kind: "rules",
      rules: [
        { icon: "🙅", text: "Never access or keep real users' data — use your own test accounts." },
        { icon: "🐢", text: "Never slow down or break the service — no flooding, no destructive tests." },
        { icon: "🤫", text: "Disclose responsibly — only to the company, until they've fixed it." },
        { icon: "📜", text: "Follow each program's own rules. If unsure, ask the program first." },
      ],
    },
  },
  {
    id: "outro",
    chapter: "Start hunting",
    say: "Start with a Layerflow program, then try the company and open-source ones. Every bug you find makes software safer — and makes you a better engineer. Happy hunting!",
    visual: { kind: "outro", cta: ["Pick a program below", "Read the code like an attacker", "File your first report"] },
  },
];
