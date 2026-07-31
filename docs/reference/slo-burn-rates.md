# SLOs, Error Budgets & Burn Rates

Concepts and formulas for Service Level Objectives (SLOs) tracking in **Observability Pro**.

## Formulas

1. **Error Budget (%)**:
   $$\text{Error Budget} = 100\% - \text{SLO Target}$$
   *Example: For a 99.9% availability target, the Error Budget is 0.1%.*

2. **Burn Rate ($x$)**:
   $$\text{Burn Rate} = \frac{\text{Observed Error Rate}}{\text{Allowed Error Budget Rate}}$$
   - **Burn Rate = 1.0**: Consuming Error Budget at expected pace over rolling window.
   - **Burn Rate > 1.0**: Burning budget faster than target limit.
   - **Burn Rate >= 14.4**: Critical alert (100% budget consumed within 2 days).
