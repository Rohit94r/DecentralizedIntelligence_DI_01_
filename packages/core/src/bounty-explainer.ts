/**
 * "How bug bounty works" — the narrated walkthrough on the Bug Bounty page.
 *
 * Most scenes are real screenshots of Layerflow (in apps/web/public/explainer)
 * with the part that matters zoomed in, a cursor that clicks where you would
 * click, and a short label — so it plays like a screen-recorded product video.
 * The web app voices each line with the same speaker as Mentoring (ElevenLabs
 * when the server has a key, the browser's voice otherwise) and paces the
 * scene by its narration, with captions and chapters.
 *
 * Positions are percentages of the screenshot (x, y = top-left corner).
 */

export interface ShotBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ExplainerVisual =
  | { kind: "title"; heading: string; sub: string }
  | { kind: "steps"; steps: { icon: string; label: string }[] }
  | { kind: "shot"; src: string; path: string; focus: ShotBox; click?: { x: number; y: number }; label: string }
  | { kind: "classes"; items: { icon: string; label: string; ask: string }[] }
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
    say: "Hi, I'm Priya. In about two minutes I'll show you how bug bounty works on Layerflow — and how the same steps work on real company programs.",
    visual: { kind: "title", heading: "How bug bounty works", sub: "Find a bug · report it clearly · get rewarded" },
  },
  {
    id: "what",
    chapter: "What is a bug bounty?",
    say: "A bug bounty is a deal. A company says: find a real problem in our software, tell us privately, and we'll reward you. You're paid for finding problems — not for writing features.",
    visual: {
      kind: "steps",
      steps: [
        { icon: "building", label: "A company opens a program" },
        { icon: "search", label: "You hunt inside its scope" },
        { icon: "file", label: "You report the bug privately" },
        { icon: "check", label: "They confirm and fix it" },
        { icon: "wallet", label: "You get the reward" },
      ],
    },
  },
  {
    id: "pick",
    chapter: "Pick a program",
    say: "Start on the Bug Bounty page. The practice programs are small apps with real bugs planted in them. ShopKart is the easiest, so let's open it.",
    visual: { kind: "shot", src: "/explainer/1-programs.webp", path: "/bounty", focus: { x: 20, y: 12.3, w: 78.1, h: 26.6 }, click: { x: 31.8, y: 25.4 }, label: "Practice programs — start with ShopKart" },
  },
  {
    id: "scope",
    chapter: "Read the scope",
    say: "Every program starts with its scope: what you're allowed to test, and what's off-limits. Testing outside the scope isn't hunting — it's breaking in. So read it first.",
    visual: { kind: "shot", src: "/explainer/2-scope.webp", path: "/bounty/shopkart", focus: { x: 20.1, y: 31.1, w: 77.8, h: 26.2 }, label: "In scope vs. out of scope" },
  },
  {
    id: "read",
    chapter: "Read the code like an attacker",
    say: "Now read the code like an attacker. Find where input comes in — a search box, the URL — and follow it. Here the search text goes straight into an SQL query. That's our bug, so click the line.",
    visual: { kind: "shot", src: "/explainer/3-code.webp", path: "/bounty/shopkart", focus: { x: 34.5, y: 7.1, w: 39.1, h: 57.7 }, click: { x: 45, y: 32.7 }, label: "User input glued into SQL" },
  },
  {
    id: "hunt",
    chapter: "What to look for",
    say: "These are the classic mistakes to hunt for. Text glued into a query. A page that never checks whose order it is. A login token that's read but never verified. Numbers that can go negative. Two requests racing each other. And user text that runs as code.",
    visual: {
      kind: "classes",
      items: [
        { icon: "database", label: "Injection", ask: "Does my text end up inside a query?" },
        { icon: "lock", label: "Broken access", ask: "Is this really mine?" },
        { icon: "key", label: "Broken login", ask: "Is the token actually checked?" },
        { icon: "calculator", label: "Business logic", ask: "What if it's negative, zero or huge?" },
        { icon: "zap", label: "Race condition", ask: "What if two requests arrive at once?" },
        { icon: "code", label: "XSS", ask: "Does my text run as code in the page?" },
      ],
    },
  },
  {
    id: "report",
    chapter: "Write the report",
    say: "Pick the kind of bug and the report fills itself in: a title, the exact line, and a sentence with blanks. Replace each blank with what an attacker could really do — clear and specific.",
    visual: { kind: "shot", src: "/explainer/4-report.webp", path: "/bounty/shopkart", focus: { x: 74.6, y: 7.1, w: 23, h: 52.2 }, label: "The report fills itself in" },
  },
  {
    id: "confirmed",
    chapter: "Confirmed!",
    say: "Send it. On practice programs you get an answer in seconds: the right line and the right kind of bug means it's confirmed — and the points go straight to your wallet.",
    visual: { kind: "shot", src: "/explainer/5-confirmed.webp", path: "/bounty/shopkart", focus: { x: 74.6, y: 60, w: 22.9, h: 26.9 }, label: "Confirmed — points added" },
  },
  {
    id: "rewards",
    chapter: "Your rewards",
    say: "A hundred points are worth ten rupees. On the Rewards page you can cash them out to UPI, or spend them on Layerflow goodies.",
    visual: { kind: "shot", src: "/explainer/6-rewards.webp", path: "/rewards", focus: { x: 24.5, y: 8, w: 69, h: 70 }, label: "Cash out to UPI or redeem goodies" },
  },
  {
    id: "rules",
    chapter: "Real company programs",
    say: "Real company programs, on platforms like HackerOne, follow the same steps — plus three golden rules. Never touch real users' data. Never slow down or break the service. And report privately, until they've fixed it.",
    visual: {
      kind: "rules",
      rules: [
        { icon: "user", text: "Never access or keep real users' data — test with your own accounts." },
        { icon: "server", text: "Never slow down or break the service — no flooding, no destructive tests." },
        { icon: "mail", text: "Report privately, only to the company, until they've fixed it." },
        { icon: "book", text: "Follow each program's own rules. If you're unsure, ask the program first." },
      ],
    },
  },
  {
    id: "outro",
    chapter: "Start hunting",
    say: "Start with a practice program, then try the company and open-source ones. Every bug you find makes software safer — and makes you a better engineer. Happy hunting!",
    visual: { kind: "outro", cta: ["Pick a practice program", "Read the code like an attacker", "File your first report"] },
  },
];
