import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maskDetails, maskEmail, maskIp, maskName, maskParticipant, maskPhone, redactForViewer, redactVisitForViewer } from "../../src/lib/redact";

describe("rôle lecture seule (F-04)", () => {
  it("redactForViewer retire IP, navigateur, empreinte et attributs d'appareil, garde le reste", () => {
    const row = { id: "x", ip_address: "1.2.3.4", user_agent: "Mozilla", device_hash: "ab".repeat(32), device_info: { mobile: true }, risk_score: 12 };
    assert.deepEqual(redactForViewer(row), { id: "x", ip_address: null, user_agent: null, device_hash: null, device_info: null, risk_score: 12 });
  });
  it("maskEmail / maskPhone", () => {
    assert.equal(maskEmail("jeanne@example.com"), "j***@example.com");
    assert.equal(maskEmail("bizarre"), "***");
    assert.equal(maskPhone("+33713554467"), "07 ** ** ** 67");
    assert.equal(maskPhone("n'importe quoi"), "** ** ** ** **");
    assert.deepEqual(maskParticipant({ pseudo: "Élo", email: "elo@x.fr", phone_number: "+33612345678", first_name: "Jeanne", last_name: null }), { pseudo: "Élo", email: "e***@x.fr", phone_number: "06 ** ** ** 78", first_name: "J***", last_name: null });
    assert.equal(maskName("Jeanne"), "J***");
    assert.equal(maskName(undefined), undefined);
  });
  it("maskIp : dernier octet masqué, IPv6 → ***", () => {
    assert.equal(maskIp("192.168.1.42"), "192.168.1.*");
    assert.equal(maskIp("2001:db8::1"), "***");
  });
  it("redactVisitForViewer retire IP, UA, empreinte et appareil", () => {
    assert.deepEqual(redactVisitForViewer({ id: "v", ip: "1.1.1.1", user_agent: "UA", device_hash: "h", device_info: { mobile: true }, path: "/" }), { id: "v", ip: null, user_agent: null, device_hash: null, device_info: null, path: "/" });
  });
});

describe("maskDetails (F-06 c : journal du backoffice)", () => {
  it("email, phone_number, first_name, last_name, password → « *** » ; le reste intact", () => {
    assert.deepEqual(maskDetails({ pseudo: "Élo", email: "e@x.fr", phone_number: "+33612345678", first_name: "A", last_name: "B", password: "secret", excluded: true }), {
      pseudo: "Élo",
      email: "***",
      phone_number: "***",
      first_name: "***",
      last_name: "***",
      password: "***",
      excluded: true,
    });
  });
  it("valeurs nulles, tableaux et scalaires inchangés", () => {
    assert.deepEqual(maskDetails({ email: null }), { email: null });
    assert.deepEqual(maskDetails([1, 2]), [1, 2]);
    assert.equal(maskDetails(null), null);
    assert.equal(maskDetails("x"), "x");
  });
});
