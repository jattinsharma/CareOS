/**
 * End-to-end verification of the CareOS Firebase setup:
 *  - Email/password signup (Firebase Auth)
 *  - Firestore security rules (group membership, invite-code lookup, validation)
 *  - Cleans up all test users and documents afterwards.
 *
 * Run: node scripts/e2e-firebase-test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");
const env = fs.readFileSync(envPath, "utf8");

function envVar(name) {
  const match = env.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`Missing ${name} in .env.local`);
  return match[1].trim();
}

const API_KEY = envVar("NEXT_PUBLIC_FIREBASE_API_KEY");
const PROJECT = envVar("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const AUTH_BASE = "https://identitytoolkit.googleapis.com/v1";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function signUp(email, password) {
  const res = await fetch(`${AUTH_BASE}/accounts:signUp?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`signUp failed: ${JSON.stringify(data)}`);
  return data; // { idToken, localId, ... }
}

async function deleteUser(idToken) {
  await fetch(`${AUTH_BASE}/accounts:delete?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

async function fsGet(path, token) {
  const res = await fetch(`${FS_BASE}/${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function fsPost(collectionPath, fields, token) {
  const res = await fetch(`${FS_BASE}/${collectionPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ fields }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function fsRunQuery(collectionPath, where, token) {
  const res = await fetch(`${FS_BASE}:runQuery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collectionPath }], where } }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function fsDelete(path, token) {
  await fetch(`${FS_BASE}/${path}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
}

const str = (v) => ({ stringValue: v });
const arr = (values) => ({ arrayValue: { values } });

const unique = Date.now().toString(36);
let userA, userB, groupId, medId;

try {
  // ---------- 1. Email/password signup ----------
  userA = await signUp(`test.a.${unique}@careos.test`, "TestCareos2026!");
  userB = await signUp(`test.b.${unique}@careos.test`, "TestCareos2026!");
  check("Email/password signup works (2 users created)", !!userA.idToken && !!userB.idToken, `uids ${userA.localId.slice(0, 6)}… / ${userB.localId.slice(0, 6)}…`);

  // ---------- 2. Create family group as user A ----------
  const created = await fsPost(
    "familyGroups",
    {
      name: str("Test Family"),
      createdBy: str(userA.localId),
      members: arr([str(userA.localId)]),
      inviteCode: str("TST7QX"),
      createdAt: str("2026-08-07T00:00:00.000Z"),
    },
    userA.idToken
  );
  groupId = created.body?.name?.split("/").pop();
  check("Create family group (valid doc) succeeds", created.status === 200, `id ${groupId}`);
  // Malformed create must be rejected by validation rules
  const bad = await fsPost(
    "familyGroups",
    { name: str("Bad"), createdBy: str(userB.localId), members: arr([str(userB.localId)]), inviteCode: str("BAD"), createdAt: str("nope") },
    userB.idToken
  );
  check("Malformed group create rejected by rules (bad inviteCode/date)", bad.status === 403, `status ${bad.status}`);

  // ---------- 3. Read rules ----------
  const getA = await fsGet(`familyGroups/${groupId}`, userA.idToken);
  check("Member can read their group", getA.status === 200);
  const getB = await fsGet(`familyGroups/${groupId}`, userB.idToken);
  check("Non-member cannot read group (403)", getB.status === 403, `status ${getB.status}`);
  const getAnon = await fsGet(`familyGroups/${groupId}`, null);
  check("Anonymous cannot read group (403)", getAnon.status === 403, `status ${getAnon.status}`);

  // ---------- 4. Invite-code lookup (join flow) ----------
  const lookup = await fsRunQuery(
    "familyGroups",
    { fieldFilter: { field: { fieldPath: "inviteCode" }, op: "EQUAL", value: str("TST7QX") } },
    userB.idToken
  );
  const foundViaCode = Array.isArray(lookup.body) && lookup.body.some((d) => d.document?.name?.includes(groupId));
  check("Invite-code lookup allowed for non-member", lookup.status === 200 && foundViaCode, `status ${lookup.status}${lookup.status !== 200 ? " — " + JSON.stringify(lookup.body).slice(0, 300) : ""}`);

  // ---------- 4b. List queries (members array-contains) ----------
  const ownList = await fsRunQuery(
    "familyGroups",
    { fieldFilter: { field: { fieldPath: "members" }, op: "ARRAY_CONTAINS", value: str(userA.localId) } },
    userA.idToken
  );
  const foundOwn = Array.isArray(ownList.body) && ownList.body.some((d) => d.document?.name?.includes(groupId));
  check("Member can list own group (members array-contains)", ownList.status === 200 && foundOwn, `status ${ownList.status}`);
  const crossList = await fsRunQuery(
    "familyGroups",
    { fieldFilter: { field: { fieldPath: "members" }, op: "ARRAY_CONTAINS", value: str(userA.localId) } },
    userB.idToken
  );
  check("Cannot list another user's group via members query (403)", crossList.status === 403, `status ${crossList.status}`);

  // ---------- 5. Join group (self-join only) ----------
  const join = await fetch(`${FS_BASE}/familyGroups/${groupId}?updateMask.fieldPaths=members`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userB.idToken}` },
    body: JSON.stringify({
      fields: {
        name: str("Test Family"),
        createdBy: str(userA.localId),
        members: arr([str(userA.localId), str(userB.localId)]),
        inviteCode: str("TST7QX"),
        createdAt: str("2026-08-07T00:00:00.000Z"),
      },
    }),
  });
  check("Non-member can join by adding self", join.status === 200, `status ${join.status}`);

  // Join attempt that removes the creator must fail (members lockdown)
  const maliciousJoin = await fetch(`${FS_BASE}/familyGroups/${groupId}?updateMask.fieldPaths=members`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userB.idToken}` },
    body: JSON.stringify({
      fields: {
        name: str("Test Family"),
        createdBy: str(userA.localId),
        members: arr([str(userB.localId)]),
        inviteCode: str("TST7QX"),
        createdAt: str("2026-08-07T00:00:00.000Z"),
      },
    }),
  });
  check("Self-join cannot remove other members (403)", maliciousJoin.status === 403, `status ${maliciousJoin.status}`);

  // ---------- 6. Medications ----------
  const medFields = {
    name: str("Lisinopril"),
    dosage: str("10mg"),
    frequency: str("Daily"),
    times: str("08:00"),
    notes: str("With food"),
    familyGroupId: str(groupId),
    createdBy: str(userA.localId),
    createdAt: str("2026-08-07T00:00:00.000Z"),
    logs: { arrayValue: { values: [] } },
  };
  const medBad = await fsPost("medications", { ...medFields, familyGroupId: str(groupId) }, userB.idToken);
  check("Non-member cannot create medication (403)", medBad.status === 403, `status ${medBad.status}`);
  const med = await fsPost("medications", medFields, userA.idToken);
  medId = med.body?.name?.split("/").pop();
  check("Member can create medication", med.status === 200, `id ${medId}`);

  // Update logs (mark taken) — immutable fields must stay unchanged
  const markTaken = await fetch(`${FS_BASE}/medications/${medId}?updateMask.fieldPaths=logs`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userA.idToken}` },
    body: JSON.stringify({
      fields: {
        ...medFields,
        logs: {
          arrayValue: {
            values: [{
              mapValue: { fields: { date: str("2026-08-07"), taken: { booleanValue: true }, takenBy: str(userA.localId), timestamp: str("2026-08-07T08:05:00.000Z") } },
            }],
          },
        },
      },
    }),
  });
  check("Member can update medication logs", markTaken.status === 200, `status ${markTaken.status}`);

  // Immutable-field tampering must fail
  const tamper = await fetch(`${FS_BASE}/medications/${medId}?updateMask.fieldPaths=createdBy`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userA.idToken}` },
    body: JSON.stringify({ fields: { ...medFields, createdBy: str(userB.localId), logs: { arrayValue: { values: [] } } } }),
  });
  check("Cannot change immutable createdBy (403)", tamper.status === 403, `status ${tamper.status}`);

  // ---------- 7. Events (composite index + rules) ----------
  const evFields = {
    title: str("Dr. Smith Appointment"),
    date: str("2026-08-20"),
    time: str("10:30"),
    location: str("City Hospital"),
    type: str("appointment"),
    familyGroupId: str(groupId),
    createdBy: str(userA.localId),
    createdAt: str("2026-08-07T00:00:00.000Z"),
  };
  const ev = await fsPost("events", evFields, userA.idToken);
  check("Member can create event", ev.status === 200, `status ${ev.status}`);
  const badType = await fsPost("events", { ...evFields, type: str("hack") }, userA.idToken);
  check("Event with invalid type rejected (403)", badType.status === 403, `status ${badType.status}`);

  console.log("\n=== TEST SUMMARY ===");
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) failed.forEach((f) => console.log(`  FAILED: ${f.name}`));
  process.exitCode = failed.length ? 1 : 0;
} catch (err) {
  console.error("TEST ERROR:", err.message);
  process.exitCode = 1;
} finally {
  // ---------- Cleanup ----------
  if (medId && userA?.idToken) await fsDelete(`medications/${medId}`, userA.idToken);
  if (groupId && userA?.idToken) await fsDelete(`familyGroups/${groupId}`, userA.idToken);
  if (userA?.idToken) await deleteUser(userA.idToken);
  if (userB?.idToken) await deleteUser(userB.idToken);
  console.log("Cleanup complete (test users + docs removed).");
}
