import { useEffect, useRef, useState } from "react";

interface MermaidChartProps {
  chart: string;
  className?: string;
}

/**
 * Sanitize Mermaid chart code to fix common syntax issues
 * - Wraps all node labels in quotes to safely handle special characters
 * - Converts LR to TD for better branching visualization
 * - Escapes & character which can cause issues
 */
const sanitizeMermaidCode = (code: string): string => {
  // Handle ALL possible escaped newline formats
  let sanitized = code;

  // Try multiple replacement patterns
  // 1. Literal string \n (from JSON serialization)
  sanitized = sanitized.split("\\n").join("\n");
  // 2. Double backslash
  sanitized = sanitized.split("\\\\n").join("\n");
  // 3. Handle tabs
  sanitized = sanitized.split("\\t").join("  ");
  sanitized = sanitized.split("\\\\t").join("  ");

  sanitized = sanitized.trim();

  console.log("[Sanitize] Input length:", code.length);
  console.log("[Sanitize] Has literal backslash-n:", code.includes("\\n"));
  console.log("[Sanitize] Output lines:", sanitized.split("\n").length);

  // Check if this is a branching flowchart (same node appears multiple times on left side of -->)
  const leftNodes = sanitized.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*-->/gm) || [];
  const nodeCountMap: Record<string, number> = {};
  leftNodes.forEach((match) => {
    const node = match.replace(/\s*-->.*/, "").trim();
    nodeCountMap[node] = (nodeCountMap[node] || 0) + 1;
  });
  const hasBranching = Object.values(nodeCountMap).some((count) => count > 1);

  console.log("[Sanitize] Node count map:", nodeCountMap);
  console.log("[Sanitize] Has branching:", hasBranching);

  // Process each line
  const lines = sanitized.split("\n");
  const processedLines = lines.map((line, index) => {
    // Always convert LR to TD for better vertical layout
    if (index === 0) {
      if (/^\s*flowchart\s+LR/i.test(line)) {
        return line.replace(/LR/i, "TD");
      }
      if (/^\s*graph\s+LR/i.test(line)) {
        return line.replace(/LR/i, "TD");
      }
    }

    // Skip other directive lines
    if (
      /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap)/i.test(
        line,
      )
    ) {
      return line;
    }

    let processed = line;

    // Escape & character which can cause issues
    // Do this BEFORE wrapping in quotes

    // Wrap content in square brackets with quotes: A[text] -> A["text"]
    processed = processed.replace(/\[([^\]"]+)\]/g, (match, content) => {
      if (content.startsWith('"') || content.startsWith("'")) {
        return match;
      }
      const escaped = content.replace(/"/g, "'").replace(/&/g, "and");
      return `["${escaped}"]`;
    });

    // Wrap content in curly braces (diamond nodes): B{text} -> B{"text"}
    processed = processed.replace(/\{([^}"]+)\}/g, (match, content) => {
      if (content.startsWith('"') || content.startsWith("'")) {
        return match;
      }
      const escaped = content.replace(/"/g, "'").replace(/&/g, "and");
      return `{"${escaped}"}`;
    });

    // Wrap content in parentheses (rounded nodes): C(text) -> C("text")
    processed = processed.replace(
      /([A-Za-z_][A-Za-z0-9_]*)\(([^)"]+)\)/g,
      (match, nodeId, content) => {
        if (content.startsWith('"') || content.startsWith("'")) {
          return match;
        }
        const escaped = content.replace(/"/g, "'").replace(/&/g, "and");
        return `${nodeId}("${escaped}")`;
      },
    );

    return processed;
  });

  return processedLines.join("\n");
};

export const MermaidChart = ({ chart, className = "" }: MermaidChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current || !chart) return;

      setIsLoading(true);
      setError(null);

      try {
        // Dynamically import mermaid
        const mermaid = (await import("mermaid")).default;

        // Initialize mermaid with polished theme matching the reference image
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            // Node colors - soft blue gradient look
            primaryColor: "#e0f2fe",
            primaryTextColor: "#0369a1",
            primaryBorderColor: "#38bdf8",

            // Secondary nodes
            secondaryColor: "#f0f9ff",
            secondaryTextColor: "#0c4a6e",
            secondaryBorderColor: "#7dd3fc",

            // Tertiary/decision nodes
            tertiaryColor: "#e0f2fe",
            tertiaryTextColor: "#0369a1",
            tertiaryBorderColor: "#38bdf8",

            // Lines and arrows
            lineColor: "#38bdf8",

            // Typography
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontSize: "14px",

            // Background
            background: "#ffffff",
            mainBkg: "#e0f2fe",
            nodeBorder: "#38bdf8",

            // Cluster
            clusterBkg: "#f0f9ff",
            clusterBorder: "#bae6fd",

            // Edge labels
            edgeLabelBackground: "#ffffff",
          },
          flowchart: {
            htmlLabels: true,
            curve: "basis",
            padding: 15,
            nodeSpacing: 60,
            rankSpacing: 60,
            diagramPadding: 20,
            useMaxWidth: true,
            defaultRenderer: "dagre-wrapper",
          },
          securityLevel: "loose",
        });

        // Clear previous content
        containerRef.current.innerHTML = "";

        // Generate unique ID for this chart
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Sanitize and clean the chart code
        const cleanChart = sanitizeMermaidCode(chart);

        console.log("[MermaidChart] === DEBUG START ===");
        console.log("[MermaidChart] Original code type:", typeof chart);
        console.log("[MermaidChart] Original code length:", chart.length);
        console.log(
          "[MermaidChart] Original first 100 chars:",
          JSON.stringify(chart.slice(0, 100)),
        );
        console.log("[MermaidChart] Contains actual newlines:", chart.includes("\n"));
        console.log("[MermaidChart] Contains backslash-n:", chart.includes("\\n"));
        console.log("[MermaidChart] Sanitized code:", cleanChart);
        console.log("[MermaidChart] Sanitized line count:", cleanChart.split("\n").length);
        console.log("[MermaidChart] === DEBUG END ===");

        // Render the chart
        const { svg } = await mermaid.render(id, cleanChart);

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;

          // Make SVG responsive and apply polish
          const svgElement = containerRef.current.querySelector("svg");
          if (svgElement) {
            svgElement.style.maxWidth = "100%";
            svgElement.style.height = "auto";
            svgElement.style.minHeight = "200px";

            // Polish node styling
            const nodes = svgElement.querySelectorAll(
              ".node rect, .node polygon, .node circle, .node ellipse",
            );
            nodes.forEach((node) => {
              const el = node as SVGElement;
              el.style.filter = "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))";
              el.style.strokeWidth = "1.5px";
              el.style.rx = "8";
              el.style.ry = "8";
            });

            // Polish edge/arrow styling
            const edges = svgElement.querySelectorAll(".edgePath path");
            edges.forEach((edge) => {
              const el = edge as SVGElement;
              el.style.strokeWidth = "1.5px";
            });

            // Polish text styling
            const texts = svgElement.querySelectorAll(".nodeLabel, .edgeLabel");
            texts.forEach((text) => {
              const el = text as SVGElement;
              el.style.fontWeight = "500";
            });
          }
        }
      } catch (err) {
        console.error("[MermaidChart] Render error:", err);
        setError(err instanceof Error ? err.message : "Failed to render chart");
      } finally {
        setIsLoading(false);
      }
    };

    renderChart();
  }, [chart]);

  if (!chart) {
    return null;
  }

  return (
    <div className={`mermaid-container ${className}`}>
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading diagram...
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-red-700">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            Chart rendering error
          </div>
          <pre className="max-h-32 overflow-auto text-xs text-red-600">{error}</pre>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-red-500 hover:text-red-700">
              View raw chart code
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-red-100 p-2 text-xs text-slate-700">
              {chart}
            </pre>
          </details>
        </div>
      )}

      <div
        ref={containerRef}
        className={`flex justify-center overflow-x-auto ${isLoading || error ? "hidden" : ""}`}
      />
    </div>
  );
};

export default MermaidChart;
