import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAdminIdAllowed, parseAdminIds } from "../src/lib/server/admin-policy.mjs";

const allowed = parseAdminIds(" 11111111-1111-4111-8111-111111111111, 22222222-2222-4222-8222-222222222222 ");
assert.equal(allowed.length, 2, "UUID allowlist is parsed and trimmed");
assert.equal(isAdminIdAllowed("11111111-1111-4111-8111-111111111111", allowed), true, "configured admin is accepted");
assert.equal(isAdminIdAllowed("33333333-3333-4333-8333-333333333333", allowed), false, "ordinary authenticated user is rejected");
assert.equal(isAdminIdAllowed(undefined, allowed), false, "anonymous user is rejected");
assert.equal(isAdminIdAllowed("11111111-1111-4111-8111-111111111111", []), false, "missing admin allowlist denies by default");

const guard = await readFile(new URL("../src/lib/server/admin-auth.ts", import.meta.url), "utf8");
assert.match(guard, /auth\.auth\.getUser\(bearer\)/, "server verifies the Supabase JWT");
assert.match(guard, /if \(!bearer \|\| !url \|\| !anon \|\| !service \|\| allowedIds\.length === 0\)/, "missing token/configuration denies before creating admin access");
assert.match(guard, /isAdminIdAllowed\(userId, allowedIds\)/, "server enforces the UUID allowlist");

const outFiles = await (async function walk(dir) {
  const { readdir } = await import("node:fs/promises");
  const items = await readdir(dir, { withFileTypes: true });
  const paths = await Promise.all(items.map((item) => item.isDirectory() ? walk(`${dir}/${item.name}`) : [`${dir}/${item.name}`]));
  return paths.flat();
})("out");
for (const file of outFiles) {
  if (!/\.(?:js|html|json|css|txt|map)$/i.test(file)) continue;
  const content = await readFile(file, "utf8");
  assert.doesNotMatch(content, /SUPABASE_SERVICE_ROLE_KEY|service_role_key/i, `service role credential reference is absent from ${file}`);
}
console.log(`Admin authorization checks passed; no service-role key reference found in ${outFiles.length} exported files.`);
