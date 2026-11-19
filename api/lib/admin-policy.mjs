export function parseAdminIds(value) {
  return String(value ?? "").split(",").map((id) => id.trim().toLowerCase()).filter(Boolean);
}

export function isAdminIdAllowed(userId, configuredIds) {
  return typeof userId === "string" && configuredIds.length > 0 && configuredIds.includes(userId.toLowerCase());
}
