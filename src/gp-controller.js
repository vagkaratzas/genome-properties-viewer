import * as d3 from "./d3";
import { transformByScroll } from "./gp-scroller";

export default class GenomePropertiesController {
  constructor({
    gp_element_selector = null,
    legends_element_selector = null,
    tooltip_selector = ".info-tooltip",
    gp_text_filter_selector = null,
    gp_viewer = null,
    gp_taxonomy = null,
    gp_label_selector = null,
    tax_label_selector = null,
    tax_search_selector = null,
    hierarchy_controller = null,
    width = 400,
  }) {
    this.gp_viewer = gp_viewer;
    this.hierarchy_controller = hierarchy_controller;
    this.gp_taxonomy = gp_taxonomy;
    this.width = width;
    this.dispatcher = d3.dispatch("textFilterChanged", "legendFilterChanged");

    if (gp_element_selector) {
      this.gp_component = d3.select(gp_element_selector);

      if (this.hierarchy_controller.root) this.draw_hierarchy_selector();
      else
        this.hierarchy_controller.on("hierarchyLoaded", () =>
          this.draw_hierarchy_selector()
        );
    }

    if (legends_element_selector) {
      this.legends_component = d3.select(legends_element_selector).append("ul");
      this.draw_legends();
    }

    if (tooltip_selector) {
      this.tooltip_selector = tooltip_selector;
      this.draw_tooltip(null, null, true);
    }

    this.text_filter = "";
    if (gp_text_filter_selector) {
      d3.select(gp_text_filter_selector).on("keyup", (event) => {
        this.text_filter =
          event.currentTarget.value.length > 2 ? event.currentTarget.value : "";
        if (this.text_filter !== this.gp_viewer.filter_text) {
          this.gp_viewer.filter_text = this.text_filter;
          this.moveScrollUp();
        }
      });
    }
    if (gp_label_selector) {
      d3.select(gp_label_selector).on("change", (event) => {
        this.gp_viewer.change_gp_label(event.currentTarget.value);
      });
    }
    if (tax_label_selector && gp_taxonomy) {
      d3.select(tax_label_selector).on("change", (event) => {
        this.gp_taxonomy.change_tax_label(event.currentTarget.value);
      });
    }
    if (tax_search_selector && gp_taxonomy) {
      this.search_options = [];
    }
  }

  moveScrollUp() {
    this.gp_viewer.current_scroll.y = 0;
    transformByScroll(this.gp_viewer);
  }

  loadSearchOptions() {
    this.search_options = this.gp_taxonomy.organisms.map(
      (e) => `${e}: ${this.gp_taxonomy.nodes[e].name}`
    );
    // this.search_options.splice(0,0,...this.search_options.map(e=>this.gp_taxonomy.nodes[e].species))
    // this.search_options = this.search_options.map(String);
  }

  draw_tooltip(event, items = null, first_time = false, header = null) {
    const parent = d3.select(this.tooltip_selector);

    if (header) parent.insert("header", ":first-child").text(header);
    else parent.select("header").remove();

    if (first_time) this.tooltip_component = parent.append("ul");

    parent.style("visibility", items == null ? "hidden" : "visible");
    const info_item = this.tooltip_component
      .selectAll("li")
      .data(d3.entries(items), (d) => d.key);
    info_item.exit().remove();
    const li_e = info_item.enter().append("li");
    li_e
      .append("div")
      .attr("class", "label")
      .text((d) => d.key.toLowerCase());
    li_e
      .append("div")
      .attr("class", "content")
      .text((d) => d.value);

    if (event) {
      // const h = parent.node().getBoundingClientRect().height;
      const top = this.gp_viewer.options.cell_side / 2 + event.pageY;
      let left = Math.max(event.pageX - this.width / 2, 0);
      if (left + this.width > this.gp_viewer.options.width)
        left = this.gp_viewer.options.width - this.width;

      parent
        .style("width", `${this.width}px`)
        .style("top", `${top}px`)
        .style("left", `${left}px`);
    }
  }

  draw_legends(total = { YES: 0, NO: 0, PARTIAL: 0 }) {
    const legend_item = this.legends_component.selectAll("li").data(
      d3.entries(total).sort((a, b) => (a.key > b.key ? -1 : 1)),
      (d) => d.key
    );

    const legends_filter = { YES: "", NO: "", PARTIAL: "" };
    const filter_symbols = ["", "∀", "∃", "∄"];

    legend_item
      .select(".color>div")
      .html((d) => (d.value > 0 ? d.value : "&nbsp;"));

    const li_e = legend_item.enter().append("li");

    li_e.append("label").text((d) => d.key.toLowerCase());
    li_e
      .append("div")
      .attr("class", "color")
      .style("background", (d) => this.gp_viewer.c[d.key])
      .style("color", (d) =>
        d.key === "NO" ? "rgb(49, 130, 189)" : "rgb(230,230,230)"
      )
      .style("cursor", "pointer")
      .attr("type", "")
      .on("click", (event, d) => {
        const e = d3.select(event.currentTarget); // Element
        const cu = filter_symbols.indexOf(e.attr("type")); // Current
        const n = (cu + 1) % filter_symbols.length; // Next

        e.classed("filter", filter_symbols[n] !== "").attr(
          "type",
          filter_symbols[n]
        );
        legends_filter[d.key] = filter_symbols[n];
        this.moveScrollUp();
        this.dispatcher.call("legendFilterChanged", this, legends_filter);
      })
      .on("mouseover", (event, d) =>
        this.draw_tooltip(
          event,
          {
            "∀": `All the species in the row have the value (${d.key})`,
            "∃": `There is at least one species in each row with the value (${d.key})`,
            "∄": `There is not a single species in each row with the value (${d.key})`,
          },
          false,
          "Click in this area to apply one of the following filters"
        )
      )
      .on("mouseout", () => this.draw_tooltip())
      .append("div")
      .style("margin", "0 auto")
      .style("padding", "2px");
  }

  draw_hierarchy_selector() {
    this.gp_component.html(`
            <div class='current_status'>All</div>
            <div class='options'>
                <a class="all">All</a> | <a class="none">None</a><br/>
                <ul>
                </ul>
            </div>`);

    this.gp_component
      .select(".options .all")
      .on("click", () => this.update("ALL"));
    this.gp_component
      .select(".options .none")
      .on("click", () => this.update("NONE"));

    const tll = this.gp_component
      .select(".options ul")
      .selectAll(".top-level-option")
      .data(this.hierarchy_controller.hierarchy_switch, (d) => d.id);

    const li = tll.enter().append("li").attr("class", "top-level-option");
    li.append("div")
      .style("width", "0.8em")
      .style("height", "0.8em")
      .style("margin-right", "5px")
      .style("display", "inline-block")
      .style("background", (d) => this.hierarchy_controller.color(d.id))
      .style(
        "border",
        (d) => `2px solid ${this.hierarchy_controller.color(d.id)}`
      )
      .style("border-radius", "50%")
      .on("click", (event, d) => this.update(d));

    li.append("a")
      .text((d) => this.hierarchy_controller.nodes[d.id].name)
      .on("click", (event, d) => this.update(d));
  }

  update(d) {
    let selected = [];
    this.moveScrollUp();
    if (d === "ALL" || d === "NONE") {
      this.hierarchy_controller.hierarchy_switch.forEach(
        (e) => (e.enable = d === "ALL")
      );
      this.hierarchy_controller.dispatcher.call(
        "switchChanged",
        this,
        this.hierarchy_switch
      );
      this.gp_component.select(".current_status").html(d.toLowerCase());
    } else {
      this.hierarchy_controller.toggle_switch(d);
      this.gp_component.select(".current_status").text("");
      selected = this.hierarchy_controller.hierarchy_switch.filter(
        (e) => e.enable
      );
      if (selected.length === 0)
        this.gp_component.select(".current_status").text("none");
      else if (
        selected.length === this.hierarchy_controller.hierarchy_switch.length
      )
        this.gp_component.select(".current_status").text("all");
      else {
        const samples = this.gp_component
          .select(".current_status")
          .selectAll("div.sample")
          .data(selected, (item) => item.id);
        samples
          .enter()
          .append("div")
          .attr("class", "sample")
          .style("width", "0.8em")
          .style("height", "0.8em")
          .style("margin-left", "2px")
          .style("display", "inline-block")
          .style("background", (item) =>
            this.hierarchy_controller.color(item.id)
          )
          .style("border-radius", "50%");
        samples.exit().remove();
      }
    }
    this.gp_component
      .select(".options ul")
      .selectAll(".top-level-option div")
      .style("background", (item) =>
        item.enable ? this.hierarchy_controller.color(item.id) : "#e3e3e3"
      );
  }

  on(typename, callback) {
    this.dispatcher.on(typename, callback);
    return this;
  }
}
