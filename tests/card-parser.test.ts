import { describe, expect, it } from "vitest";
import { parseBusinessCard } from "@/lib/card-parser";

const SAMPLE_CARD = `
AIRTECH SOLUTIONS PVT LTD
Rohan Mehta
Senior Sales Manager
Mobile: +91 98765 43210
Ph: 022 4567 8900
Email: rohan.mehta@airtechsolutions.in
www.airtechsolutions.in
linkedin.com/in/rohanmehta
Plot 42, MIDC Industrial Estate, Andheri East
Mumbai 400093
`;

describe("parseBusinessCard", () => {
  const parsed = parseBusinessCard(SAMPLE_CARD);

  it("extracts the person name, not the company", () => {
    expect(parsed.name).toBe("Rohan Mehta");
  });

  it("extracts designation and company", () => {
    expect(parsed.designation).toBe("Senior Sales Manager");
    expect(parsed.company).toBe("AIRTECH SOLUTIONS PVT LTD");
  });

  it("extracts email and website separately", () => {
    expect(parsed.email).toBe("rohan.mehta@airtechsolutions.in");
    expect(parsed.website).toBe("https://www.airtechsolutions.in");
  });

  it("normalizes phone numbers and picks a distinct whatsapp number", () => {
    expect(parsed.phone).toBe("+919876543210");
    expect(parsed.whatsapp).toBe("02245678900");
  });

  it("captures social links", () => {
    expect(parsed.linkedinUrl).toBe("https://linkedin.com/in/rohanmehta");
  });

  it("collects address lines", () => {
    expect(parsed.address).toContain("MIDC Industrial Estate");
  });

  it("prefers an explicitly labelled whatsapp number", () => {
    const result = parseBusinessCard(
      "Priya Sharma\nDirector\nPhone: 080 2345 6789\nWhatsApp: +91 90000 11111",
    );
    expect(result.whatsapp).toBe("+919000011111");
    expect(result.phone).toBe("08023456789");
  });

  it("falls back to the email local part when no name line is readable", () => {
    const result = parseBusinessCard("SOME GARBLED 12345\nanita.rao@example.com");
    expect(result.name).toBe("Anita Rao");
  });

  it("returns empty fields for empty input", () => {
    const result = parseBusinessCard("");
    expect(result.name).toBe("");
    expect(result.email).toBe("");
    expect(result.phone).toBe("");
  });
});
