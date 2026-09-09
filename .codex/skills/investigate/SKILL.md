---
name: investigate
description: Investigate why reported software behavior is broken without editing code. Use for bug reports, regressions, failed tests, or requests to find the bug or understand why something is broken; return evidence-backed leads, not a diagnosis or fix.
---

# Investigate

Gather and organize verified evidence about a reported defect. This skill investigates; it does not diagnose a root cause, determine a fix, or implement a change.

Investigation is read-only: do not modify files, stage or commit changes, run destructive commands, or change external state.

The outcome is a ranked set of evidence-backed leads, or an explicit statement that available evidence is insufficient.

## 1. Frame the incident

Start with only what is known:

- observable symptom;
- expected and actual behavior;
- affected action, input, user state, and environment when known;
- reproduction status and existing artifacts such as errors, logs, or failing tests.

Separate reported facts from assumptions. Missing information is an unknown, not evidence for a cause.

## 2. Build the system model before forming hypotheses

The coordinator must understand the relevant system before forming causal hypotheses. Follow the `explore` skill whenever repository structure or the execution path is unknown: spawn one read-only Explorer per independent track in parallel, then wait for every Explorer. Spawn a new agent; never fork the root session. Never wait on an agent you have not spawned.

Begin with the smallest question that reduces the largest uncertainty, such as the route/component that starts the action, whether a backend exists, or where persistence occurs. Split it into genuinely independent tracks before spawning, and keep a sequential chain with one Explorer when the tracks are not independent.

Explorer briefs must be fact-finding only. Require:

- verified architecture, execution/data flow, and boundaries;
- exact `path:line` references;
- observed side effects and relevant tests/configuration;
- unknowns and contradictions.

Do not ask Explorers to nominate a root cause, rank causes, or propose fixes. Reconcile findings into one current system model before choosing further exploration.

After tracing the relevant flow, inspect relevant `git log`, diffs, or blame when available. A recent change is a lead to investigate, not evidence that it caused the defect.

## 3. Define competing hypotheses

Once the system model can explain where the symptom could arise, the coordinator defines three to five competing causal hypotheses, including `other or unknown cause` whenever the set may be incomplete.

- Keep hypotheses at comparable granularity and make them mutually exclusive where practical.
- State the causal path each hypothesis claims: triggering condition, execution path, and observed symptom.
- For each hypothesis, state a discriminating prediction: what evidence would increase its probability and what evidence would decrease it.

Every candidate remains a hypothesis. Suspicious-looking code, an error string, a nearby recent change, and an agent's intuition are leads—not causes.

## 4. Initialize bounded priors

The coordinator may express its initial understanding, but must not assign direct percentage beliefs from intuition. Assign every hypothesis an initial plausibility score from 1 to 5, with a written rationale based only on the incident report and the system model. Equal scores are the correct default: separate two hypotheses only when the incident report or the system model gives a stated reason to.

Normalize the scores into `raw_prior`, then shrink them halfway toward a uniform distribution:

```text
uniform_prior(H) = 1 ÷ number_of_hypotheses
prior(H) = 0.5 × raw_prior(H) + 0.5 × uniform_prior(H)
```

This preserves useful initial judgment while preventing any initial hypothesis from becoming certain or impossible.

List the facts each score relies on as `prior basis`. A fact on that list has already been counted: it must never appear again as evidence in the ledger, and neither may a restatement of it at a different level of detail. If a prior-basis fact turns out to be the strongest available discriminator, remove it from the prior basis, reset the affected scores without it, and record it once in the ledger instead.

## 5. Gather discriminating evidence and update belief

Choose the next safe, read-only observation, trace, or reproduction step for its ability to distinguish remaining hypotheses—not because it confirms the current favorite. Before collecting material evidence, record the expected result under every remaining hypothesis and the multiplier each possible outcome would apply.

When reproduction is safe and feasible, capture exact preconditions, input, command or interaction, and actual result. If the issue cannot be reproduced, say so and continue only with evidence whose limitation is clear.

Use at most five evidence-gathering rounds. This is a safety cap, not a quota: stop as soon as the stopping condition is met. A round may gather only the independent observations needed to answer its stated question.

For each independent evidence group, update every hypothesis:

```text
new_weight(H) = current_probability(H) × likelihood_multiplier(E | H)
new_probability(H) = new_weight(H) ÷ sum(new_weight(all hypotheses))
```

The multiplier describes how expected the evidence would be if that hypothesis were true. It is not the probability that the hypothesis is true after seeing the evidence.

Use measured or derived likelihoods when available:

- **Measured:** a relevant observed frequency from telemetry, test history, or representative data.
- **Derived:** a behavior demonstrated by current source, a controlled reproduction, or a test.

Otherwise use this operational scale. Select a multiplier for every remaining hypothesis and state its evidence-based rationale; do not choose it from intuition alone.

| Relationship between evidence and hypothesis | Multiplier |
| --- | ---: |
| Nearly impossible if true | 0.1 |
| Strongly inconsistent | 0.5 |
| Somewhat inconsistent | 0.75 |
| Neither expected nor unexpected | 1 |
| Somewhat expected | 1.25 |
| Strongly expected | 2 |
| Very strongly expected | 4 |

Record one ledger row per `evidence group × hypothesis`. Every hypothesis whose multiplier is not 1 needs its own row; those left at 1 may share one row listing them (`unchanged: H2, H4`).

| Evidence group | Hypothesis | Prior/current probability | Multiplier | Updated probability | Source and rationale |
| --- | --- | ---: | ---: | ---: | --- |

Do not double-count correlated observations. A browser error, API response, and server log describing the same failed request normally belong to one independent-evidence group. Facts used only to map architecture define the hypothesis space; they are not diagnostic evidence by themselves.

Do not exclude a hypothesis merely because its posterior is low. Exclude it only when direct, recorded evidence contradicts a necessary part of its claimed causal path; record that contradiction in the ledger. A low multiplier alone is not an exclusion decision.

## 6. Stopping condition and report

Stop collecting evidence when one of these occurs:

1. one hypothesis reaches 80% or more;
2. five evidence-gathering rounds complete; or
3. no further safe, independent, discriminating observation is available with the current access and artifacts.

A hypothesis at or above 80% is a **leading lead**, not a verified root cause. It identifies the most valuable direction for a separate debugging or remediation task; it does not establish the complete causal chain and never authorizes a fix. Report it as `80% or more`, not with a more precise percentage. Round every other reported probability to the nearest 5%.

Return:

1. **Investigation summary:** symptom, scope, and what the investigation established.
2. **System model:** concise relevant flow with exact file references.
3. **Ranked leads:** initial scored-and-shrunk priors with their `prior basis`, the hypothesis ledger, and current distribution; label any hypothesis at or above 80% as a leading lead.
4. **Evidence and exclusions:** what each key observation establishes, which alternatives it weakens, and any direct contradiction that excludes a hypothesis.
5. **Reproduction status and confidence limits,** opening with the stopping
   condition and rounds used — e.g. `Stopped by condition 3 after 3 of 5 rounds.`
6. **Next best observation:** only when the investigation ended without a leading lead.

## Guardrails

- Do not silently discard a hypothesis; state the direct evidence that excluded it.
- Do not treat absence of a local failure as evidence that a production-only defect is absent.
- Do not infer runtime behavior solely from comments, plans, stale documentation, or source that was not exercised.
- If evidence conflicts, retain the conflict, lower confidence, and investigate the discrepancy.
- Do not call any hypothesis a root cause, a diagnosis, or a fix target while this skill is active.
- A request to investigate does not authorize debugging or remediation. A later task may use the evidence ledger, but must independently validate any proposed change.
- Test each input of a suspect mechanism on its own. An input assumed correct is an
  assumption, not evidence, and the most salient part must not stand in for the whole.
