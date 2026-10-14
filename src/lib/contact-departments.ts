/** Contact department categories and conditional subtypes. */

export const CONTACT_DEPARTMENTS = [
  { value: "architect", label: "Architect" },
  { value: "consultant", label: "Consultant" },
  { value: "contractor", label: "Contractor" },
  { value: "management_company", label: "Management company" },
  { value: "builder", label: "Builder" },
  { value: "hospitals", label: "Hospitals" },
  { value: "institutions", label: "Institutions" },
  { value: "hospitality", label: "Hospitality" },
  { value: "gov", label: "Gov" },
  { value: "others", label: "Others" },
] as const;

export type ContactDepartment =
  (typeof CONTACT_DEPARTMENTS)[number]["value"];

export const CONTACT_DEPARTMENT_SUBTYPES: Partial<
  Record<ContactDepartment, { value: string; label: string }[]>
> = {
  contractor: [
    { value: "GC", label: "GC" },
    { value: "MEP", label: "MEP" },
    { value: "HVAC", label: "HVAC" },
    { value: "others", label: "Others" },
  ],
  gov: [
    { value: "CPWD", label: "CPWD" },
    { value: "PWD", label: "PWD" },
    { value: "others", label: "Others" },
  ],
  management_company: [
    { value: "PMC", label: "PMC" },
    { value: "FMC", label: "FMC" },
    { value: "others", label: "Others" },
  ],
};

export function departmentLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const found = CONTACT_DEPARTMENTS.find((d) => d.value === value);
  if (found) return found.label;
  // Legacy free-text values
  return value;
}

export function departmentSubtypeLabel(
  department: string | null | undefined,
  subtype: string | null | undefined,
): string {
  if (!subtype) return "";
  const options =
    department && department in CONTACT_DEPARTMENT_SUBTYPES
      ? CONTACT_DEPARTMENT_SUBTYPES[department as ContactDepartment]
      : undefined;
  const found = options?.find((o) => o.value === subtype);
  return found?.label ?? subtype;
}

export function formatDepartmentDisplay(
  department: string | null | undefined,
  subtype?: string | null,
): string {
  const main = departmentLabel(department);
  if (main === "—") return "—";
  const sub = departmentSubtypeLabel(department, subtype);
  return sub ? `${main} · ${sub}` : main;
}

export function subtypesForDepartment(
  department: string | null | undefined,
): { value: string; label: string }[] {
  if (!department) return [];
  return CONTACT_DEPARTMENT_SUBTYPES[department as ContactDepartment] ?? [];
}
