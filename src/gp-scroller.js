import * as d3 from "./d3";
/**
 * Updates this and other components as if a scroll event happened.
 * It became the de-facto refresh of the whole viewer, as it groups the minimum necessary changes to trigger a full update.
 * @param {GenomePropertiesViewer} viewer - The instance of the genome properites viewer
 */
export const transformByScroll = (viewer) => {
  const heatmap_x_offset = viewer.options.dimensions.heatmap_x_offset || 0;
  viewer.newRows.attr(
    "transform",
    () => `translate(${viewer.current_scroll.x}, ${viewer.current_scroll.y})`,
  );
  viewer.newCols.attr(
    "transform",
    `translate(${viewer.current_scroll.x + heatmap_x_offset}, ${viewer.current_scroll.y})`,
  );
  viewer.options.dimensions.total.short_side = viewer.options.cell_side;
  viewer.gp_taxonomy.y = viewer.options.dimensions.total.short_side;
  viewer.update_viewer(0, true);
};

/**
 * Append a group into the viewer's mainGroup.
 * It contains the elements to draw a simple horizontal scrollbar, and attach the dragging events to them.
 * @param {GenomePropertiesViewer} viewer - The instance of the genome properites viewer
 */
export const drawScrollXBar = (viewer) => {
  const localY = (1 + viewer.organisms.length) * viewer.options.cell_side;
  const scrollerShortSide = viewer.options.dimensions.scroller.short_side;
  viewer.scrollbar_x_g = viewer.mainGroup
    .append("g")
    .attr("class", "gpv-scrollbar")
    .attr("opacity", 0)
    .attr(
      "transform",
      `translate(${
        viewer.options.dimensions.tree.width // at the right of the tree
      }, ${localY})`,
    );

  viewer.scrollbar_x_bg = viewer.scrollbar_x_g
    .append("rect")
    .attr("class", "gpv-scrollbar-bg")
    .attr("width", viewer.options.width - viewer.options.dimensions.tree.width)
    .attr("height", scrollerShortSide);

  let selectedXBar = null;
  viewer.scrollbar_x = viewer.scrollbar_x_g
    .append("rect")
    .attr("class", "gpv-scrollbar-handle")
    .attr("width", viewer.options.width - viewer.options.dimensions.tree.width)
    .attr("height", scrollerShortSide - 2)
    .attr("y", 1)
    .attr("rx", scrollerShortSide / 2)
    .attr("ry", scrollerShortSide / 2)
    .style("cursor", "ew-resize")
    .call(
      d3
        .drag()
        .on("start", (event) => (selectedXBar = event.sourceEvent.target))
        .on("end", () => {
          viewer.skip_scroll_refreshing = false;
          selectedXBar = null;
        })
        .on("drag", (event) => {
          viewer.skip_scroll_refreshing = true;
          event.sourceEvent.stopPropagation();
          const propertiesWidth = viewer.x(viewer.props.length);
          const prevX = Number(selectedXBar.getAttribute("x"));
          let nextX = prevX + event.dx;
          const available_x =
            viewer.options.width - viewer.options.dimensions.tree.width;

          nextX = Math.max(
            0,
            Math.min(nextX, available_x - selectedXBar.getAttribute("width")),
          );

          viewer.scrollbar_x.attr("x", nextX);
          const dx = (-nextX * propertiesWidth) / available_x;
          viewer.current_scroll.x = Math.min(0, dx);
          transformByScroll(viewer);
        }),
    );
};

/**
 * Updates the size and position of the scrollbar.
 * The size of the draggable is proportional to the number of visible columns in the graphic
 * @param {GenomePropertiesViewer} viewer - The instance of the genome properites viewer
 * @param {Number} visible_cols - Indicates how many columns are visible in the area assigned to the heatmap.
 * @param {Number} current_col - Indicates the index of the first visible column out of the total number of GP.
 */
const updateScrollBarX = (viewer, visible_cols, current_col) => {
  const localY = (1 + viewer.organisms.length) * viewer.options.cell_side;
  const total_cols = viewer.props.length;
  viewer.scrollbar_x_g
    .attr(
      "transform",
      `translate(${viewer.options.dimensions.tree.width}, ${localY})`,
    )
    .attr("opacity", total_cols > 0 ? 1 : 0);

  const available_x =
    viewer.options.width -
    viewer.options.dimensions.tree.width -
    viewer.options.dimensions.total.short_side;
  viewer.scrollbar_x
    .transition()
    .attr(
      "width",
      available_x *
        Math.min(1, total_cols !== 0 ? visible_cols / total_cols : 1),
    )
    .attr("x", total_cols ? (current_col * available_x) / total_cols : 0);
  viewer.scrollbar_x_bg.attr("width", available_x);
};

/**
 * A single method to trigger the update of all the scroll bars of the viewer. We currently only use 1.
 * @param {GenomePropertiesViewer} viewer - The instance of the genome properites viewer
 * @param {Number} visible_cols - Indicates how many columns are visible in the area assigned to the heatmap.
 * @param {Number} current_col - Indicates the index of the first visible column out of the total number of GP.
 */
export const updateScrollBars = (viewer, visible_cols, current_col) => {
  updateScrollBarX(viewer, visible_cols, current_col);
};
