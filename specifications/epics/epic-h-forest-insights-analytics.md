# Epic H - Forest Insights and Analytics (V2)

## Scope
Provide aggregated insights from IBP data (regional summaries, trends, and factor distributions) for decision support in Explore.

## Status
Out of MVP scope (V2 backlog).

## User Stories

### US-H1 - Regional Score Overview
As a contributor, I want to view average IBP scores by region so I can understand broad biodiversity patterns.

Acceptance criteria:
- Explore can display aggregated IBP score indicators by region.
- Aggregates are filterable by year range.
- Each aggregate displays sample size.

### US-H2 - Parcel Trend Analytics
As a contributor, I want to see parcel score trends over time so I can assess evolution on monitored parcels.

Acceptance criteria:
- For parcels with multiple submitted surveys, trends can be visualized by year/version.
- Trend view includes total score progression and factor-level progression.
- Missing years are handled explicitly (no fake interpolation by default).

### US-H3 - Factor Distribution Insights
As a contributor, I want to compare factor distributions across regions so I can identify strengths and weaknesses.

Acceptance criteria:
- Explore can show distributions for factors A..J per selected region and period.
- Views clearly separate `ibp_peuplement_gestion` factors (A..G) from `ibp_contexte` factors (H..J).
- Outlier values and low-sample situations are flagged.

### US-H4 - Analytics Trust and Transparency
As a contributor, I want to trust analytics outputs so I can use them responsibly.

Acceptance criteria:
- Aggregated views include provenance metadata (data period, refresh time, sample size).
- Privacy constraints are preserved (no personal data leakage from aggregates).
- Configurable minimum sample threshold can hide or blur low-confidence aggregates.
