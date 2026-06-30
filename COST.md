# COST.md — Blog Production & Hosting

Tracks the AI cost to **produce** this blog (the "AI-Accelerated DevSecOps" series and
future posts) and the estimated cost to **run** it. Source-repo *build* costs are tracked
in each repo's own `COST.md` and cited per-post; this file covers blog production only.

> Cost accounting here is deliberately **flat**: source-repo build cost (cited per post) +
> blog production cost (research / writing / review). No meta-costs, no recursion.

## Assumptions

- Model: **Claude Sonnet 4.6** for research, writing, and review agents.
- Indicative pricing used for estimates: **~$3 / M input tokens, ~$15 / M output tokens**.
- Figures are **estimates** derived from agent run scope (context read + output produced),
  not exact billing. Treat as order-of-magnitude.

## Per-post blog production (flat model)

Each post carries a small cost section built from these line items:

| Item                         | Est. cost / post |
|------------------------------|------------------|
| Research (per-post share)    | ~$0.40           |
| Writing (one drafting pass)  | ~$0.30           |
| Review / edit (one pass)     | ~$0.30           |
| **Blog production subtotal** | **~$1.00**       |

The post's total cost line = **source-repo build cost (from that repo's COST.md)** +
**~$1.00 blog production**.

## Campaign cumulative (AI-Accelerated DevSecOps series)

| Phase                                            | Runs            | Est. cost |
|--------------------------------------------------|-----------------|-----------|
| Research (3 topic clusters + cost collection)    | 4 agent runs    | ~$9       |
| Writing (15 posts, incl. a re-run after a failed batch) | ~17 runs | ~$5       |
| Review / editorial + security redaction passes   | ~4 runs         | ~$2       |
| Automation build (LinkedIn on-push + scheduled, incl. one retry) | ~3 runs | ~$3 |
| **Estimated campaign total to date**             |                 | **~$19**  |

_Updated each session as the campaign progresses._

## Estimated hosting / runtime cost

| Component                               | Cost |
|-----------------------------------------|------|
| GitHub Pages hosting (public repo)      | $0 (free) |
| GitHub Actions (LinkedIn promotion)     | $0 — within free minutes for a public repo |
| LinkedIn API usage                      | $0 (free tier, personal posting) |
| **Total monthly run cost**              | **~$0** |

## Session log

| Date (ET)  | Session focus                                              | Est. AI cost |
|------------|------------------------------------------------------------|--------------|
| 2026-06-29 | Series setup, research (14 briefs), posts 1–6, LinkedIn automation, cost tooling | ~$19 |
