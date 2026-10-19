export async function saveApplication(
  a,
  applicationId,
  formatted,
  {
    token = process.env.HUBSPOT_ACCESS_TOKEN,
    fetchCRM = fetch,
    logger = console,
  } = {},
) {
  const base = "https://api.hubapi.com/crm/v3/objects";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const [firstname, ...names] = a.applicant.fullName.trim().split(/\s+/);
  const body = JSON.stringify({
    properties: {
      email: a.contact.email,
      firstname,
      lastname: names.join(" "),
      phone: a.contact.mobileNumber,
      company: a.applicant.business?.name || "",
    },
  });
  const call = (url, method, body) =>
    fetchCRM(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(12000),
    });
  let response = await call(`${base}/contacts`, "POST", body);
  if (response.status === 409)
    response = await call(
      `${base}/contacts/${encodeURIComponent(a.contact.email)}?idProperty=email`,
      "PATCH",
      body,
    );
  if (!response.ok) {
    logger.error("HubSpot contact sync failed", {
      applicationId,
      status: response.status,
    });
    throw new Error("Contact could not be saved. Please retry shortly.");
  }
  const contact = await response.json();
  if (!contact?.id)
    throw new Error("Contact reference was not returned. Please retry.");
  response = await call(
    `${base}/notes`,
    "POST",
    JSON.stringify({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: formatted.html,
      },
      associations: [
        {
          to: { id: String(contact.id) },
          types: [
            { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 },
          ],
        },
      ],
    }),
  );
  if (!response.ok) {
    logger.error("HubSpot full application note failed", {
      applicationId,
      status: response.status,
    });
    throw new Error(
      "Your contact was saved, but the full application could not be stored. Please retry.",
    );
  }
  const note = await response.json();
  if (!note?.id)
    throw new Error("Full application receipt was not returned. Please retry.");
  return { contactId: String(contact.id), noteId: String(note.id) };
}
