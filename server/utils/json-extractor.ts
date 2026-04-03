/**
 * Extract JSON from raw LLM text output.
 * Strips markdown fences, finds outermost {} or [], parses and returns.
 */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text?.trim()) return null;

  // Strip markdown code fences
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json?\s*\n?/, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "");
  cleaned = cleaned.trim();

  // Detect whether it's an object or array
  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");

  let start: number;
  let openChar: string;
  let closeChar: string;

  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    start = arrStart;
    openChar = "[";
    closeChar = "]";
  } else if (objStart !== -1) {
    start = objStart;
    openChar = "{";
    closeChar = "}";
  } else {
    return null;
  }

  // Find matching close using brace counting
  let depth = 0;
  let end = start;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === openChar) depth++;
    else if (cleaned[i] === closeChar) {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  const jsonStr = cleaned.slice(start, end);
  if (!jsonStr || jsonStr.length < 2) return null;

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    console.error("[extractJson] JSON parse failed, length:", jsonStr.length);
    return null;
  }
}
