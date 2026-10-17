import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fileError,
  validate,
  validPhone,
  validSAId,
} from "../src/validation.mjs";
test("SA mobile formatting accepts local and international and rejects foreign numbers", () => {
  assert.ok(validPhone("082 123 4567"));
  assert.ok(validPhone("+27 82 123 4567"));
  assert.equal(validPhone("+44 82 123 4567"), false);
  assert.equal(validPhone("0211234567"), false);
});
test("SA ID catches checksum and impossible dates", () => {
  assert.ok(validSAId("8001015009087"));
  assert.equal(validSAId("8001015009088"), false);
  assert.equal(validSAId("8002315009087"), false);
});
test("business requires conditional fields; individual does not", () => {
  const base = {
    fullName: "Demo",
    idNumber: "DEMO12345",
    registrationType: "individual",
    mobileNumber: "0821234567",
    email: "demo@example.com",
    physicalAddress: "Demo",
    province: "Gauteng",
  };
  assert.deepEqual(validate(0, base), {});
  assert.ok(
    validate(0, { ...base, registrationType: "business" }).cipcRegistration,
  );
});
test("capacity and bank digits enforce bounds and preserve leading zeros", () => {
  assert.ok(
    validate(1, {
      trucks: [
        {
          id: "a",
          vehicleType: "Truck",
          loadCapacity: "16",
          horseRegistration: "ABC",
        },
      ],
    })["a.loadCapacity"],
  );
  const bank = {
    bankName: "ABSA Bank",
    accountHolderName: "Demo",
    accountNumber: "00000000",
    accountType: "Current Account",
    branchCode: "000000",
  };
  assert.deepEqual(validate(2, bank), {});
  assert.ok(validate(2, { ...bank, branchCode: "00000" }).branchCode);
});
test("documents and all three consents gate progression", () => {
  assert.ok(validate(3, {}, []).documents);
  assert.deepEqual(
    validate(4, {
      termsAccepted: true,
      dataProcessingConsent: true,
      contactConsent: true,
    }),
    {},
  );
  assert.ok(
    validate(4, {
      termsAccepted: true,
      dataProcessingConsent: true,
      contactConsent: false,
    }).contactConsent,
  );
});
test("file handling rejects unsupported, oversized and empty uploads", () => {
  assert.equal(fileError({ type: "application/pdf", size: 100 }), null);
  assert.ok(fileError({ type: "text/plain", size: 100 }));
  assert.ok(fileError({ type: "image/png", size: 10485761 }));
  assert.ok(fileError({ type: "image/png", size: 0 }));
});
