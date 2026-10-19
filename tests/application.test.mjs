import { test } from "node:test";
import assert from "node:assert/strict";
import example from "../example-payload.json" with { type: "json" };
import {
  validateApplication,
  signSession,
  verifySession,
  digest,
} from "../server/application.js";
import { formatApplication, dispatchEmail } from "../server/email.js";
import { saveApplication } from "../server/crm.js";
import { authorizeUpload } from "../server/upload.js";
import { createSubmissionHandler } from "../server/submission.js";

const docId = "76a701f8-fb02-47a1-bbe8-c068cd5d3a40";
const makeApplication = () => {
  const a = structuredClone(example);
  a.documents[0].id = docId;
  a.documents[0].multipartField = `document_${docId}`;
  return a;
};
const env = {
  HUBSPOT_ACCESS_TOKEN: "test-token",
  BLOB_READ_WRITE_TOKEN: "blob-test-token",
};
const logger = { error() {}, warn() {} };
function request(body) {
  return {
    method: "POST",
    headers: { host: "example.com", "content-type": "application/json" },
    body,
  };
}
function response() {
  return {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(n) {
      this.code = n;
      return this;
    },
    json(v) {
      this.data = v;
      return this;
    },
  };
}
function linkedApplication() {
  const a = makeApplication();
  const session = signSession(a, env.HUBSPOT_ACCESS_TOKEN);
  a.documents[0].url = `https://teststore.public.blob.vercel-storage.com/applications/${session.applicationId}/${docId}-random.pdf`;
  return { a, session };
}

test("full application validation covers banking, fleet, business, required files and sizes", () => {
  const a = makeApplication();
  assert.equal(validateApplication(a).banking.accountNumber, "00000000");
  assert.throws(() =>
    validateApplication({
      ...a,
      banking: { ...a.banking, accountNumber: "bad" },
    }),
  );
  assert.throws(() => validateApplication({ ...a, documents: [] }));
  assert.throws(() =>
    validateApplication({
      ...a,
      trucks: [{ ...a.trucks[0], loadCapacityTons: 16 }],
    }),
  );
  assert.throws(() =>
    validateApplication({
      ...a,
      applicant: { ...a.applicant, registrationType: "business" },
    }),
  );
  assert.throws(() =>
    validateApplication({
      ...a,
      documents: [{ ...a.documents[0], sizeBytes: 10485761 }],
    }),
  );
});
test("signed upload sessions cannot be forged, changed or used after expiry", () => {
  const a = makeApplication();
  const s = signSession(a, "secret", 1000);
  assert.equal(verifySession(s.token, "secret", 2000).hash, digest(a));
  assert.throws(() => verifySession(s.token, "wrong", 2000));
  assert.throws(() => verifySession(s.token, "secret", 3601001));
  assert.notEqual(
    digest({ ...a, contact: { ...a.contact, email: "other@example.com" } }),
    digest(a),
  );
});
test("upload permit pins path, type, file size and prevents overwrite", () => {
  const a = makeApplication();
  const s = signSession(a, env.HUBSPOT_ACCESS_TOKEN);
  const permit = authorizeUpload(
    `applications/${s.applicationId}/${docId}`,
    JSON.stringify({ token: s.token, documentId: docId }),
    env,
  );
  assert.equal(permit.maximumSizeInBytes, 100);
  assert.deepEqual(permit.allowedContentTypes, ["application/pdf"]);
  assert.equal(permit.allowOverwrite, false);
  assert.throws(() =>
    authorizeUpload(
      "elsewhere",
      JSON.stringify({ token: s.token, documentId: docId }),
      env,
    ),
  );
});
test("email includes applicant, company, ID, every fleet/bank/consent field and direct document links; escapes HTML", () => {
  const { a, session } = linkedApplication();
  a.applicant.fullName = "<script>alert(1)</script>";
  a.applicant.registrationType = "business";
  a.applicant.business = {
    name: "Demo Fleet",
    beeeLevel: "Level 1",
    cipcRegistrationNumber: "CIPC123",
  };
  a.trucks.push({
    ...a.trucks[0],
    horseRegistration: "SECOND GP",
    trailer1Registration: "TRAILER1",
    trailer2Registration: "TRAILER2",
  });
  const mail = formatApplication(a, session.applicationId);
  for (const value of [
    "DEMO12345",
    "Demo Fleet",
    "CIPC123",
    "SECOND GP",
    "TRAILER1",
    "TRAILER2",
    "00000000",
    "000000",
    a.documents[0].url,
  ])
    assert.ok(mail.text.includes(value));
  assert.ok(!mail.html.includes("<script>"));
  assert.ok(mail.html.includes("&lt;script&gt;"));
});
test("Resend targets operations and uses stable idempotency key", async () => {
  const { a, session } = linkedApplication();
  const formatted = formatApplication(a, session.applicationId);
  const status = await dispatchEmail(a, session.applicationId, formatted, {
    env: { RESEND_API_KEY: "email-test-token" },
    logger,
    fetchEmail: async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(
        options.headers["Idempotency-Key"],
        `lope-application/${session.applicationId}`,
      );
      const mail = JSON.parse(options.body);
      assert.deepEqual(mail.to, ["ops@lopetransport.co.za"]);
      assert.equal(mail.text, formatted.text);
      assert.equal(mail.reply_to, a.contact.email);
      return new Response('{"id":"mail-123"}', { status: 200 });
    },
  });
  assert.equal(status, "accepted");
});
test("missing email key and provider failure fall back cleanly without logging application details", async () => {
  const { a, session } = linkedApplication();
  const entries = [];
  const log = {
    warn: (...x) => entries.push(x),
    error: (...x) => entries.push(x),
  };
  assert.equal(
    await dispatchEmail(
      a,
      session.applicationId,
      formatApplication(a, session.applicationId),
      { env: {}, logger: log, fetchEmail: async () => assert.fail() },
    ),
    "not_configured",
  );
  assert.equal(
    await dispatchEmail(
      a,
      session.applicationId,
      formatApplication(a, session.applicationId),
      {
        env: { RESEND_API_KEY: "test" },
        logger: log,
        fetchEmail: async () =>
          new Response("private upstream error", { status: 500 }),
      },
    ),
    "failed",
  );
  const captured = JSON.stringify(entries);
  assert.ok(!captured.includes(a.contact.email));
  assert.ok(!captured.includes(a.banking.accountNumber));
});
test("HubSpot contact conflict updates existing contact, then saves associated full application note", async () => {
  const { a, session } = linkedApplication();
  const calls = [];
  const crm = await saveApplication(
    a,
    session.applicationId,
    formatApplication(a, session.applicationId),
    {
      token: "test",
      logger,
      fetchCRM: async (url, options) => {
        calls.push({ url, options });
        if (calls.length === 1) return new Response("{}", { status: 409 });
        return new Response(
          JSON.stringify({
            id: calls.length === 2 ? "contact-123" : "note-456",
          }),
          { status: 201 },
        );
      },
    },
  );
  assert.equal(calls[1].options.method, "PATCH");
  assert.ok(calls[1].url.endsWith("?idProperty=email"));
  assert.equal(crm.noteId, "note-456");
  const note = JSON.parse(calls[2].options.body);
  assert.equal(note.associations[0].to.id, "contact-123");
  assert.equal(note.associations[0].types[0].associationTypeId, 202);
  assert.ok(note.properties.hs_note_body.includes(a.documents[0].url));
});
test("prepare rejects missing storage and returns a scoped session without requiring email key", async () => {
  let res = response();
  await createSubmissionHandler({
    env: { HUBSPOT_ACCESS_TOKEN: "test" },
    logger,
  })(request({ action: "prepare", application: makeApplication() }), res);
  assert.equal(res.code, 503);
  res = response();
  await createSubmissionHandler({ env, logger })(
    request({ action: "prepare", application: makeApplication() }),
    res,
  );
  assert.equal(res.code, 200);
  assert.ok(res.data.token);
  assert.ok(res.data.applicationId);
});
test("finalize verifies uploads, saves full application, and reports missing email key truthfully", async () => {
  const { a, session } = linkedApplication();
  let stored;
  const handler = createSubmissionHandler({
    env,
    logger,
    inspectBlob: async (url) => ({
      url,
      pathname: `applications/${session.applicationId}/${docId}-random.pdf`,
      size: 100,
      contentType: "application/pdf",
    }),
    saveCRM: async (application) => {
      stored = application;
      return { contactId: "c", noteId: "n" };
    },
    sendEmail: async () => "not_configured",
  });
  const res = response();
  await handler(
    request({ action: "finalize", application: a, token: session.token }),
    res,
  );
  assert.equal(res.data.success, true);
  assert.equal(res.data.emailNotification, "not_configured");
  assert.equal(res.data.documentsReceived, 1);
  assert.equal(stored.banking.accountNumber, "00000000");
});
test("tampered payload, foreign URL or mismatched upload cannot reach CRM or email", async () => {
  const { a, session } = linkedApplication();
  for (const mode of ["changed", "foreign", "size"]) {
    const app = structuredClone(a);
    if (mode === "changed") app.banking.branchCode = "123456";
    if (mode === "foreign") app.documents[0].url = "https://evil.example/file";
    const res = response();
    await createSubmissionHandler({
      env,
      logger,
      inspectBlob: async (url) => ({
        url,
        pathname: `applications/${session.applicationId}/${docId}-random.pdf`,
        size: 999,
        contentType: "application/pdf",
      }),
      saveCRM: async () => assert.fail("Must not save invalid application"),
      sendEmail: async () => assert.fail("Must not email invalid application"),
    })(
      request({ action: "finalize", application: app, token: session.token }),
      res,
    );
    assert.equal(res.data.success, false);
    assert.equal(res.code, 400);
  }
});
test("CRM failure never displays successful receipt or attempts email", async () => {
  const { a, session } = linkedApplication();
  const res = response();
  await createSubmissionHandler({
    env,
    logger,
    inspectBlob: async (url) => ({
      url,
      pathname: `applications/${session.applicationId}/${docId}-random.pdf`,
      size: 100,
      contentType: "application/pdf",
    }),
    saveCRM: async () => {
      throw Error("Private CRM error");
    },
    sendEmail: async () => assert.fail(),
  })(
    request({ action: "finalize", application: a, token: session.token }),
    res,
  );
  assert.equal(res.code, 502);
  assert.equal(res.data.success, false);
  assert.ok(!res.data.message.includes("Private CRM error"));
});
