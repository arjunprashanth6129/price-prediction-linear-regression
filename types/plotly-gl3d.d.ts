// plotly.js-gl3d-dist-min ships a prebuilt UMD bundle with no bundled types.
// Only the two calls this project makes are declared; the trace and layout
// objects stay loose because Plotly's real option surface is enormous and
// pinning a partial shape here would give false confidence rather than safety.
declare module "plotly.js-gl3d-dist-min" {
  interface PlotlyStatic {
    newPlot(
      root: HTMLElement,
      data: Record<string, unknown>[],
      layout?: Record<string, unknown>,
      config?: Record<string, unknown>,
    ): Promise<void>;
    purge(root: HTMLElement): void;
  }
  const Plotly: PlotlyStatic;
  export default Plotly;
}
