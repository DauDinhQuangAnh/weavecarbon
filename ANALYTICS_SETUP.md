# WeaveCarbon GA4 Setup

This frontend sends analytics events directly to Google Analytics 4 using `gtag.js`.

## Production Env

Set this on the production frontend build:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-81EN7B9X8Z
```

## Google Tag

The app injects the Google tag script and configures it with `send_page_view: false`.
SPA page views are sent manually on route change so they are not double-counted.

## GA4 Custom Dimensions

Register event-scoped custom dimensions for:

- `account_type`
- `company_role`
- `is_demo`
- `page_group`
- `auth_method`
- `business_type`
- `dataset_type`
- `report_type`
- `market`
- `document_group`

## Event Names

Implemented events:

- `page_view`
- `landing_start_click`
- `landing_calculator_click`
- `lead_form_submit`
- `lead_form_success`
- `lead_form_error`
- `auth_login_submit`
- `auth_login_success`
- `auth_login_error`
- `auth_signup_submit`
- `auth_signup_success`
- `auth_signup_error`
- `auth_google_start`
- `onboarding_submit`
- `onboarding_success`
- `onboarding_error`
- `calculator_run`
- `dashboard_quick_action_click`
- `pricing_modal_open`
- `export_market_open`
- `export_document_preview_open`
- `export_document_upload_submit`
- `export_document_upload_success`
- `export_document_upload_error`
- `export_document_approve_success`
- `report_quick_export_click`
- `report_quick_export_success`
- `report_quick_export_error`
- `report_create_submit`
- `report_create_success`
- `report_create_error`
- `report_download_click`
- `report_download_success`
- `report_download_error`

## Validation Checklist

Run locally:

```bash
npm run check
npm run build
```

Then verify in Google Tag Assistant and GA4 Realtime:

- landing load fires `page_view`
- hero start and calculator clicks fire
- lead form submit/success/error fire
- login/signup and Google start fire
- onboarding submit/success/error fire
- calculator run fires
- overview quick actions fire
- plan-lock upgrade CTA fires `pricing_modal_open`
- export market open, preview, upload, approve fire
- reports export/create/download flows fire

You can also verify the live deployment from a shell:

```bash
curl -fsSL https://weavecarbon.com | grep -E "G-81EN7B9X8Z|gtag/js|googletagmanager.com"
```

And from the browser console:

```js
typeof window.gtag
document.querySelector('script[src*="googletagmanager.com/gtag/js?id=G-81EN7B9X8Z"]')
```

## Privacy Guardrails

Do not send:

- email
- user ID
- company ID
- company name
- SKU
- uploaded file names
