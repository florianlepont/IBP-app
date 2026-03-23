# Epic H - Forest Insights and Analytics

**Release:** V2

Provide aggregated insights from IBP data (regional summaries, trends, and factor distributions) for decision support in Explore.

---

## User Stories

### US-H1 - Regional Score Overview

**Release:** V2

Average IBP scores by region should be displayed, with the ability to filter aggregates by year range and show sample sizes for each aggregate.

As a contributor, I want to view average IBP scores by region so I can understand broad biodiversity patterns.

Acceptance criteria

- Explore can display aggregated IBP score indicators by region.

- Aggregates are filterable by year range.

- Each aggregate displays sample size.

### US-H2 - Parcel Trend Analytics

**Release:** V2

Parcel score trends will be visualized over time for monitored parcels with multiple submitted surveys, showing total score progression and factor-level progression, while explicitly handling missing years without interpolation.

As a contributor, I want to see parcel score trends over time so I can assess evolution on monitored parcels.

Acceptance criteria

- For parcels with multiple submitted surveys, trends can be visualized by year/version.

- Trend view includes total score progression and factor-level progression.

- Missing years are handled explicitly (no fake interpolation by default).

### US-H3 - Factor Distribution Insights

**Release:** V2

The goal is to compare factor distributions across regions to identify strengths and weaknesses, with acceptance criteria including the ability to show distributions for factors A to J, clearly separate ibp_peuplement_gestion factors from ibp_contexte factors, and flag outlier values and low-sample situations.

As a contributor, I want to compare factor distributions across regions so I can identify strengths and weaknesses.

Acceptance criteria

- Explore can show distributions for factors A..J per selected region and period.

- Views clearly separate `ibp_peuplement_gestion` factors (A..G) from `ibp_contexte` factors (H..J).

- Outlier values and low-sample situations are flagged.

### US-H4 - Analytics Trust and Transparency

**Release:** V2

As a contributor, I want to trust analytics outputs so I can use them responsibly.

Acceptance criteria

- Aggregated views include provenance metadata (data period, refresh time, sample size).

- Privacy constraints are preserved (no personal data leakage from aggregates).

- Configurable minimum sample threshold can hide or blur low-confidence aggregates.
