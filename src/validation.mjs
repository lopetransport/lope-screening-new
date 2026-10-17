export function validSAId(value) {
  if (!/^\d{13}$/.test(value)) return false;
  const year = Number(value.slice(0, 2)),
    month = Number(value.slice(2, 4)),
    day = Number(value.slice(4, 6));
  const fullYear =
    year <= new Date().getFullYear() % 100 ? 2000 + year : 1900 + year;
  const date = new Date(fullYear, month - 1, day);
  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date > new Date()
  )
    return false;
  if (!["0", "1"].includes(value[10])) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let n = Number(value[i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}
export const validPhone = (value) =>
  /^(?:0|\+27)[6-8]\d{8}$/.test(value.replace(/[\s()-]/g, ""));
export function validate(step, data, documents = []) {
  /** @type {Record<string,string>} */
  const errors = {};
  const required = (key, label) => {
    if (!String(data[key] ?? "").trim()) errors[key] = `${label} is required`;
  };
  if (step === 0) {
    for (const [k, l] of Object.entries({
      fullName: "Full name",
      idNumber: "ID/Passport number",
      registrationType: "Registration type",
      mobileNumber: "Mobile number",
      email: "Email",
      physicalAddress: "Physical address",
      province: "Province",
    }))
      required(k, l);
    if (
      data.idNumber &&
      (/^\d{13}$/.test(data.idNumber)
        ? !validSAId(data.idNumber)
        : !/^[A-Za-z0-9 -]{5,30}$/.test(data.idNumber))
    )
      errors.idNumber = "Enter a valid South African ID or passport number";
    if (data.mobileNumber && !validPhone(data.mobileNumber))
      errors.mobileNumber =
        "Enter a South African mobile number, e.g. +27 82 123 4567";
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))
      errors.email = "Enter a valid email address";
    if (data.registrationType === "business")
      for (const [k, l] of Object.entries({
        businessName: "Business name",
        beeeLevel: "BEEE Level",
        cipcRegistration: "CIPC Registration Number",
      }))
        required(k, l);
  }
  if (step === 1) {
    if (!data.trucks.length) errors.trucks = "At least one truck is required";
    data.trucks.forEach((t) => {
      for (const [k, l] of Object.entries({
        vehicleType: "Vehicle type",
        loadCapacity: "Load capacity",
        horseRegistration: "Horse registration",
      }))
        if (!t[k]?.trim()) errors[`${t.id}.${k}`] = `${l} is required`;
      if (
        t.loadCapacity &&
        (!Number.isInteger(Number(t.loadCapacity)) ||
          Number(t.loadCapacity) < 1 ||
          Number(t.loadCapacity) > 15)
      )
        errors[`${t.id}.loadCapacity`] =
          "Capacity must be between 1 and 15 tons";
    });
  }
  if (step === 2) {
    for (const [k, l] of Object.entries({
      bankName: "Bank name",
      accountHolderName: "Account holder name",
      accountNumber: "Account number",
      accountType: "Account type",
      branchCode: "Branch code",
    }))
      required(k, l);
    if (data.accountNumber && !/^\d{8,13}$/.test(data.accountNumber))
      errors.accountNumber = "Account number must contain 8–13 digits";
    if (data.branchCode && !/^\d{6}$/.test(data.branchCode))
      errors.branchCode = "Branch code must contain 6 digits";
  }
  if (step === 3 && !documents.length)
    errors.documents = "At least one document must be uploaded";
  if (step === 4)
    for (const [k, l] of Object.entries({
      termsAccepted: "Accept the Terms of Use",
      dataProcessingConsent: "Consent to data storage and processing",
      contactConsent: "Consent to be contacted",
    }))
      if (!data[k]) errors[k] = l;
  return errors;
}
export function fileError(file) {
  if (
    !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
      file.type,
    )
  )
    return "Supports PDF, JPEG, PNG and WebP only";
  if (file.size > 10 * 1024 * 1024) return "Each file must be 10 MB or smaller";
  if (file.size === 0) return "Empty files cannot be uploaded";
  return null;
}
