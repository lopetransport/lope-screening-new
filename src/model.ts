export const steps = [
  ["Basic Information", "Personal and contact details"],
  ["Vehicle Information", "Truck details and registration"],
  ["Banking Details", "Payment and account information"],
  ["Document Upload", "Supporting documents"],
  ["Terms & Consent", "Agreement and permissions"],
] as const;
export const provinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];
export const vehicleTypes = [
  "Bakkie/Light Delivery Vehicle",
  "Panel Van",
  "Truck (Rigid)",
  "Truck (Articulated)",
  "Flatbed Truck",
  "Refrigerated Truck",
  "Tipper Truck",
  "Other",
];
export const banks = [
  "ABSA Bank",
  "Standard Bank",
  "First National Bank (FNB)",
  "Nedbank",
  "Capitec Bank",
  "African Bank",
  "Investec Bank",
  "Discovery Bank",
  "TymeBank",
  "Bank Zero",
  "Bidvest Bank",
  "Sasfin Bank",
  "Other",
];
export const accountTypes = [
  "Current Account",
  "Savings Account",
  "Business Current Account",
  "Business Savings Account",
];
export const beeeLevels = [
  "Level 1 (135% B-BBEE recognition)",
  "Level 2 (125% B-BBEE recognition)",
  "Level 3 (110% B-BBEE recognition)",
  "Level 4 (100% B-BBEE recognition)",
  "Level 5 (80% B-BBEE recognition)",
  "Level 6 (60% B-BBEE recognition)",
  "Level 7 (50% B-BBEE recognition)",
  "Level 8 (10% B-BBEE recognition)",
  "Non-compliant (0% B-BBEE recognition)",
];
export const documentTypes = [
  "Vehicle Registration Certificate",
  "Driver's License",
  "Vehicle Insurance Certificate",
  "Roadworthy Certificate",
  "Bank Statement",
  "Bank Account Confirmation Letter",
  "ID Document / Passport",
  "Business Registration (CIPC)",
  "Tax Clearance Certificate",
  "Other Supporting Document",
];
export interface Truck {
  id: string;
  vehicleType: string;
  loadCapacity: string;
  horseRegistration: string;
  trailer1Registration: string;
  trailer2Registration: string;
}
export interface DocumentFile {
  id: string;
  type: string;
  file: File;
}
export interface FormData {
  fullName: string;
  idNumber: string;
  registrationType: string;
  businessName: string;
  beeeLevel: string;
  cipcRegistration: string;
  mobileNumber: string;
  email: string;
  physicalAddress: string;
  province: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  accountType: string;
  branchCode: string;
  termsAccepted: boolean;
  dataProcessingConsent: boolean;
  contactConsent: boolean;
  trucks: Truck[];
}
export const newTruck = (): Truck => ({
  id: crypto.randomUUID(),
  vehicleType: "",
  loadCapacity: "",
  horseRegistration: "",
  trailer1Registration: "",
  trailer2Registration: "",
});
export const initialData = (): FormData => ({
  fullName: "",
  idNumber: "",
  registrationType: "",
  businessName: "",
  beeeLevel: "",
  cipcRegistration: "",
  mobileNumber: "",
  email: "",
  physicalAddress: "",
  province: "",
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  accountType: "",
  branchCode: "",
  termsAccepted: false,
  dataProcessingConsent: false,
  contactConsent: false,
  trucks: [newTruck()],
});
export function payload(data: FormData, documents: DocumentFile[]) {
  return {
    schemaVersion: "1.0",
    applicant: {
      fullName: data.fullName.trim(),
      idOrPassportNumber: data.idNumber.trim(),
      registrationType: data.registrationType,
      business:
        data.registrationType === "business"
          ? {
              name: data.businessName.trim(),
              beeeLevel: data.beeeLevel,
              cipcRegistrationNumber: data.cipcRegistration.trim(),
            }
          : null,
    },
    contact: {
      mobileNumber: data.mobileNumber
        .replace(/[\s()-]/g, "")
        .replace(/^0/, "+27"),
      email: data.email.trim(),
      physicalAddress: data.physicalAddress.trim(),
      province: data.province,
    },
    trucks: data.trucks.map(({ id, ...truck }) => ({
      ...truck,
      loadCapacityTons: Number(truck.loadCapacity),
      loadCapacity: undefined,
    })),
    banking: {
      bankName: data.bankName,
      accountHolderName: data.accountHolderName.trim(),
      accountNumber: data.accountNumber,
      accountType: data.accountType,
      branchCode: data.branchCode,
    },
    documents: documents.map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.file.name,
      mimeType: d.file.type,
      sizeBytes: d.file.size,
      multipartField: `document_${d.id}`,
    })),
    consents: {
      termsAccepted: data.termsAccepted,
      dataProcessing: data.dataProcessingConsent,
      contact: data.contactConsent,
      termsVersion: "1.0",
      privacyVersion: "1.0",
    },
    clientSubmittedAt: new Date().toISOString(),
  };
}
