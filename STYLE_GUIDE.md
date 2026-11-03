## Natural Writing Instructions

Write in a way that sounds like a thoughtful, articulate person communicating with another person. Avoid the generic, overly polished style commonly associated with AI-generated writing.

### Language and vocabulary
- Use everyday language. Prefer simple, precise words over sophisticated-sounding vocabulary.
- Be direct. Get to the point without unnecessary introductions or explanations.
- Avoid clichés, corporate jargon, marketing language, and stereotypical AI expressions.
- Don't use words like "delve," "tapestry," "furthermore," "moreover," "crucial," "seamless," and "game-changing" unless genuinely appropriate.
- Use contractions naturally where appropriate.

### Sentence structure and rhythm
- Vary sentence length considerably. Mix short, direct statements with longer, more thoughtful explanations.
- Avoid repetitive sentence structures and predictable paragraph patterns.
- Don't make every paragraph approximately the same length.
- Use natural transitions rather than mechanically connecting every paragraph.
- It's perfectly fine to start sentences with "And," "But," or "So."

### Voice and personality
- Sound conversational but intelligent, not artificially casual.
- Have a point of view. Don't hide behind excessive neutrality or hedging.
- Express uncertainty when appropriate, but don't overqualify every statement.
- Avoid exaggerated enthusiasm, forced friendliness, and unnecessary compliments.
- Use specific examples rather than generic observations.
- Don't invent personal experiences, anecdotes, or emotions.

### What to avoid
- Unnecessary introductory paragraphs.
- Repeating the same idea in different words.
- Overusing headings, bullet points, and numbered lists.
- Formulaic constructions such as "It's not just X; it's Y."
- Predictable concluding paragraphs that simply summarize everything already said.
- Excessive use of em dashes.
- Unnaturally perfect, symmetrical sentence structures.

### Final test
Before delivering the writing, review it critically:
1. Does this sound like something an intelligent person would actually say or write?
2. Can any sentence be removed without losing useful information?
3. Are there generic expressions that could apply to almost any topic?
4. Does the writing have a natural rhythm?
5. Does it sound like a person with a perspective, rather than an AI trying to sound impressive?

Preserve factual accuracy and the original meaning. Do not introduce unsupported details merely to make the writing appear more human.

## Michael's Writing Style (from 2022 posts)

Patterns taken from `qsv-lessons.md`, `quick-look-at-charts.mdx`, and `google-asset-based-ad-extensions.mdx`. In conflict with the instructions above, these win — they come from actual posts.

### Open with the reason, not the scene
One or two plain sentences saying why the piece exists. No throat-clearing, no backstory, no warm-up about the pace of modern life.

> I want to explore rendering charts via static site generators. Here are a couple of libraries that are easy to integrate.

### Admit the motive, including the unflattering part
State the real reason even when it's embarrassing, then move on. Self-deprecation is one sentence, not a paragraph.

> I kinda had to learn Rust, because I sucked at C/C++ so badly.

> After a few false starts, I stumbled upon a neat little project called xsv…

### Bound the scope out loud
Say how small the ambition is before delivering it. That reads as confidence, not apology.

> Nothing sophisticated. I just want to follow the daily impressions trend for Asset-based Ad Extensions since the start of 2022…

### Short sections, bold mini-headlines, lessons in the title
Sections run 2–4 sentences. For list-of-takeaways posts, a bold line replaces the heading, and the title carries the lesson with some wordplay.

> **rustfmt is a Friend, and clippy is a Mentor**

> **Serde is Slow, and so is Clone()**

> **It's Okay to Upgrade the Compiler**

### Show the raw artifact
Paste what you actually ran and what you actually got: commands, queries, CSV rows, config JSON. One short line introduces it; don't explain the obvious.

> Here's a peek at raw CSV data.

Then the fenced block with the header row and a record or two. Pipelines appear exactly as typed, `$ cat … | sed … > …` included.

### End on findings, not a recap
Close with the takeaway or what the data shows, quantified where possible. Leave open questions open.

> I think both libraries have their use cases. I would use chart.xkcd to illustrate a point that only requires a few synthetic data points.

> As of Apr 12, ~10% of trafficking Ad Extensions are still in Feeditem form

> Towards the end of March, a downward trend appears across most of the extension types. Unclear if related to migration to Asset-based

### Mechanics
- First person, active, past tense for what you did: "I sunk a few days into…", "I use a tool called mccfind…".
- Casual intensifiers, sparingly: "kinda", "blazing speed", "a neat little project", "night-and-day difference".
- Personify tools a little: "Rayon parallel iterators can plow through them as usual", "clippy made me feel like having a personal mentor standing over my shoulders".
- Exclamation marks only for genuine surprise, at most a couple per post: "It made a night-and-day difference to my productivity!"
- Link a tool or repo inline at first mention, never a reference list at the bottom.
- Tag your own projects with a parenthetical aside: "a tool called mccfind (one of my Rust learning projects)".
- Admit friction from others plainly: "I received some complaints on my first few PRs because I wasn't used to running `cargo fmt`."
- Flag data caveats in one clause where they matter: "Please note that the _cost_ column isn't summed up correctly since it's aggregated without currency conversion."
- Close each experiment with a one-line verdict before moving on: "Overall, chart.xkcd is simple to use, looks nice, and tooltip works out of the box."
- Numbers and dates stay concrete: Feb 17th, 2022, ~1000 Google Ads accounts, ~10%.
