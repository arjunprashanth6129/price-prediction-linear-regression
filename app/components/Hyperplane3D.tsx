"use client";

import { useEffect, useRef, useState } from "react";
import type { ReturnFitRow } from "@/lib/ml";

// Plotly is ~1.6MB even as the 3D-only build, so it is imported inside an
// effect rather than at module scope. Nothing is fetched until this component
// mounts, which keeps it off the critical path for the rest of the page.
//
// react-plotly.js is deliberately not used: it is a thin wrapper whose peer
// range predates React 19, and driving newPlot/purge by hand is about fifteen
// lines.

const SURFACE_STEPS = 24;

interface Props {
  data: ReturnFitRow[];
  weights: { ma5: number; ma20: number; bias: number };
}

export default function Hyperplane3D({ data, weights }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let node: HTMLDivElement | null = null;

    (async () => {
      try {
        const Plotly = (await import("plotly.js-gl3d-dist-min")).default;
        if (cancelled || !host.current) return;
        node = host.current;

        const xs = data.map((d) => d.ma5Scaled);
        const ys = data.map((d) => d.ma20Scaled);
        const zs = data.map((d) => d.actualReturn * 100);

        const pad = 0.1;
        const xMin = Math.min(...xs) - pad;
        const xMax = Math.max(...xs) + pad;
        const yMin = Math.min(...ys) - pad;
        const yMax = Math.max(...ys) + pad;

        // The fitted plane through the two features being drawn. ret and
        // ma_ratio are held at 0, which after standardisation is their mean -
        // so this is a genuine slice of the four-dimensional fit, not a
        // separately fitted two-feature model.
        const gx = Array.from(
          { length: SURFACE_STEPS },
          (_, i) => xMin + ((xMax - xMin) * i) / (SURFACE_STEPS - 1),
        );
        const gy = Array.from(
          { length: SURFACE_STEPS },
          (_, i) => yMin + ((yMax - yMin) * i) / (SURFACE_STEPS - 1),
        );
        // The surface is drawn only where days actually occurred.
        //
        // ma5 and ma20 correlate at about 0.92, so real observations lie along
        // a thin diagonal ridge rather than filling this rectangle. The two
        // coefficients are near-equal and opposite, which means they cancel
        // along that ridge but diverge sharply in the empty corners. Drawing
        // the full box would render roughly half a plane of pure extrapolation
        // and exaggerate the tilt about eightfold - showing a steep surface
        // where the model is in fact almost flat everywhere it has data.
        // Cells with no observation within MASK_RADIUS are left as null, which
        // Plotly renders as a hole.
        const MASK_RADIUS = 0.28;
        const gz = gy.map((y) =>
          gx.map((x) => {
            let near = false;
            for (let i = 0; i < xs.length; i++) {
              if (Math.hypot(xs[i] - x, ys[i] - y) <= MASK_RADIUS) {
                near = true;
                break;
              }
            }
            return near
              ? (weights.ma5 * x + weights.ma20 * y + weights.bias) * 100
              : null;
          }),
        );

        const axis = {
          color: "#9aa8c0",
          gridcolor: "#2a3651",
          zerolinecolor: "#3a4a6b",
          showbackground: false,
          titlefont: { size: 11, color: "#9aa8c0" },
          tickfont: { size: 10, color: "#7c8aa4" },
        };

        await Plotly.newPlot(
          node,
          [
            {
              type: "surface",
              x: gx,
              y: gy,
              z: gz,
              showscale: false,
              opacity: 0.32,
              colorscale: [
                [0, "#1b7fa8"],
                [1, "#4dd0e1"],
              ],
              contours: {
                x: { show: true, color: "#5fe3f5", width: 1 },
                y: { show: true, color: "#5fe3f5", width: 1 },
              },
              hoverinfo: "skip",
              name: "fitted plane",
            },
            {
              type: "scatter3d",
              mode: "markers",
              x: xs,
              y: ys,
              z: zs,
              marker: {
                size: 2.6,
                color: "#dbe8ff",
                opacity: 0.62,
                line: { width: 0 },
              },
              text: data.map((d) => d.date),
              hovertemplate:
                "%{text}<br>ma5 %{x:.2f} · ma20 %{y:.2f}" +
                "<br>actual return %{z:.2f}%<extra></extra>",
              name: "actual days",
            },
          ],
          {
            autosize: true,
            margin: { l: 0, r: 0, t: 0, b: 0 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            showlegend: false,
            hoverlabel: {
              bgcolor: "#161f30",
              bordercolor: "#2a3651",
              font: { color: "#e8edf7", size: 11 },
            },
            scene: {
              xaxis: { ...axis, title: { text: "ma5 (scaled)" } },
              yaxis: { ...axis, title: { text: "ma20 (scaled)" } },
              zaxis: { ...axis, title: { text: "Actual return (%)" } },
              camera: { eye: { x: 1.55, y: -1.55, z: 0.72 } },
              aspectmode: "cube",
            },
          },
          { displayModeBar: false, responsive: true },
        );
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (node) {
        import("plotly.js-gl3d-dist-min")
          .then((m) => m.default.purge(node!))
          .catch(() => {});
      }
    };
  }, [data, weights]);

  if (failed) {
    return (
      <div className="grid h-[350px] w-full place-items-center rounded-lg border border-dashed border-line-strong bg-ink-900 px-6 text-center text-[13px] text-fg-dim sm:h-[500px]">
        The 3D view could not load. The same finding is in the coefficient
        charts below - the plane is flat because the weights are near zero.
      </div>
    );
  }

  return (
    <div
      ref={host}
      className="h-[350px] w-full sm:h-[500px]"
      aria-label="Three-dimensional plot of the fitted regression plane against actual daily returns. The plane is close to horizontal and the observations scatter widely above and below it."
      role="img"
    />
  );
}
