export default class TaxonomySortButton {
  constructor({
    x = 0,
    y = 0,
    centerX = 17,
    top = 30,
    r = 10,
    function_sort = null,
    container = null,
  }) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.centerX = centerX;
    this.top = top;
    this.container = container;
    this.modes = ["tree1", "tree2", "tax_id", "org_name"];
    this.texts = ["", "", "0 9", "A Z"];
    this.function_sort = function_sort;
    this.currentMode = 0;
  }

  draw() {
    this.group = this.container.append("g").attr("class", "gpv-sorter");
    this.group
      .append("circle")
      .attr("cx", this.centerX)
      .attr("cy", this.top)
      .attr("r", this.r)
      .on("click", () => {
        this.currentMode = (this.currentMode + 1) % this.modes.length;
        this.function_sort(this.modes[this.currentMode]);
        this.fakeData.sort((a, b) =>
          a[this.modes[this.currentMode]] > b[this.modes[this.currentMode]]
            ? 1
            : -1
        );
        this.refresh();
      });
    this.text = this.group
      .append("text")
      .style("font-size", "0.8em")
      .attr("x", this.centerX)
      .attr("y", this.top);

    this.fakeData = [
      { id: 1, tree1: 1, tree2: 4, tax_id: 2, org_name: 4 },
      { id: 2, tree1: 2, tree2: 3, tax_id: 4, org_name: 1 },
      { id: 3, tree1: 3, tree2: 2, tax_id: 1, org_name: 3 },
      { id: 4, tree1: 4, tree2: 1, tax_id: 3, org_name: 2 },
    ];

    this.refresh();
  }

  refresh() {
    this.group.attr("transform", `translate(${this.x}, ${this.y})`);
    this.bars = this.group
      .selectAll("line.bar")
      .data(this.fakeData, (d) => d.id);
    const barBottom = this.top * 1.2;
    const barMaxH = 12;
    this.bars
      .enter()
      .append("line")
      .attr("class", "bar")
      .attr("y1", barBottom)
      .attr("y2", (d) => barBottom - barMaxH * (d.id / this.modes.length))
      .merge(this.bars)
      .attr(
        "opacity",
        this.modes[this.currentMode].indexOf("tree") >= 0 ? 0.7 : 0.2
      )
      .attr("x1", (d, i) => ((i + 3.6) * this.r) / 3)
      .attr("x2", (d, i) => ((i + 3.6) * this.r) / 3);

    this.text.text(this.texts[this.currentMode]);
  }
}
