import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyIp, inRanges, ipNetwork } from "../../src/lib/ip-class";

describe("ipNetwork", () => {
  it("garde l'IPv4 exacte, jamais le /24", () => {
    assert.equal(ipNetwork("203.0.113.7"), "203.0.113.7");
    assert.equal(ipNetwork(" 203.0.113.7 "), "203.0.113.7");
  });
  it("réduit l'IPv6 à son /64 en forme canonique", () => {
    assert.equal(ipNetwork("2001:0DB8:0001:0002:aaaa:bbbb:cccc:dddd"), "2001:db8:1:2::/64");
    assert.equal(ipNetwork("2001:db8:0:0:1::1"), "2001:db8::/64");
    assert.equal(ipNetwork("2001:db8:1:2::9"), ipNetwork("2001:db8:1:2:ffff::1"));
  });
  it("traite l'IPv4 mappée comme une IPv4", () => {
    assert.equal(ipNetwork("::ffff:203.0.113.7"), "203.0.113.7");
    assert.equal(ipNetwork("::ffff:cb00:7107"), "203.0.113.7");
  });
  it("rend null si l'IP est absente ou invalide", () => {
    for (const ip of [null, "", "abc", "256.1.1.1", "1.2.3", "2001:db8::1::2", "fe80::1%eth0"]) assert.equal(ipNetwork(ip), null, String(ip));
  });
});

describe("inRanges (recherche dichotomique)", () => {
  const v4 = { starts: [10, 100, 1000], ends: [20, 100, 2000] };
  it("IPv4 : bornes incluses, juste avant, juste après", () => {
    for (const x of [10, 15, 20, 100, 1000, 2000]) assert.equal(inRanges(v4, x), true, String(x));
    for (const x of [0, 9, 21, 99, 101, 999, 2001]) assert.equal(inRanges(v4, x), false, String(x));
    assert.equal(inRanges({ starts: [], ends: [] }, 5), false);
  });
  const big = BigInt;
  const v6 = { starts: [big("0x20010db800000000"), big("0x2a0226f7c9d40000")], ends: [big("0x20010db8ffffffff"), big("0x2a0226f7c9d4ffff")] };
  it("IPv6 : bornes incluses, juste avant, juste après", () => {
    for (const x of ["0x20010db800000000", "0x20010db8ffffffff", "0x2a0226f7c9d465a9"]) assert.equal(inRanges(v6, big(x)), true, x);
    for (const x of ["0x20010db7ffffffff", "0x20010db900000000", "0x2a0226f7c9d3ffff", "0x2a0226f7c9d50000"]) assert.equal(inRanges(v6, big(x)), false, x);
  });
});

describe("classifyIp", () => {
  it("IP absente ou invalide : unknown", () => {
    assert.equal(classifyIp(null, null), "unknown");
    assert.equal(classifyIp("pas une ip", new Set()), "unknown");
  });
  it("sortie Tor via la liste fournie, y compris en IPv4 mappée", () => {
    const tor = new Set(["185.220.100.242", "2001:db8::5"]);
    assert.equal(classifyIp("185.220.100.242", tor), "tor");
    assert.equal(classifyIp("::ffff:185.220.100.242", tor), "tor");
    assert.equal(classifyIp("2001:0db8:0:0:0:0:0:5", tor), "tor");
    assert.notEqual(classifyIp("185.220.100.242", null), "tor");
  });
  it("iCloud Private Relay (adresses réelles de la liste Apple) : relay, jamais hosting", () => {
    for (const ip of ["172.225.116.162", "172.225.116.163", "172.224.226.0", "172.224.226.31", "2a02:26f7:c9d4:65a9::1", "2a02:26f7:c9c0:1::9", "::ffff:172.225.116.162"]) {
      assert.equal(classifyIp(ip, null), "relay", ip);
    }
  });
  it("opérateurs français (Free Mobile, Orange) : jamais hosting", () => {
    for (const ip of ["37.166.1.1", "92.184.100.1"]) assert.equal(classifyIp(ip, null), "normal", ip);
  });
  it("cloud et hébergeurs : hosting", () => {
    for (const ip of ["3.5.140.10", "57.129.120.182", "::ffff:3.5.140.10"]) assert.equal(classifyIp(ip, null), "hosting", ip);
  });
  it("IP privées et locales : normal", () => {
    for (const ip of ["10.0.0.1", "192.168.1.10", "127.0.0.1", "172.16.5.4", "::1", "fd12:3456::1", "fe80::1"]) assert.equal(classifyIp(ip, null), "normal", ip);
  });
});
