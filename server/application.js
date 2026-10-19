import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../application.schema.json" with { type: "json" };
import { validSAId } from "../src/validation.mjs";

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const check = ajv.compile(schema);
export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const types = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
export function withoutLinks(application) {
  const copy = structuredClone(application);
  if (Array.isArray(copy?.documents))
    copy.documents = copy.documents.map(({ url, ...doc }) => doc);
  return copy;
}
export function validateApplication(application) {
  const clean = withoutLinks(application);
  if (JSON.stringify(application).length > 50000 || !check(clean))
    throw new Error("Check all required application fields and formats.");
  if (clean.trucks.length > 20 || clean.documents.length > 20)
    throw new Error("A maximum of 20 trucks and 20 documents is supported.");
  if (clean.documents.reduce((n, d) => n + d.sizeBytes, 0) > 100 * 1024 * 1024)
    throw new Error("Combined documents must be 100 MB or smaller.");
  if (
    !clean.documents.every(
      (d) => uuid.test(d.id) && d.fileName.length <= 200,
    ) ||
    new Set(clean.documents.map((d) => d.id)).size !== clean.documents.length
  )
    throw new Error("Invalid document information.");
  const id = clean.applicant.idOrPassportNumber;
  if (/^\d{13}$/.test(id) && !validSAId(id))
    throw new Error("Enter a valid South African ID or passport number.");
  return clean;
}
export const digest = (application) =>
  createHash("sha256")
    .update(JSON.stringify(withoutLinks(application)))
    .digest("hex");
const mac = (value, secret) =>
  createHmac("sha256", secret)
    .update(`lope-application:${value}`)
    .digest("base64url");
export function signSession(application, secret, now = Date.now()) {
  const session = {
    id: randomUUID(),
    hash: digest(application),
    exp: now + 60 * 60 * 1000,
    documents: application.documents.map((d) => ({
      id: d.id,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
    })),
  };
  const value = Buffer.from(JSON.stringify(session)).toString("base64url");
  return { token: `${value}.${mac(value, secret)}`, applicationId: session.id };
}
export function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== "string" || token.length > 12000 || !secret)
    throw new Error("Invalid submission session.");
  const [value, signature, extra] = token.split(".");
  const expected = Buffer.from(mac(value || "", secret));
  const actual = Buffer.from(signature || "");
  if (
    extra ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  )
    throw new Error("Invalid submission session.");
  const session = JSON.parse(Buffer.from(value, "base64url").toString());
  if (!uuid.test(session.id) || session.exp < now)
    throw new Error("Submission session expired. Please retry.");
  return session;
}
export function guard(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, message: "Use POST." });
    return false;
  }
  let foreign = req.headers["sec-fetch-site"] === "cross-site";
  if (req.headers.origin) {
    try {
      foreign ||= new URL(req.headers.origin).host !== req.headers.host;
    } catch {
      foreign = true;
    }
  }
  if (foreign) {
    res
      .status(403)
      .json({ success: false, message: "Submit using the onboarding page." });
    return false;
  }
  if (!req.headers["content-type"]?.startsWith("application/json")) {
    res
      .status(415)
      .json({ success: false, message: "A JSON request is required." });
    return false;
  }
  return true;
}
export const signingSecret = (env) =>
  env.APPLICATION_SIGNING_SECRET || env.HUBSPOT_ACCESS_TOKEN;
