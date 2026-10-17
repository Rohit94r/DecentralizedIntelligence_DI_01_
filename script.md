# Layerflow: 1:30 product video script

**Goal:** explain Layerflow simply to the organisers and the jury. The same video goes on the landing page, just below the hero.
**Length:** 1 min 30 s · **Voiceover:** about 210 words (a calm 145–150 words a minute leaves room to breathe)
**Format:** you on camera for the opening and the close, screen recordings in the middle
**Tone:** simple, friendly, confident. Talk like you're explaining it to a junior, not pitching to investors.

> **The one idea the viewer must remember:** other tools *give* you the answer. Layerflow helps you *find* it. **"We point, you fix."**

---

## Before you record (10 minutes of setup saves an hour of editing)

1. Run `npm start` and open `http://localhost:3000/judges`, then click **Reset**. The demo data is now fresh.
2. Browser at **1440 × 900** with zoom at **110 %**. Hide the bookmarks bar, close other tabs, switch to light mode.
3. Two demo learners:
   - **yash**: a first visit, used for the coding demo.
   - **riya**: a learner whose mistakes keep coming back, used for Mentoring and the Dashboard.
4. Turn your laptop volume on: Priya's voice (ElevenLabs) sounds great in the background.
5. Record each scene as its **own clip** (OBS or the Windows Game Bar). It's much easier to cut.
6. Record the voiceover **separately** in a quiet room, phone close to your mouth. Then lay it over the clips.

---

## The script

| Time | On screen (what to record) | Voiceover (say exactly this) | On-screen text (for muted autoplay) |
|---|---|---|---|
| **0:00 – 0:07** | **You on camera**, laptop beside you. Cut in a 1-second screen shot of someone copying an AI answer. | "Every beginner has done this: stuck on a bug, ask AI, copy the answer… it passes. And next week? The same bug, all over again." | **Stuck → Ask AI → Copy → Same bug again** |
| **0:07 – 0:13** | You on camera, then the Layerflow landing page fades in (hero: *"Find the bug. Keep the skill."*). | "The problem isn't that answers are hard to find. It's that they come too fast. So we built **Layerflow**." | **Layerflow: find the bug, keep the skill** |
| **0:13 – 0:30** | Open `/challenge/last-k-total?learner=yash&fresh=1`. Press **Submit** on the starter code. Zoom into the results: the hidden-test chips, then **"What happened"**, then the yellow **Line Map** box pointing at line 3. | "You write Python and press Submit. Layerflow runs it safely and tells you, in plain words, what went wrong: *three hidden tests fail when k is bigger than the list*. It never shows you the hidden tests, but it points at the exact line to look at." | **Runs your code safely** · **Explains in plain words** · **Never reveals hidden tests** · **Points to the exact line** |
| **0:30 – 0:40** | Click **Get a hint** twice; the rungs light up. Then click **"just tell me the answer"**: still only one more rung. | "Still stuck? The hints get sharper, step by step. Even if you ask for the answer, you only get the next hint. Never the code." | **Hints get sharper. Never the code.** |
| **0:40 – 0:56** | Open `/mentoring?learner=riya&challenge=first-n-squares&join=1`. Click **Join now**. Show Priya's tile lighting up with captions for about 3 s. Click **✨ Summarise** and let it reach **"Here it breaks"** (use the scrubber to jump there): the code line in red, `squares` as a box, the variables. | "Need more help? Join a call with **Priya**, your AI mentor. She talks you through it, just like a real mentor. Press **Summarise**, and she replays *your own code*, step by step, right up to the moment it breaks." | **Talk it through with Priya, your AI mentor** · **✨ Summarise: watch your own code break** |
| **0:56 – 1:06** | Open `/dashboard?learner=riya`. Hover over the two mistakes in **"Mistakes to watch"** (each says *"Seen in …"* two problems), then the **"Up next"** card and its reason. | "Layerflow also remembers your mistakes. When the same one shows up in two different problems, it picks your next problem to fix it, and tells you why." | **Remembers your mistakes** · **Picks your next problem, with the reason** |
| **1:06 – 1:17** | **Fast montage, about 2.5 s each:** `/repo` → click **This project (works offline)** → the score ring and layer diagram · `/community` → a teacher's accepted answer and a blurred spoiler · `/bounty` → the program cards · `/rewards` → the streak and points. | "And there's more. Repo Analyse reviews your real projects. In the Community, teachers help you out. Bug Bounty teaches real security bugs. And daily streaks earn you points and rewards." | **Repo Analyse · Community · Bug Bounty · Rewards** |
| **1:17 – 1:30** | **You on camera** again, then end on the logo with the URL. | "It's safe, it's tested, it even works without internet, and it's free to start. **Layerflow. We point, you fix.**" | **15/15 attacks blocked · 0 hidden-test leaks** · **Free to start** · **Layerflow: We point, you fix.** |

---

## Voiceover only (read this from a teleprompter)

> Every beginner has done this: stuck on a bug, ask AI, copy the answer… it passes. And next week? The same bug, all over again.
>
> The problem isn't that answers are hard to find. It's that they come too fast. So we built Layerflow.
>
> You write Python and press Submit. Layerflow runs it safely and tells you, in plain words, what went wrong: three hidden tests fail when k is bigger than the list. It never shows you the hidden tests, but it points at the exact line to look at.
>
> Still stuck? The hints get sharper, step by step. Even if you ask for the answer, you only get the next hint. Never the code.
>
> Need more help? Join a call with Priya, your AI mentor. She talks you through it, just like a real mentor. Press Summarise, and she replays your own code, step by step, right up to the moment it breaks.
>
> Layerflow also remembers your mistakes. When the same one shows up in two different problems, it picks your next problem to fix it, and tells you why.
>
> And there's more. Repo Analyse reviews your real projects. In the Community, teachers help you out. Bug Bounty teaches real security bugs. And daily streaks earn you points and rewards.
>
> It's safe, it's tested, it even works without internet, and it's free to start. Layerflow. We point, you fix.

*(about 210 words · about 1:27 at a relaxed pace)*

---

## Hinglish version (same timing, if you want it to feel more desi)

> Har beginner ne ye kiya hai: bug pe atke, AI se poocha, answer copy kiya… pass ho gaya. Aur agle hafte? Wahi bug, phir se.
>
> Problem ye nahi ki answer nahi milta. Problem ye hai ki answer bahut jaldi mil jaata hai. Isliye humne banaya **Layerflow**.
>
> Aap Python likho, Submit dabao. Layerflow code ko safely chalata hai aur simple words mein batata hai kya galat hua: *jab k list se bada hota hai, teen hidden tests fail hote hain*. Hidden tests kabhi nahi dikhata, but exact line pe point karta hai.
>
> Phir bhi atke? Hints step by step sharp hote jaate hain. Answer maango, toh bhi sirf agla hint milega. Code kabhi nahi.
>
> Aur help chahiye? **Priya** ke saath call join karo, aapki AI mentor. Woh ek real mentor ki tarah samjhaati hai. **Summarise** dabao, aur woh *aapka hi code* step by step replay karti hai, bilkul us moment tak jahan woh toot-ta hai.
>
> Layerflow aapki galtiyan yaad rakhta hai. Agar same galti do alag problems mein aaye, toh woh agla problem usi ko fix karne ke liye chunta hai, aur batata hai kyun.
>
> Aur bhi hai: Repo Analyse aapke real projects review karta hai, Community mein teachers help karte hain, Bug Bounty real security bugs sikhata hai, aur daily streak se points aur rewards milte hain.
>
> Safe hai, tested hai, bina internet ke bhi chalta hai, aur free mein shuru karo. **Layerflow: hum point karte hain, aap fix karte ho.**

---

## Editing notes

- **Burn the captions in.** On the landing page the video autoplays muted, so most visitors will *read* it, not hear it. Use the on-screen text column as big, bold text, one idea at a time.
- **Zoom in on what matters.** Use a slow 120–140 % zoom on the explanation, the Line Map box and Priya's *"Here it breaks"* frame. Never show a whole page for more than 2 seconds without a focus point.
- **Music:** soft, upbeat, no lyrics, at about 15 % volume under the voice. Let Priya's real voice come through for 1–2 seconds in the Mentoring scene; that's your "wow" moment.
- **Cuts:** cut on the action (the moment you click), never on a loading spinner. Trim every wait.
- **Avoid:** fake stats, a long intro with your logo, reading feature names off a list, and showing API keys, the `.env` file or terminal windows.

## Export for the landing page (below the hero)

| Setting | Value |
|---|---|
| Size | 1920 × 1080 (16:9), 30 fps |
| Files | `layerflow-intro.mp4` (H.264) **and** `layerflow-intro.webm` (VP9). Keep each under 12 MB. |
| Poster | a still of Priya's call or the Summarise frame, `layerflow-intro.jpg` |
| Where | put all three in `apps/web/public/` |
| Playback | `autoplay muted loop playsInline` with a visible **🔊 Watch with sound** button |

**Thumbnail idea:** split screen. On the left, "Copied answer ❌"; on the right, Priya's Summarise frame with "Found it myself ✅". Title: **"Stop copying. Start debugging."**
