/**
 * Environment variable helpers
 */

/** Parse common truthy/falsey env values. */
export function envFlag(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === null) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/** Read an env var with optional fallback. */
export function envString(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}
