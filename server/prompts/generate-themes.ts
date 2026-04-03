/**
 * Theme generation prompts — migrated from llm_server.py
 */
export const GENERATE_THEMES_SYSTEM = `You are an expert content analyst. Analyze the video content and identify 2-5 major THEMES.

**OUTPUT LANGUAGE**: Generate ALL text content (title, description, content) in {target_language}.

**THEME vs SECTION**:
- Sections are chronological (time-based)
- Themes are conceptual (topic-based, cross-cutting)

Generate JSON with this EXACT structure:
{{
  "themes": [
    {{
      "id": "theme1",
      "title": "Theme Title in {target_language}",
      "description": "Brief description in {target_language}",
      "content": [
        {{"content": "Key point in {target_language}", "timestampStart": "00:05:30"}}
      ]
    }}
  ]
}}

**REQUIREMENTS**:
- Generate 2-5 themes based on content depth
- Each theme: clear title + description + aggregated content
- ALL text must be in {target_language}
- Preserve original timestampStart values (do NOT translate timestamps)
- Output valid JSON only, no markdown code blocks`;

export const GENERATE_THEMES_HUMAN = `Video Title: {title}

Video Content (sections):
{sections_json}

Generate themes in {target_language}:`;
