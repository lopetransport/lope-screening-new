export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function formatApplication(a, applicationId) {
  const sections = [
    [
      "Applicant Details",
      {
        "Full Name": a.applicant.fullName,
        Phone: a.contact.mobileNumber,
        Email: a.contact.email,
        "ID / Passport Number": a.applicant.idOrPassportNumber,
        "Registration Type": a.applicant.registrationType,
        "Business Name": a.applicant.business?.name || "Individual",
        "BEEE Level": a.applicant.business?.beeeLevel || "Not applicable",
        "CIPC Registration":
          a.applicant.business?.cipcRegistrationNumber || "Not applicable",
        "Physical Address": a.contact.physicalAddress,
        Province: a.contact.province,
      },
    ],
    ...a.trucks.map((t, i) => [
      `Truck ${i + 1}`,
      {
        "Vehicle Type": t.vehicleType,
        "Load Capacity (tons)": t.loadCapacityTons,
        "Horse Registration": t.horseRegistration,
        "Trailer 1 Registration": t.trailer1Registration || "Not supplied",
        "Trailer 2 Registration": t.trailer2Registration || "Not supplied",
      },
    ]),
    [
      "Banking & Payment Details",
      {
        Bank: a.banking.bankName,
        "Account Holder": a.banking.accountHolderName,
        "Account Number": a.banking.accountNumber,
        "Account Type": a.banking.accountType,
        "Branch Code": a.banking.branchCode,
      },
    ],
    [
      "Consents & Submission",
      {
        "Terms Accepted": a.consents.termsAccepted,
        "Data Processing Consent": a.consents.dataProcessing,
        "Contact Consent": a.consents.contact,
        "Terms Version": a.consents.termsVersion,
        "Privacy Version": a.consents.privacyVersion,
        "Client Submitted At": a.clientSubmittedAt,
        "Schema Version": a.schemaVersion,
      },
    ],
  ];
  const intro = `Lope Transport Services — Complete Application ${applicationId}`;
  const text = [
    intro,
    ...sections.map(
      ([title, fields]) =>
        `${title}\n${Object.entries(fields)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")}`,
    ),
    "Supporting Documents",
    ...a.documents.map(
      (d) =>
        `${d.type}: ${d.fileName} (${d.mimeType}, ${d.sizeBytes} bytes)\nView/download: ${d.url}`,
    ),
  ].join("\n\n");
  const html = `<h1>${escapeHtml(intro)}</h1>${sections
    .map(
      ([title, fields]) =>
        `<h2>${escapeHtml(title)}</h2><table>${Object.entries(fields)
          .map(
            ([k, v]) =>
              `<tr><th style="text-align:left;padding:6px 16px 6px 0">${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`,
          )
          .join("")}</table>`,
    )
    .join(
      "",
    )}<h2>Supporting Documents</h2><ul>${a.documents.map((d) => `<li>${escapeHtml(d.type)}: <a href="${escapeHtml(d.url)}">${escapeHtml(d.fileName)}</a> (${escapeHtml(d.mimeType)}, ${d.sizeBytes} bytes)</li>`).join("")}</ul><p>Document links are bearer links: anyone with a link can open the file.</p>`;
  if (html.length > 60000)
    throw new Error(
      "The application is too long to store. Shorten free-text fields and retry.",
    );
  return { html, text };
}

export async function dispatchEmail(
  application,
  applicationId,
  formatted,
  { env = process.env, fetchEmail = fetch, logger = console } = {},
) {
  if (!env.RESEND_API_KEY) {
    logger.warn(
      "Application email not configured; full application retained in HubSpot",
      { applicationId },
    );
    return "not_configured";
  }
  try {
    const response = await fetchEmail("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `lope-application/${applicationId}`,
      },
      body: JSON.stringify({
        from:
          env.APPLICATION_FROM_EMAIL ||
          "Lope Transport Services <ops@lopetransport.co.za>",
        to: ["ops@lopetransport.co.za"],
        reply_to: application.contact.email,
        subject: `New hauler application — ${applicationId}`,
        html: formatted.html,
        text: formatted.text,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      logger.error("Application email dispatch failed; HubSpot copy retained", {
        applicationId,
        status: response.status,
      });
      return "failed";
    }
    const receipt = await response.json();
    if (!receipt?.id) throw new Error("No email receipt");
    return "accepted";
  } catch {
    logger.error(
      "Application email dispatch unconfirmed; HubSpot copy retained",
      { applicationId },
    );
    return "failed";
  }
}
