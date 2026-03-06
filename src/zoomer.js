import * as d3 from "./d3";

/**
 * Creates a panel with a slider and +/- buttons to allow resizing the view
 */
class ZoomPanel {
  /**
   * Sets all the passed options in class atributes and initiates a d3.scale for the slider.
   * @param {Object} options - All the available options of this class:
   * @example <caption>Options defaults and explanations.</caption>
   * ```javascript
   * {
   *    x = 0, // X coordinate to locate the panel
   *    y = 0, // Y coordinate to locate the panel
   *    centerX = 17, // X coordinate where the buttons should be centered to
   *    top = 30, // Space in top before the center of the first button, use to create a gap for the sort button
   *    r = 10, // radius of the buttons
   *    padding = 3, // padding in between buttons and slider
   *    scrollH = 40, // Height of the scroller/slider
   *    scrollW = 10, // Width of the scroller/slider
   *    container = null, // D3 selection where the panel will be added
   *    domain = [0, 100], // Array of 2 positions defining the domain of values the function will return
   *    function_plus = null, // Callback for when the + button gets clicked
   *    function_less = null, // Callback for when the - button gets clicked
   *    function_slide = null, // Callback for when the slider gets dragged
   *  }
   * ```
   */
  constructor({
    x = 0,
    y = 0,
    centerX = 17,
    top = 30,
    r = 10,
    padding = 3,
    scrollH = 40,
    scrollW = 10,
    container = null,
    domain = [0, 100],
    function_plus = null,
    function_less = null,
    function_slide = null,
  }) {
    this.x = x;
    this.y = y;
    this.centerX = centerX;
    this.top = top;
    this.r = r;
    this.padding = padding;
    this.scrollH = scrollH;
    this.scrollW = scrollW;
    this.container = container;
    this.domain = domain;
    this.function_plus = function_plus;
    this.function_less = function_less;
    this.function_slide = function_slide;
    this.slider = d3
      .scaleLinear()
      .domain(domain)
      .range([top + r + scrollH, top + r + padding]);
  }

  /**
   * Appends a group in the given container that includes the SVG elements to represent the zoomer.
   * It also sets the events binding them to the callback funtions passed in the options object.
   * @summary If the description is long, write your summary here. Otherwise, feel free to remove this.
   */
  draw_panel() {
    this.zoom_panel = this.container
      .append("g")
      .attr("class", "gpv-zoomer")
      .attr("transform", `translate(${this.x}, ${this.y})`);
    ZoomPanel.add_button(
      this.zoom_panel,
      "+",
      this.centerX,
      this.top,
      this.r,
    ).on("click", this.function_plus);
    this.zoom_panel
      .append("line")
      .attr("x1", this.centerX)
      .attr("x2", this.centerX)
      .attr("y1", this.top + this.r + this.padding)
      .attr("y2", this.top + this.r + this.padding + this.scrollH)
      .style("stroke", "lightgrey");
    this.zoomBar = this.zoom_panel
      .append("rect")
      .attr("x", this.centerX - this.scrollW / 2)
      .attr("y", this.slider(this.domain[0]))
      .attr("width", this.scrollW)
      .attr("height", 4)
      .style("cursor", "ns-resize")
      .style("fill", "darkgrey")
      .call(d3.drag().on("drag", this.function_slide));

    ZoomPanel.add_button(
      this.zoom_panel,
      "-",
      this.centerX,
      this.top + 2 * this.r + 2 * this.padding + this.scrollH,
      this.r,
    ).on("click", this.function_less);
  }

  /**
   * Updates the position of the panel
   */
  refresh() {
    this.zoom_panel.attr("transform", `translate(${this.x}, ${this.y})`);
  }

  /**
   * Add a new circular button into a panel
   * @param {Object} panel - D3 selector of the panel to add the button
   * @param {String} text - Text for the button. the function doesn't check if the text doesn't fit the given radius
   * @param {Number} x - X coordinate in the panel
   * @param {Number} y - Y coordinate in the panel
   * @param {Number} r - radius of the circles
   */
  static add_button(panel, text, x, y, r) {
    const c = panel.append("circle").attr("cx", x).attr("cy", y).attr("r", r);
    panel
      .append("text")
      .attr("x", x)
      .attr("y", y)
      .style("pointer-events", "none")
      .text(text);
    return c;
  }
}

export default ZoomPanel;
