# Lope hauler registration reconstruction

Inspected https://lope-screening.vercel.app/ on 14 October 2026 and compared all seven supplied screenshots. The live page title is **Hauler Onboarding**. This is a hauler/fleet application, rather than a candidate employment screening flow. No separate driver licence details, vehicle ownership question, background check screen, phone OTP, ID lookup or authentication screen was observed. Driver's License is a supporting-document category.

## Observed sequence and fields

| Step                  | Section                     | Fields / behavior                                                                                                                                                                                                                                |
| --------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Basic Information   | Personal Information        | Full Name (text, required), ID or Passport Number (text, required)                                                                                                                                                                               |
| 1                     | Entity Type                 | Registration Type (Individual / Business radio cards, required). Business reveals required Business Name, BEEE Level dropdown and CIPC Registration Number. The original uses “BEEE”; helper text refers to B-BBEE.                              |
| 1                     | Contact Information         | Mobile Number (required, SA format helper), Email Address (required)                                                                                                                                                                             |
| 1                     | Address Information         | Physical Address (required textarea), Province (required select, all nine SA provinces)                                                                                                                                                          |
| 2 Vehicle Information | Vehicle Details             | Initially one truck. Add Truck appends another card; removal controls appear when more than one exists. Every truck requires Vehicle Type, Load Capacity and Horse Registration. Trailer 1 Registration and Trailer 2 Registration are optional. |
| 3 Banking Details     | Banking Information         | Bank Name, Account Holder Name, Account Number, Account Type and Branch Code; all required. Helper text requires 8–13 account-number digits and six branch-code digits. Account holder must match the account.                                   |
| 4 Document Upload     | Upload Supporting Documents | Select Document Type before uploading. PDF/JPEG/PNG/WebP, maximum 10 MB per file. Multiple files per category supported. At least one document required to continue.                                                                             |
| 5 Terms & Consent     | Terms and Conditions        | Required Terms of Use checkbox, explanatory text, expandable View Terms Preview.                                                                                                                                                                 |
| 5                     | Privacy and Data Consent    | Required data storage/processing checkbox and expandable View Privacy Policy Summary.                                                                                                                                                            |
| 5                     | Communication Preferences   | Required contact checkbox. Describes phone, email and SMS for delivery notifications, account updates, payment information and support. Submit Application button.                                                                               |

### Observed option sets

- Vehicle types: Bakkie/Light Delivery Vehicle; Panel Van; Truck (Rigid); Truck (Articulated); Flatbed Truck; Refrigerated Truck; Tipper Truck; Other.
- Capacities: each integer from 1 Ton through 15 Tons.
- Banks: ABSA Bank; Standard Bank; First National Bank (FNB); Nedbank; Capitec Bank; African Bank; Investec Bank; Discovery Bank; TymeBank; Bank Zero; Bidvest Bank; Sasfin Bank; Other.
- Account types: Current Account; Savings Account; Business Current Account; Business Savings Account.
- Business certification: Levels 1–8 with recognition percentages 135, 125, 110, 100, 80, 60, 50 and 10; Non-compliant (0%).
- Document categories: Vehicle Registration Certificate; Driver's License; Vehicle Insurance Certificate; Roadworthy Certificate; Bank Statement; Bank Account Confirmation Letter; ID Document / Passport; Business Registration (CIPC); Tax Clearance Certificate; Other Supporting Document.

## States and interactions

1. Initial: step 1 of 5, 0% Complete, disabled Previous, active red circle 1.
2. Continue validates the current step. Blank fields show inline required messages and navigation remains on that step. This was verified live for basic information and missing documents.
3. Completed steps show red outlined check circles. Active step is a solid red numbered circle; future steps are grey outlines. Percentages are stage-based: 0%, 20%, 40%, 60%, 80%. They do not count completed individual inputs.
4. Previous returns to the earlier form. Rebuild keeps all form values in React state. There is no separately observed review step.
5. Original shows Saving… and Draft saved. Its persistence mechanism, scope, retention and file recovery were not inspected. Rebuild provides an explicit opt-in sessionStorage draft, excludes file contents, warns that documents must be reattached, and recovers up to the document step.
6. Document upload is disabled until a category is chosen. Rebuild additionally provides a labelled attachment list, remove actions, MIME/size/empty-file validation and duplicate suppression. These added details were not verified on the original uploaded-file screen.
7. Rebuild includes submitting, HTTP failure/retry, received-with-reference and local-preview completion states. The original submission outcome and backend were **not verified**; no live application or document was submitted.

## Visual architecture

White background; approximately 896px content column on large screenshots; generous whitespace; central heading and two-line introduction. System sans-serif font confirmed from the live DOM. Screenshots indicate a 48px large-screen heading; the live browser used 30px at its narrower viewport. Rebuild uses 30px mobile / 48px desktop. Black headings, neutral grey secondary text, thin pale-grey input borders, six-to-eight-pixel radii, faint card shadow. Original Continue background verified as rgb(239, 67, 67), reproduced as #ef4343. Inputs are around 42–44px tall. Sections have approximately 32–40px vertical spacing. Desktop fields use two columns; registration numbers use three. Rebuild stacks them on mobile and hides step descriptions at small widths while preserving all five step labels. Exact original mobile behavior was not tested.

## Validation: observed versus added

Observed: required-field errors; business-specific requirements; acceptance of synthetic passport-like DEMO12345; SA mobile helper; numeric banking requirements; 1–15-ton helper/options; missing-document error. Testing used synthetic names/contact/account values and stopped before uploading or submitting.

Added in rebuild: 13-digit SA IDs checked for calendar date, citizenship digit and Luhn checksum; other identifiers accept 5–30 letters/digits/spaces/hyphens. This does not verify identity or passport authenticity. Phone accepts 0 or +27 prefixes, strips display separators and accepts mobile prefixes 6–8. Email gets a basic syntax check. CIPC has required presence only; registration plate and account ownership authenticity require server-side checks. Bank numbers remain strings to preserve leading zeros. File validation is client-side convenience and must be repeated on the server.

## Component and data architecture

`App.tsx`: wizard, accessible inputs, conditional business cards, dynamic trucks, files, consent accordions, focus/navigation, submission states and session draft.

`model.ts`: typed form object, observed dropdowns, initial values and API payload serializer. `validation.mjs`: independently testable validation. `styles.css`: Tailwind 4 with original colors and reusable control styles. `application.schema.json`: submission JSON contract. Files are multipart attachments, not embedded in JSON.

The original implementation/framework/API endpoint cannot be identified conclusively from these public screens. The reconstruction uses React + TypeScript + Vite + Tailwind, a supported choice in the request.

## Recovery gaps

Approved expanded terms/privacy copy, original server API, storage provider, notification behavior, duplicate-application handling and original receipt screen remain unavailable. Configure the actual policy text and endpoint before accepting real applications. Required consent labels/descriptions are reproduced; expanded policy text is explicitly marked as unrecovered. This is a tested front-end implementation, not a claim that backend identity, payment or document verification has been recovered.
