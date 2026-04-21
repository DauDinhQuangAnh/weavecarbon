# WeaveCarbon Analytics v2

This app now uses:

- Frontend `gtag.js` -> GA4 for behavior analytics
- Backend `analytics_outbox` + optional GA4 Measurement Protocol for durable business outcomes
- GA4 native BigQuery export for warehouse ingestion

## Frontend Env

Set this on the production frontend build:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-81EN7B9X8Z
```

## Analytics Lab

- Hidden internal route: `/tools/analytics-lab`
- The lab now runs through a real app route in a separate window so `page_view` happens on the actual target page before the custom event is sent.
- Use it to fake `page_view` and `wc_*` events from the frontend through the same GA4 wrapper used by the app while keeping the route context close to a normal user session.
- The lab can force-send outside normal production-only tracking checks and can optionally attach `debug_mode` for GA4 DebugView.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` must be present or the tool will only show previews and not send anything.
- Internal routes `/AI_CONFIG` and `/tools/analytics-lab` skip automatic `page_view` tracking to avoid polluting analytics during ops work.

## Backend Env

Set these on the backend:

```env
ANALYTICS_HMAC_SECRET=replace_with_a_long_random_secret
GA4_MEASUREMENT_ID=G-81EN7B9X8Z
GA4_API_SECRET=replace_with_ga4_api_secret
ANALYTICS_OUTBOX_FLUSH_LIMIT=50
```

`ANALYTICS_HMAC_SECRET` is used to derive:

- `analytics_user_key`
- `analytics_company_key`

These keys are non-PII and are safe to use as GA4 `user_id` / warehouse join keys.

## Database

Run backend migrations so `public.analytics_outbox` exists:

```bash
cd /opt/weavecarbon/BE
npm run migrate
```

Manual flush:

```bash
cd /opt/weavecarbon/BE
npm run analytics:flush
```

## Identity Model

- FE receives `analytics_user_key` from auth/account responses
- FE sets GA4 `user_id` to `analytics_user_key`
- FE user properties stay low-cardinality: `account_type`, `company_role`, `plan_family`, `plan_sku_limit`, `business_type`, `domestic_market`, `is_demo`, `locale`
- Raw UUIDs, email, company name, SKU, file names are not sent to GA4

## GA4 Custom Dimensions

Register event-scoped custom dimensions for:

- `account_type`
- `company_role`
- `plan_family`
- `plan_sku_limit`
- `business_type`
- `domestic_market`
- `is_demo`
- `page_group`
- `feature_area`
- `market_code`
- `report_type`
- `dataset_type`
- `document_group`
- `billing_cycle`

## Recommended Key Events

Mark these as key events in GA4:

- `sign_up`
- `login`
- `wc_onboarding_completed`
- `wc_product_created`
- `wc_report_generated`
- `purchase`

## Event Taxonomy

Implemented client + server events now include:

- `page_view`
- `generate_lead`
- `login`
- `sign_up`
- `begin_checkout`
- `purchase`
- `wc_auth_google_start`
- `wc_auth_login_submit`
- `wc_auth_login_error`
- `wc_auth_sign_up_submit`
- `wc_auth_sign_up_error`
- `wc_email_verification_completed`
- `wc_onboarding_submit`
- `wc_onboarding_completed`
- `wc_onboarding_error`
- `wc_calculator_run`
- `wc_dashboard_quick_action_clicked`
- `wc_pricing_modal_opened`
- `wc_plan_selected`
- `wc_payment_failed`
- `wc_product_created`
- `wc_product_updated`
- `wc_product_deleted`
- `wc_product_published`
- `wc_product_viewed`
- `wc_bulk_import_started`
- `wc_bulk_import_completed`
- `wc_bulk_import_failed`
- `wc_batch_created`
- `wc_batch_published`
- `wc_export_market_opened`
- `wc_market_scope_product_added`
- `wc_market_scope_product_removed`
- `wc_document_preview_opened`
- `wc_document_uploaded`
- `wc_document_upload_failed`
- `wc_document_approved`
- `wc_export_report_requested`
- `wc_report_requested`
- `wc_report_generated`
- `wc_report_generation_failed`
- `wc_report_downloaded`
- `wc_report_download_failed`
- `wc_member_invited`
- `wc_member_invite_resent`
- `wc_member_role_changed`
- `wc_member_disabled`
- `wc_member_removed`
- `wc_profile_updated`
- `wc_chat_opened`
- `wc_chat_message_sent`
- `wc_chat_response_received`
- `wc_chat_conversation_deleted`
- `wc_chat_settings_saved`
- `wc_route_simulation_run`
- `wc_shipment_updated`
- `wc_shipment_status_changed`

## BigQuery

Enable native GA4 BigQuery export:

- use `events_intraday_*` for near-real-time checks
- use `events_*` for stable daily analysis

Recommended warehouse join pattern:

- GA4 exported `user_id` = `analytics_user_key`
- PostgreSQL synced dims/facts compute the same HMAC keys using `ANALYTICS_HMAC_SECRET`

## Validation Checklist

Frontend:

```bash
cd /opt/weavecarbon/FE
npm run check
npm run build
```

Backend:

```bash
cd /opt/weavecarbon/BE
npm run check:syntax
```

Live checks:

- browser `Network` shows `https://www.google-analytics.com/g/collect` with `204`
- GA4 Realtime shows `page_view`, `login`, `sign_up`, and custom `wc_*` events
- server-side flows create rows in `public.analytics_outbox`

Quick SQL:

```sql
SELECT event_name, delivery_status, occurred_at
FROM public.analytics_outbox
ORDER BY occurred_at DESC
LIMIT 50;
```

## Privacy Guardrails

Do not send to GA4:

- email
- full name
- raw user UUID
- raw company UUID
- company name
- SKU
- uploaded file name
- tracking number
