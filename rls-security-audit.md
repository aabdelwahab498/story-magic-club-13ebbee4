# Row-Level Security Audit (rls-security-audit.md)

This report details the Row-Level Security (RLS) configurations for all database tables introduced during recent migrations to confirm complete tenant isolation.

---

## 1. Table RLS Mapping & Risk Assessment

| Database Table | RLS Enabled | Policies Active | Risk Level | Target Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `user_credits` | **Yes** | 1. "Users can read own credits" (SELECT)<br>2. "Service role full access user_credits" (ALL) | **Low** | None. Completely isolated. |
| `credit_transactions` | **Yes** | 1. "Users can read own credit transactions" (SELECT)<br>2. "Service role full access credit_transactions" (ALL) | **Low** | None. Completely isolated. |
| `usage_events` | **Yes** | 1. "Users can read own usage events" (SELECT)<br>2. "Service role full access usage_events" (ALL) | **Low** | None. Completely isolated. |
| `subscription_plans` | **Yes** | 1. "Subscription plans are viewable by all authenticated users" (SELECT)<br>2. "Admins have full access to subscription_plans" (ALL) | **Low** | None. Publicly visible metadata protected from unauthorized writes. |
| `plan_features` | **Yes** | 1. "Plan features are viewable by all authenticated users" (SELECT)<br>2. "Admins have full access to plan_features" (ALL) | **Low** | None. |
| `plan_limits` | **Yes** | 1. "Plan limits are viewable by all authenticated users" (SELECT)<br>2. "Admins have full access to plan_limits" (ALL) | **Low** | None. |
| `user_subscriptions` | **Yes** | 1. "Users can view their own subscriptions" (SELECT)<br>2. "Admins have full access to user_subscriptions" (ALL) | **Low** | None. Private status isolated per owner. |
| `payment_customers` | **Yes** | 1. "Users can read own payment_customers" (SELECT)<br>2. "Admins can read payment_customers" (SELECT) | **Low** | None. Only service role can modify. |
| `payment_transactions` | **Yes** | 1. "Users can read own payment_transactions" (SELECT)<br>2. "Admins can read payment_transactions" (SELECT) | **Low** | None. Only service role can modify. |
| `subscription_events` | **Yes** | 1. "Users can read own subscription_events" (SELECT)<br>2. "Admins can read subscription_events" (SELECT) | **Low** | None. Only service role can modify. |
| `ai_usage_costs` | **Yes** | 1. "Admins can read ai_usage_costs" (SELECT) | **Low** | None. Regular authenticated users have zero access (no read/write). |

---

## 2. Conclusion
All tables correctly declare `ALTER TABLE ENABLE ROW LEVEL SECURITY`. No data leaks or configuration bypass vulnerabilities exist.
