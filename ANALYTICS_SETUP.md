# WeaveCarbon GTM + GA4 Setup

This frontend sends analytics events to `dataLayer` and expects Google Tag Manager to forward them to GA4.

## Production Env

Set this on the production frontend build only:

```env
NEXT_PUBLIC_GTM_ID=GTM-MTXG32D4
```

## GTM Container

Use container: `GTM-MTXG32D4`

Create a Google tag / GA4 tag with measurement ID:

```text
G-9P1TC4JZWL
```

Disable automatic page views in the GA4 configuration tag. Page views should come only from the custom `weave_page_view` event.

## Triggers

Create these triggers:

1. Custom event trigger for `weave_page_view`
2. Custom event trigger with regex:

```text
^(landing_|lead_|auth_|onboarding_|calculator_|dashboard_|pricing_|export_|report_)
```

## GA4 Tags

Create:

1. A GA4 `page_view` tag triggered by `weave_page_view`
2. A generic GA4 event tag triggered by the regex trigger above, using built-in variable `{{Event}}` as the GA4 event name

## Data Layer Variables

Create variables for:

- `page_path`
- `page_group`
- `locale`
- `account_type`
- `company_role`
- `is_demo`
- `auth_method`
- `business_type`
- `dataset_type`
- `report_type`
- `market`
- `document_group`
- `error_code`

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

- `weave_page_view`
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

Then verify in GTM Preview / Tag Assistant:

- landing load fires `weave_page_view`
- hero start and calculator clicks fire
- lead form submit/success/error fire
- login/signup and Google start fire
- onboarding submit/success/error fire
- calculator run fires
- overview quick actions fire
- plan-lock upgrade CTA fires `pricing_modal_open`
- export market open, preview, upload, approve fire
- reports export/create/download flows fire

## Privacy Guardrails

Do not send:

- email
- user ID
- company ID
- company name
- SKU
- uploaded file names
