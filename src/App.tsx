import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  FileText,
  Phone,
  Plus,
  Save,
  Shield,
  Trash2,
  Truck as TruckIcon,
  Upload,
} from "lucide-react";
import {
  accountTypes,
  banks,
  beeeLevels,
  documentTypes,
  initialData,
  newTruck,
  provinces,
  steps,
  vehicleTypes,
} from "./model";
import type { DocumentFile, FormData, Truck } from "./model";
import { fileError, validate } from "./validation.mjs";
type Errors = Record<string, string>;
const draftKey = "lope-hauler-session-v1";
const endpoint = "/api/submit";
const terms = import.meta.env.VITE_TERMS_TEXT as string | undefined;
const privacy = import.meta.env.VITE_PRIVACY_TEXT as string | undefined;
function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="mx-auto flex max-w-[896px] justify-center">
          <img
            src="/logo.png"
            alt="Lope Transport Services"
            className="h-10 w-auto object-contain"
          />
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="mx-6 mt-8 border-t border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
        © 2026 Lope Transport Services®. All rights reserved.
      </footer>
    </div>
  );
}
function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-lg font-medium">{title}</h3>
          {description && <p className="muted mt-2 mb-6">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export default function App() {
  const [data, setData] = useState<FormData>(initialData);
  const [step, setStep] = useState(0);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [docType, setDocType] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: string; demo: boolean } | null>(
    null,
  );
  const [saveDraft, setSaveDraft] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Draft saving off");
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(draftKey);
      if (stored) {
        const saved = JSON.parse(stored);
        if (saved.version === 1) {
          const base = initialData();
          const restored = { ...base };
          for (const key of Object.keys(base) as (keyof FormData)[]) {
            if (key === "trucks") {
              if (Array.isArray(saved.data.trucks) && saved.data.trucks.length)
                restored.trucks = saved.data.trucks
                  .filter((t: Truck) => t && typeof t.id === "string")
                  .map((t: Truck) => ({
                    ...newTruck(),
                    ...Object.fromEntries(
                      Object.keys(newTruck()).map((k) => [
                        k,
                        typeof t[k as keyof Truck] === "string"
                          ? t[k as keyof Truck]
                          : "",
                      ]),
                    ),
                  }));
            } else if (typeof saved.data[key] === typeof base[key])
              Object.assign(restored, { [key]: saved.data[key] });
          }
          if (!restored.trucks.length) restored.trucks = [newTruck()];
          setData(restored);
          setStep(Math.min(3, Math.max(0, Number(saved.step) || 0)));
          setSaveDraft(true);
          setStatus(
            "Draft restored. Reattach documents; files are not stored in the draft.",
          );
        }
      }
    } catch {
      setStatus("The saved draft could not be restored.");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (!saveDraft) {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
      setSaveStatus("Draft saving off");
      return;
    }
    setSaveStatus("Saving…");
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({ version: 1, data, step }),
        );
        setSaveStatus("Draft saved");
      } catch {
        setSaveStatus("Draft could not be saved");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [data, step, saveDraft, ready]);
  const update = (key: keyof FormData, value: string | boolean) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };
  const updateTruck = (id: string, key: keyof Truck, value: string) => {
    setData((d) => ({
      ...d,
      trucks: d.trucks.map((t) => (t.id === id ? { ...t, [key]: value } : t)),
    }));
    setErrors((e) => {
      const next = { ...e };
      delete next[`${id}.${key}`];
      return next;
    });
  };
  function Field({
    field,
    label,
    placeholder = "",
    options,
    hint,
    textarea = false,
    numeric = false,
    value,
    onChange,
    errorKey,
    required = true,
  }: {
    field: string;
    label: string;
    placeholder?: string;
    options?: string[];
    hint?: string;
    textarea?: boolean;
    numeric?: boolean;
    value?: string;
    onChange?: (v: string) => void;
    errorKey?: string;
    required?: boolean;
  }) {
    const id = field;
    const err = errors[errorKey || field];
    const current = value ?? String(data[field as keyof FormData] ?? "");
    const change = (v: string) =>
      onChange ? onChange(v) : update(field as keyof FormData, v);
    const common = {
      id,
      value: current,
      onChange: (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) => change(e.target.value),
      "aria-invalid": !!err,
      "aria-describedby":
        (hint ? `${id}-hint ` : "") + (err ? `${id}-error` : ""),
      required,
    };
    return (
      <div>
        <label className="field-label" htmlFor={id}>
          {label}
          {required && <span className="text-brand"> *</span>}
        </label>
        {options ? (
          <select {...common}>
            <option value="">
              {placeholder || `Select ${label.toLowerCase()}`}
            </option>
            {options.map((o) => (
              <option key={o} value={o}>
                {field.includes("-loadCapacity")
                  ? `${o} ${o === "1" ? "Ton" : "Tons"}`
                  : o}
              </option>
            ))}
          </select>
        ) : textarea ? (
          <textarea {...common} placeholder={placeholder} />
        ) : (
          <input
            {...common}
            placeholder={placeholder}
            type={
              field === "email"
                ? "email"
                : field === "mobileNumber"
                  ? "tel"
                  : "text"
            }
            inputMode={numeric ? "numeric" : undefined}
            autoComplete={
              field === "fullName"
                ? "name"
                : field === "email"
                  ? "email"
                  : field === "mobileNumber"
                    ? "tel"
                    : "off"
            }
          />
        )}{" "}
        {hint && (
          <p className="hint" id={`${id}-hint`}>
            {hint}
          </p>
        )}
        {err && (
          <p className="error" id={`${id}-error`}>
            {err}
          </p>
        )}
      </div>
    );
  }
  // Stable component identity prevents inputs losing focus when form state changes.
  const field = (props: Parameters<typeof Field>[0]) => Field(props);
  const go = (next: number) => {
    setStep(next);
    setErrors({});
    setStatus("");
    requestAnimationFrame(() => {
      card.current?.focus();
      card.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const next = () => {
    const e = validate(step, data, documents);
    setErrors(e);
    if (Object.keys(e).length) {
      setStatus("Please correct the highlighted fields.");
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    go(step + 1);
  };
  const addFiles = (files: File[]) => {
    if (!docType) {
      setStatus("Select a document type first.");
      return;
    }
    const accepted: DocumentFile[] = [];
    const messages: string[] = [];
    for (const file of files) {
      const error = fileError(file);
      if (error) {
        messages.push(`${file.name}: ${error}`);
        continue;
      }
      if (
        documents.some(
          (d) =>
            d.type === docType &&
            d.file.name === file.name &&
            d.file.size === file.size,
        )
      ) {
        messages.push(`${file.name} is already attached`);
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), type: docType, file });
    }
    setDocuments((d) => [...d, ...accepted]);
    setStatus(messages.join(". "));
    setErrors((e) => {
      const n = { ...e };
      if (accepted.length) delete n.documents;
      return n;
    });
  };
  const submit = async () => {
    for (let s = 0; s < 5; s++) {
      const e = validate(s, data, documents);
      if (Object.keys(e).length) {
        go(s);
        setErrors(e);
        setStatus("Please correct the highlighted fields.");
        return;
      }
    }
    if (endpoint && (!terms || !privacy)) {
      setStatus(
        "Submission is unavailable until the approved Terms of Use and Privacy Policy are configured.",
      );
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.fullName.trim(),
          email: data.email.trim(),
          phone: data.mobileNumber.replace(/[\s()-]/g, "").replace(/^0/, "+27"),
          company: data.registrationType === "business" ? data.businessName.trim() : "",
          consents: {
            terms: data.termsAccepted,
            processing: data.dataProcessingConsent,
            contact: data.contactConsent,
          },
        }),
      });
      const receipt = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          receipt?.message || `Sign-up submission failed (${response.status}). Please try again.`,
        );
      if (
        receipt?.success !== true ||
        typeof receipt?.applicationId !== "string" ||
        !receipt.applicationId.trim()
      )
        throw new Error(
          "The server did not return an application reference. Contact support before retrying.",
        );
      setResult({ id: receipt.applicationId, demo: false });
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Submission failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (result)
    return (
      <BrandLayout>
        <main className="max-w-2xl mx-auto p-6 pt-24 text-center">
          <CheckCircle className="text-brand mx-auto mb-6" size={56} />
          <h1 className="text-3xl font-bold">
            {result.demo
              ? "Application ready for integration"
              : "Sign-up submitted"}
          </h1>
          <p className="muted mt-4">
            {result.demo
              ? "All five steps passed local validation. No application has been sent. Configure the backend endpoint to enable real submission."
              : "Your contact sign-up was received. Keep your reference for future enquiries. Documents and other application details have not been sent."}
          </p>
          <p className="mt-6 font-semibold">Reference: {result.id}</p>
          <div className="flex justify-center gap-3 mt-8">
            {result.demo && (
              <button className="btn" onClick={() => setResult(null)}>
                Back to application
              </button>
            )}
            <button
              className="btn primary"
              onClick={() => {
                setResult(null);
                setData(initialData());
                setDocuments([]);
                go(0);
              }}
            >
              Start new application
            </button>
          </div>
        </main>
      </BrandLayout>
    );
  return (
    <BrandLayout>
      <main className="mx-auto max-w-[944px] px-6 pb-16">
        <header className="hero text-center pt-16 mb-16">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Hauler Registration
          </h1>
          <p className="muted text-lg md:text-xl max-w-[680px] mx-auto mt-6 leading-7">
            Join our network of professional haulers. Complete the registration
            process to start receiving delivery opportunities.
          </p>
        </header>
        <div className="flex justify-between gap-3 muted mb-8">
          <span>Step {step + 1} of 5</span>
          <div className="flex gap-3 items-center">
            <span className="text-xs flex items-center gap-1">
              <Save size={12} />
              {saveStatus}
            </span>
            <span className="text-brand">{step * 20}% Complete</span>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Registration progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={step * 20}
          className="h-2 bg-neutral-100 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${step * 20}%` }}
          />
        </div>
        <ol className="grid grid-cols-5 gap-2 mt-8 mb-14">
          {steps.map(([name, description], i) => (
            <li
              key={name}
              aria-current={i === step ? "step" : undefined}
              className="text-center"
            >
              <div className="mx-auto mb-3 w-8 h-8 flex items-center justify-center">
                {i < step ? (
                  <CheckCircle size={30} className="text-brand" />
                ) : i === step ? (
                  <span className="rounded-full bg-brand text-white w-8 h-8 grid place-items-center font-semibold">
                    {i + 1}
                  </span>
                ) : (
                  <span className="rounded-full border-[3px] border-neutral-500 w-[30px] h-[30px]" />
                )}
              </div>
              <p className={`step-label font-medium ${i > step ? "muted" : ""}`}>
                {name}
              </p>
              <p className="step-description muted text-xs mt-1 max-w-32 mx-auto">
                {description}
              </p>
            </li>
          ))}
        </ol>
        <article ref={card} tabIndex={-1} className="card scroll-mt-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            {steps[step][0]}
          </h2>
          <p className="muted text-base mt-2">{steps[step][1]}</p>
          {status && (
            <p
              role="status"
              className="mt-5 p-3 rounded border border-red-200 bg-red-50 text-red-800"
            >
              {status}
            </p>
          )}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 4) next();
              else void submit();
            }}
          >
            {step === 0 && (
              <>
                <Section
                  title="Personal Information"
                  description="Please provide your personal details as they appear on your official documents."
                >
                  <div className="grid md:grid-cols-2 gap-6">
                    {field({
                      field: "fullName",
                      label: "Full Name",
                      placeholder: "Enter your full name",
                    })}
                    {field({
                      field: "idNumber",
                      label: "ID or Passport Number",
                      placeholder: "Enter your ID or passport number",
                    })}
                  </div>
                </Section>
                <Section
                  title="Entity Type"
                  description="Select whether you are registering as an individual or business entity."
                >
                  <fieldset>
                    <legend className="field-label">
                      Registration Type <span className="text-brand">*</span>
                    </legend>
                    {["individual", "business"].map((type) => (
                      <label
                        key={type}
                        className={`flex items-start gap-3 border rounded-lg p-4 mb-4 cursor-pointer ${data.registrationType === type ? "border-brand bg-red-50/30" : "border-neutral-200"}`}
                      >
                        <input
                          type="radio"
                          name="registrationType"
                          value={type}
                          checked={data.registrationType === type}
                          onChange={() => update("registrationType", type)}
                          required
                        />
                        <span>
                          <span className="font-medium text-base capitalize">
                            {type}
                          </span>
                          <span className="block muted mt-1">
                            {type === "individual"
                              ? "Register as an individual hauler operating under your personal name"
                              : "Register as a business entity with a registered company name"}
                          </span>
                        </span>
                      </label>
                    ))}
                    {errors.registrationType && (
                      <p className="error">{errors.registrationType}</p>
                    )}
                  </fieldset>
                  {data.registrationType === "business" && (
                    <div className="grid md:grid-cols-2 gap-6 mt-6">
                      {field({
                        field: "businessName",
                        label: "Business Name",
                        placeholder: "Enter your registered business name",
                      })}
                      {field({
                        field: "beeeLevel",
                        label: "BEEE Level",
                        placeholder: "Select your BEEE level",
                        options: beeeLevels,
                        hint: "Your current B-BBEE certification level",
                      })}
                      {field({
                        field: "cipcRegistration",
                        label: "CIPC Registration Number",
                        placeholder: "Enter your CIPC registration number",
                        hint: "Your company registration number from CIPC",
                      })}
                    </div>
                  )}
                </Section>
                <Section
                  title="Contact Information"
                  description="Provide your contact details for communication regarding deliveries and account updates."
                >
                  <div className="grid md:grid-cols-2 gap-6">
                    {field({
                      field: "mobileNumber",
                      label: "Mobile Number",
                      placeholder: "e.g., +27 82 123 4567",
                      hint: "South African mobile number format required",
                    })}
                    {field({
                      field: "email",
                      label: "Email Address",
                      placeholder: "Enter your email address",
                    })}
                  </div>
                </Section>
                <Section
                  title="Address Information"
                  description="Your physical address is required for verification and delivery coordination purposes."
                >
                  <div className="space-y-6">
                    {field({
                      field: "physicalAddress",
                      label: "Physical Address",
                      textarea: true,
                      placeholder:
                        "Enter your complete physical address including street number, street name, suburb, and city",
                    })}
                    {field({
                      field: "province",
                      label: "Province",
                      placeholder: "Select your province",
                      options: provinces,
                    })}
                  </div>
                </Section>
              </>
            )}
            {step === 1 && (
              <Section
                title="Vehicle Details"
                description="Add details for each truck in your fleet. All vehicles must have a capacity between 1 and 15 tons."
                action={
                  <button
                    type="button"
                    className="btn shrink-0"
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        trucks: [...d.trucks, newTruck()],
                      }))
                    }
                  >
                    <Plus size={16} />
                    Add Truck
                  </button>
                }
              >
                <div className="space-y-6">
                  {data.trucks.map((truck, i) => (
                    <div key={truck.id} className="panel">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-lg font-medium flex gap-2 items-center">
                          <TruckIcon size={20} className="text-brand" />
                          Truck {i + 1}
                        </h4>
                        {data.trucks.length > 1 && (
                          <button
                            type="button"
                            className="btn"
                            aria-label={`Remove Truck ${i + 1}`}
                            onClick={() =>
                              setData((d) => ({
                                ...d,
                                trucks: d.trucks.filter((t) => t.id !== truck.id),
                              }))
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="grid md:grid-cols-2 gap-6">
                        {field({
                          field: `${truck.id}-vehicleType`,
                          label: "Vehicle Type",
                          placeholder: "Select vehicle type",
                          options: vehicleTypes,
                          value: truck.vehicleType,
                          onChange: (v) =>
                            updateTruck(truck.id, "vehicleType", v),
                          errorKey: `${truck.id}.vehicleType`,
                        })}
                        {field({
                          field: `${truck.id}-loadCapacity`,
                          label: "Load Capacity",
                          placeholder: "Select load capacity",
                          options: Array.from({ length: 15 }, (_, n) =>
                            String(n + 1),
                          ),
                          value: truck.loadCapacity,
                          onChange: (v) =>
                            updateTruck(truck.id, "loadCapacity", v),
                          errorKey: `${truck.id}.loadCapacity`,
                          hint: "Vehicle capacity must be between 1 and 15 tons",
                        })}
                      </div>
                      <h5 className="font-medium mt-7 mb-5">
                        Registration Numbers
                      </h5>
                      <div className="grid md:grid-cols-3 gap-4">
                        {(
                          [
                            "horseRegistration",
                            "trailer1Registration",
                            "trailer2Registration",
                          ] as const
                        ).map((k, n) => (
                          <div key={k}>
                            {field({
                              field: `${truck.id}-${k}`,
                              label:
                                n === 0
                                  ? "Horse Registration"
                                  : `Trailer ${n} Registration`,
                              placeholder: [
                                "e.g., ABC 123 GP",
                                "e.g., DEF 456 GP",
                                "e.g., GHI 789 GP",
                              ][n],
                              value: truck[k],
                              onChange: (v) => updateTruck(truck.id, k, v),
                              errorKey: `${truck.id}.${k}`,
                              required: n === 0,
                            })}
                          </div>
                        ))}
                      </div>
                      <p className="hint mt-4">
                        Horse registration is required. Trailer registrations are
                        optional but recommended if applicable.
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {step === 2 && (
              <Section
                title="Banking Information"
                description="Provide your banking details for payment processing. All payments will be made to this account."
              >
                <div className="grid md:grid-cols-2 gap-6">
                  {field({
                    field: "bankName",
                    label: "Bank Name",
                    placeholder: "Select your bank",
                    options: banks,
                  })}
                  {field({
                    field: "accountHolderName",
                    label: "Account Holder Name",
                    placeholder: "Enter account holder name",
                    hint: "Must match the name on your bank account",
                  })}
                  {field({
                    field: "accountNumber",
                    label: "Account Number",
                    placeholder: "Enter account number",
                    hint: "8-13 digits, numbers only",
                    numeric: true,
                  })}
                  {field({
                    field: "accountType",
                    label: "Account Type",
                    placeholder: "Select account type",
                    options: accountTypes,
                  })}
                  {field({
                    field: "branchCode",
                    label: "Branch Code",
                    placeholder: "Enter 6-digit branch code",
                    hint: "6-digit branch code from your bank",
                    numeric: true,
                  })}
                </div>
                <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-6 mt-8">
                  <h4 className="font-medium mb-2">Banking Requirements</h4>
                  <ul className="list-disc pl-4 muted space-y-1">
                    <li>
                      Account must be in your name or registered business name
                    </li>
                    <li>Account must be active and in good standing</li>
                    <li>
                      All banking details must match your provided documentation
                    </li>
                    <li>International accounts are not currently supported</li>
                  </ul>
                </div>
              </Section>
            )}
            {step === 3 && (
              <Section
                title="Upload Supporting Documents"
                description="Please upload all relevant documents for your hauler application. At least one document is required."
              >
                <label htmlFor="documentType" className="field-label">
                  Select Document Type
                </label>
                <select
                  id="documentType"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  <option value="">Choose document type before uploading</option>
                  {documentTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={!docType}
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={!docType}
                  className={`w-full mt-6 border-2 border-dashed rounded p-8 text-center ${dragging ? "border-brand bg-red-50" : "border-neutral-300 bg-neutral-50/40"}`}
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    addFiles(Array.from(e.dataTransfer.files));
                  }}
                >
                  <Upload size={42} className="mx-auto muted mb-5" />
                  <span className="block font-medium muted">
                    {docType
                      ? "Click to upload or drag and drop"
                      : "Select document type first"}
                  </span>
                  <span className="hint block">
                    Supports PDF, JPEG, PNG, WebP (max 10MB per file)
                  </span>
                </button>
                {errors.documents && (
                  <p className="error" role="alert">
                    {errors.documents}
                  </p>
                )}
                <ul className="space-y-3 mt-6">
                  {documents.map((d) => (
                    <li
                      key={d.id}
                      className="border rounded-lg p-4 flex items-center gap-3"
                    >
                      <FileText size={20} className="text-brand shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium break-all">{d.file.name}</p>
                        <p className="hint">
                          {d.type} · {(d.file.size / 1024).toFixed(0)} KB ·
                          Attached
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn"
                        aria-label={`Remove ${d.file.name}`}
                        onClick={() =>
                          setDocuments((files) =>
                            files.filter((f) => f.id !== d.id),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-6 mt-6">
                  <h4 className="font-medium mb-3">Document Guidelines</h4>
                  <ul className="list-disc pl-4 muted space-y-2">
                    <li>
                      Upload clear, legible copies of all relevant documents
                    </li>
                    <li>Ensure all text and details are clearly visible</li>
                    <li>Documents should be current and valid</li>
                    <li>Multiple files can be uploaded for each document type</li>
                    <li>At least one document must be uploaded to proceed</li>
                  </ul>
                </div>
              </Section>
            )}
            {step === 4 && (
              <>
                <Section
                  title="Terms and Conditions"
                  description="Please review and accept our terms and conditions to complete your registration."
                >
                  {Consent({
                    field: "termsAccepted",
                    title: "Terms of Use Agreement",
                    label: "I accept the Terms of Use",
                    description:
                      "By checking this box, you agree to our terms of service, hauler agreement, and platform policies.",
                    preview: "View Terms Preview",
                    text:
                      terms ||
                      "Preview only: approved terms have not been recovered. Configure VITE_TERMS_TEXT with the company-approved agreement before collecting real applications.",
                    icon: <FileText size={20} />,
                  })}
                </Section>
                <Section
                  title="Privacy and Data Consent"
                  description="We need your consent to store and process your personal information in accordance with privacy laws."
                >
                  {Consent({
                    field: "dataProcessingConsent",
                    title: "Data Processing Consent",
                    label: "I consent to data storage and processing",
                    description:
                      "We will store your personal information securely and use it only for hauler services, payments, and account management.",
                    preview: "View Privacy Policy Summary",
                    text:
                      privacy ||
                      "Preview only: the original privacy summary was not available. Configure VITE_PRIVACY_TEXT with an approved policy describing the actual data handling.",
                    icon: <Shield size={20} />,
                  })}
                  <div className="mt-8">
                    {Consent({
                      field: "contactConsent",
                      title: "Communication Preferences",
                      label: "I consent to be contacted",
                      description:
                        "We may contact you via phone, email, or SMS for delivery notifications, account updates, payment information, and customer support.",
                      icon: <Phone size={20} />,
                    })}
                  </div>
                </Section>
                <p className="hint mt-6">
                  Submission sends your name, email, phone and company to HubSpot.
                  Documents, banking, identity and vehicle details are not uploaded.
                </p>
              </>
            )}
            <div className="border-t border-neutral-200 mt-8 pt-8 flex justify-between gap-4">
              <button
                type="button"
                className="btn"
                disabled={step === 0 || busy}
                onClick={() => go(step - 1)}
              >
                <ArrowLeft size={16} />
                Previous
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy
                  ? "Submitting…"
                  : step === 4
                    ? "Submit Application"
                    : "Continue"}
                {step < 4 && <ArrowRight size={16} />}
              </button>
            </div>
          </form>
        </article>
        <label className="flex items-start gap-2 mt-6 muted text-xs">
          <input
            type="checkbox"
            checked={saveDraft}
            onChange={(e) => setSaveDraft(e.target.checked)}
          />
          <span>
            Save a draft in this browser tab. Identity and banking details remain
            on this device until the tab closes; attached files must be reselected
            after a reload.
          </span>
        </label>
      </main>
    </BrandLayout>
  );
  function Consent({
    field: consentField,
    title,
    label,
    description,
    preview,
    text,
    icon,
  }: {
    field: "termsAccepted" | "dataProcessingConsent" | "contactConsent";
    title: string;
    label: string;
    description: string;
    preview?: string;
    text?: string;
    icon: React.ReactNode;
  }) {
    return (
      <div className="panel">
        <h4 className="font-medium flex items-center gap-2 mb-4">
          <span className="text-brand">{icon}</span>
          {title}
        </h4>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={data[consentField]}
            onChange={(e) => update(consentField, e.target.checked)}
            aria-invalid={!!errors[consentField]}
            required
          />
          <span>
            <span className="font-medium">
              {label} <span className="text-brand">*</span>
            </span>
            <span className="hint block mt-2">{description}</span>
          </span>
        </label>
        {errors[consentField] && (
          <p className="error">{errors[consentField]}</p>
        )}
        {preview && (
          <details className="mt-5">
            <summary className="text-brand cursor-pointer">{preview}</summary>
            <p className="mt-4 muted whitespace-pre-line">{text}</p>
          </details>
        )}
      </div>
    );
  }
}
