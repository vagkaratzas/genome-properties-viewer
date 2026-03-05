import GenomePropertiesHierarchy from "./gp-hierarchy";
import GenomePropertiesTaxonomy from "./gp-taxonomy";
import ZoomPanel from "./zoomer";
import TaxonomySortButton from "./gp-taxonomy-sorter";
import GenomePropertiesController from "./gp-controller";
import { updateStepToggler, updateSteps } from "./gp-steps";
import "regenerator-runtime/runtime";

import {
  drawScrollXBar,
  // drawScrollYBar,
  transformByScroll,
  updateScrollBars,
} from "./gp-scroller";
import {
  createGradient,
  drawMasks,
  updateMasks,
  drawDragArea,
} from "./gp-ui-utils";

import {
  FileGetter,
  preloadSpecies,
  enableSpeciesFromPreLoaded,
  loadGenomePropertiesFile,
  loadGenomePropertiesText,
  removeGenomePropertiesFile,
} from "./gp-uploader";

import { filterByLegend, filterByHierarchy, filterByText } from "./gp-filters";

import {
  drawTotalPerOrganismPanel,
  updateTotalPerOrganismPanel,
  refreshGPTotals,
} from "./gp-totals";

import GPModal from "./modal";

import * as d3 from "./d3";

export default class GenomePropertiesViewer {
  constructor({
    width = null,
    height = null,
    element_selector = "body",
    cell_side = 20,
    total_panel_height = cell_side,
    server = "https://raw.githubusercontent.com/rdfinn/genome-properties/master/flatfiles/gp_assignments/SUMMARY_FILE_{}.gp",
    server_tax = "https://raw.githubusercontent.com/rdfinn/genome-properties/master/flatfiles/taxonomy.json",
    hierarchy_path = "../test-files/hierarchy.json",
    model_species_path = "../test-files/JSON_MERGED",
    whitelist_path = null,
    controller_element_selector = "#gp-selector",
    legends_element_selector = ".gp-legends",
    gp_text_filter_selector = "#gp-filter",
    gp_label_selector = "#gp_label",
    tax_label_selector = "#tax_label",
    tax_search_selector = "#tax-search",
    template_link_to_GP_page = "https://wwwdev.ebi.ac.uk/interpro/genomeproperties/#{}",
    gp_server = "http://wwwdev.ebi.ac.uk/interpro/genomeproperties/cgi-bin/test.pl",
    erz_path = "test-files/ERZ",
    erz_merged_path = "test-files/ERZ/ERZ_MERGED.json",
    dimensions = {
      tree: { width: 180 },
      total: { short_side: cell_side },
      step_expander: { short_side: cell_side },
      scroller: { short_side: 12 },
    },
  }) {
    this.data = {};
    this.preloaded = {};
    this.organisms = [];
    this.organism_names = {};
    this.organism_totals = {};
    this.filter_text = "";
    this.whitelist = null;
    this.fixedHeight = height !== null;
    this.propsOrder = null;
    this.erz_mode = false;
    this._taxonomy_state = null;
    this.erz_change_callback = null;

    this.modal = new GPModal(element_selector);

    this.fileGetter = new FileGetter({
      element: ".gp-modal-content",
      viewer: this,
    });
    if (width === null) {
      const rect = d3.select(element_selector).node().getBoundingClientRect();
      width = rect.width;
    }

    if (!this.fixedHeight) {
      let rect = d3.select(element_selector).node().getBoundingClientRect();
      if (rect.height < 1) {
        d3.select(element_selector).style("flex", "1");
        rect = d3.select(element_selector).node().getBoundingClientRect();
      }
      height = rect.height;
    }

    this.options = {
      width,
      height,
      element_selector,
      cell_side,
      server,
      gp_server,
      server_tax,
      total_panel_height,
      hierarchy_path,
      template_link_to_GP_page,
      dimensions,
      erz_path,
      erz_merged_path,
    };
    this.column_total_width = cell_side;
    this.x = d3.scaleLinear().range([0, cell_side]);
    this.y = d3.scaleBand().range([cell_side, cell_side]);
    // this.x = d3.scaleBand().range([0, width - this.column_total_width]);
    // this.y = d3.scaleLinear().range([0, cell_side]);
    this.gp_values = ["YES", "PARTIAL", "NO"];
    this.c = {
      YES: "rgb(49, 130, 189)",
      PARTIAL: "rgb(107, 174, 214)",
      NO: "rgb(210,210,210)",
    };
    this.current_order = null;

    if (whitelist_path) {
      fetch(whitelist_path)
        .then((response) => {
          if (!response.ok)
            throw new Error(`${response.status} ${response.statusText}`);
          return response.json();
        })
        .then((data) => {
          this.whitelist = data;
        });
    }
    this.svg = d3
      .select(element_selector)
      .append("svg")
      .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
      .attr("class", "gp-viewer")
      .attr("tabindex", "0")
      .attr("width", width)
      .attr("height", height)
      .on("wheel", (event) => {
        if (this?.props?.length) {
          event.stopPropagation();
          this.moveScroll({ dx: -event.deltaX });
        }
      });

    this.mainGroup = this.svg.append("g");

    d3.select(element_selector)
      .on("keydown", (event) => {
        this.step = this.step || 1;
        switch (event.key) {
          case "ArrowUp":
            this.moveScroll({ dy: this.options.cell_side * this.step });
            break;
          case "ArrowDown":
            this.moveScroll({ dy: -this.options.cell_side * this.step });
            break;
          case "ArrowLeft":
            this.moveScroll({ dx: this.options.cell_side * this.step });
            break;
          case "ArrowRight":
            this.moveScroll({ dx: -this.options.cell_side * this.step });
            break;
          default:
            break;
        }
        this.step += 0.5;
      })
      .on("keyup", () => {
        this.step = 1;
      });
    this.mainGroup.x = 0;
    this.mainGroup.y = 0;
    createGradient(this);

    this.gp_taxonomy = new GenomePropertiesTaxonomy({
      path: server_tax,
      x: 30, // TODO: change for new margin
      y: this.options.dimensions.total.short_side,
      height:
        this.options.height -
        this.options.dimensions.total.short_side -
        this.options.dimensions.scroller.short_side,
      width: this.options.dimensions.tree.width,
    })
      .on("changeOrder", (order) => {
        this.current_order = order;
        this.order_organisms_current_order();
      })
      .on("speciesRequested", (taxId) => {
        // loadGenomePropertiesFile(this, taxId);
        enableSpeciesFromPreLoaded(this, taxId);
      })
      .on("multipleSpaciesRequested", (taxa) => {
        for (const taxId of taxa) {
          enableSpeciesFromPreLoaded(this, taxId, false, false);
        }
        this.update_viewer(500);
      })
      .on("removeSpacies", (event, taxId) => {
        event.stopPropagation();
        removeGenomePropertiesFile(this, taxId);
      })
      .on("changeWidth", (w) => {
        this.options.dimensions.tree.width = w;
        this.x.range([0, this.options.cell_side]);
        this.update_viewer();
      });
    this.fileGetter.getJSON(server_tax).then((data) => {
      this.gp_taxonomy.load_taxonomy_obj(data);
    });

    this.gp_hierarchy = new GenomePropertiesHierarchy()
      // .load_hierarchy_from_path(this.options.hierarchy_path)
      .on("switchChanged", () => {
        this.mainGroup.y = 0;
        d3.select(".gpv-rows-group").attr(
          "transform",
          `translate(${this.mainGroup.x},${this.mainGroup.y})`
        );
        this.update_viewer(500);
        updateTotalPerOrganismPanel(this);
      });
    this.fileGetter.getJSON(hierarchy_path).then((data) => {
      this.gp_hierarchy.load_hierarchy_from_data(data);
      this.fileGetter.getJSON(model_species_path).then((dataSpecies) => {
        preloadSpecies(this, dataSpecies);
      });
    });
    // if (hierarchy_path) {
    //   this.gp_hierarchy.load_hierarchy_from_data(hierarchy_path);
    //   this.fileGetter.getJSON(model_species_path).get(data => {
    //     preloadSpecies(this, data);
    //   });
    // }
    this.sorter = new TaxonomySortButton({
      container: this.mainGroup,
      x: 0,
      y: 0,
      function_sort: (mode) => this.gp_taxonomy.sortBy(mode),
    });
    this.buttonHeight = 25;
    this.zoomer = new ZoomPanel({
      x: 0,
      y: this.buttonHeight,
      domain: [20, 200],
      container: this.mainGroup,
      function_plus: () => (this.cell_side = this.options.cell_side + 10),
      function_less: () => (this.cell_side = this.options.cell_side - 10),
      function_slide: (event) => {
        const newY = Math.max(
          this.zoomer.slider(this.zoomer.domain[1]),
          Math.min(event.y, this.zoomer.slider(this.zoomer.domain[0]))
        );
        this.cell_side = Math.round(this.zoomer.slider.invert(newY));
      },
    });

    // this.legends_filter = { YES: "", NO: "", PARTIAL: "" };
    this.gp_label_type = "name";

    this.controller = new GenomePropertiesController({
      gp_element_selector: controller_element_selector,
      legends_element_selector,
      gp_text_filter_selector,
      gp_label_selector,
      tax_label_selector,
      tax_search_selector,
      gp_viewer: this,
      gp_taxonomy: this.gp_taxonomy,
      hierarchy_controller: this.gp_hierarchy,
    }).on("legendFilterChanged", (filters) => {
      this.legend_filters = filters;
      this.update_viewer();
    });
    this.gp_taxonomy.on("taxonomyLoaded", () =>
      this.controller.loadSearchOptions()
    );

    this.current_scroll = { x: 0, y: 0 };
    this.draw_columns_panel();
    this.draw_rows_panel();
    drawMasks(this);
    this.gp_taxonomy.draw_tree_panel(this.mainGroup);
    this.zoomer.draw_panel(); // TODO: check the new place
    this.sorter.draw();
    drawTotalPerOrganismPanel(this);
    drawScrollXBar(this);
    // drawScrollYBar(this);
    drawDragArea(this);
    window.addEventListener("resize", () => this.refresh_size());
  }

  refresh_size() {
    const rect = d3
      .select(this.options.element_selector)
      .node()
      .getBoundingClientRect();
    this.options.width = rect.width;
    d3.select(this.options.element_selector)
      .select("svg")
      .attr("width", rect.width);
    this.x.range([0, this.options.cell_side]);

    this.update_viewer();
  }

  set cell_side(value) {
    const p = this.options.cell_side;
    this.options.cell_side = Math.max(20, Math.min(200, value));
    if (p !== this.options.cell_side) {
      this.current_scroll.x =
        (this.current_scroll.x * this.options.cell_side) / p;
      this.zoomer.zoomBar.attr("y", this.zoomer.slider(this.options.cell_side));
      this.x.range([0, this.options.cell_side]);
      this.refresh(this);
    }
  }

  moveScroll({ dx = 0, dy = 0 }) {
    const tw = this.x(this.props.length);
    const limY = this.newCols.node().getBBox().height - this.options.height;
    this.current_scroll.y = Math.max(
      0,
      Math.min(limY, this.current_scroll.y + dy)
    );
    this.current_scroll.x = Math.max(
      -tw +
        this.options.width -
        this.options.dimensions.tree.width -
        this.options.cell_side,
      Math.min(0, this.current_scroll.x + dx)
    );
    this.refresh(this);
  }

  _adjustXScaleBasedOnSteps() {
    if (!this.props) return this.x;
    const side = this.options.cell_side;
    const marks = {
      0: 0,
      1: side,
    };

    const newX = d3.scaleLinear().domain([0, 1]).range([0, side]);
    this.props.forEach((prop, i) => {
      if (prop.isShowingSteps) {
        const prevX = newX(i);

        if (!marks[i]) marks[i] = prevX;
        marks[i + 1] = marks[i] + Math.max(2, prop.steps.length) * side;
        marks[i + 2] = marks[i + 1] + side;
        const domain = Object.keys(marks)
          .map(Number)
          .sort((a, b) => a - b);
        const range = domain.map((x) => marks[x]).map(Number);
        newX.range(range).domain(domain);
      }
    });
    this.x = newX;
    return this.x;
  }

  draw_rows_panel() {
    this.newRows = this.mainGroup
      .append("g")
      .attr("class", "gpv-new-rows-group")
      .attr("transform", "translate(0,0)");
  }

  draw_columns_panel() {
    this.newCols = this.mainGroup
      .append("g")
      .attr("class", "gpv-new-cols-group");
  }

  move_row(prop, delta) {
    const pos = this.propsOrder.indexOf(prop);
    if (pos !== -1) {
      const tmp = this.propsOrder.splice(pos, 1);
      const newPos = Math.max(0, pos + delta);
      this.propsOrder = this.propsOrder
        .slice(0, newPos)
        .concat(tmp)
        .concat(this.propsOrder.slice(newPos));
      this.refresh();
    }
  }

  sort_props() {
    if (this.propsOrder) {
      this.props = this.props.sort(
        (a, b) =>
          this.propsOrder.indexOf(a.property) -
          this.propsOrder.indexOf(b.property)
      );
    }
  }

  update_viewer(time = 0, skip_filter = false) {
    if (!skip_filter || !this.props) {
      this.props = this.organisms.length ? Object.values(this.data) : [];
      refreshGPTotals(this);
      filterByHierarchy(this);
      filterByText(this);
      filterByLegend(this);
      this.sort_props();
    }
    this._adjustXScaleBasedOnSteps();

    this.column_total_width = this.options.cell_side;
    this.y.range([
      this.options.cell_side,
      this.options.cell_side * (1 + this.organisms.length),
    ]);

    this.current_props = this.props.filter(
      (gp, i) =>
        this.x(i + 1) + this.current_scroll.x >= 0 &&
        this.x(i) + this.current_scroll.x <
          this.options.width - this.options.dimensions.tree.width
    );
    const dx = this.props.indexOf(this.current_props[0]);
    const visible_cols = this.current_props.length;
    this.gp_taxonomy.update_tree(time, this.options.cell_side);
    this.current_order = this.gp_taxonomy.current_order;
    this.organisms = this.gp_taxonomy.get_tax_list();
    this.y.domain(this.current_order);

    const new_column_p = this.newCols
      .selectAll(".column")
      .data(this.current_props, (d) => d.property);

    new_column_p
      // .transition(t)
      .attr(
        "transform",
        (d, i) =>
          `translate(${this.x(i + dx) + this.options.dimensions.tree.width}, ${
            this.options.dimensions.total.short_side
          })`
      )
      .each((d, i, c) => this.update_col(d, i, c));

    new_column_p.exit().remove();

    const newColumn = new_column_p
      .enter()
      .append("g")
      .attr("id", (d) => `col_${d.property}`)
      .attr("class", "column")
      .each((d, i, c) => this.update_col(d, i, c));

    newColumn.append("line").attr("class", "puff").attr("y2", 0);

    newColumn.attr(
      "transform",
      (d, i) =>
        `translate(${this.x(i + dx) + this.options.dimensions.tree.width}, ${
          this.options.dimensions.total.short_side
        })`
    );

    d3.selectAll("g.column line")
      // .transition()
      .attr("y1", this.organisms.length * this.options.cell_side);

    const localX = this.options.cell_side / 4;
    const localY =
      this.options.dimensions.total.short_side +
      this.organisms.length * this.options.cell_side +
      this.options.dimensions.scroller.short_side;
    new_column_p
      .selectAll(".col_title")
      .attr("x", localX)
      .attr("y", localY)
      .attr("transform", `rotate(90,${localX},${localY})`)
      .text((d) => {
        if (this.gp_label_type === "name") return d.name;
        if (this.gp_label_type === "id") return d.property;
        return `${d.property}:${d.name}`;
      });

    const template = this.options.template_link_to_GP_page;
    newColumn
      .append("a")
      .attr("xlink:href", (d) => template.replace("{}", d.property))
      .attr("target", "_blank")
      .style("cursor", "pointer")
      .append("text")
      .attr("class", "col_title")
      .attr("x", localX)
      .attr("y", localY)
      .attr("transform", `rotate(90,${localX},${localY})`)
      .attr("text-anchor", "start")
      .text((d) => {
        if (this.gp_label_type === "name") return d.name;
        if (this.gp_label_type === "id") return d.property;
        return `${d.property}:${d.name}`;
      });
    let maxHeight = localY;
    newColumn.selectAll("text.col_title").each((x, i, c) => {
      const newH = localY + c[i].getBBox().width;
      if (maxHeight < newH) maxHeight = newH;
    });
    this.refreshSVGHeight(maxHeight + this.options.cell_side);

    const new_row_p = this.newRows
      .selectAll(".row")
      .data(this.organisms, (p) => p);
    new_row_p
      .transition()
      .attr(
        "transform",
        (d, i) =>
          `translate(${this.options.dimensions.tree.width}, ${this.y(i)})`
      );

    const newRow = new_row_p
      .enter()
      .append("g")
      .attr("class", "row")
      .attr(
        "transform",
        (d, i) =>
          `translate(${this.options.dimensions.tree.width}, ${this.y(i)})`
      );

    new_row_p
      .selectAll("line")
      .attr("x2", this.props.length * this.options.cell_side);
    newRow
      .append("line")
      .attr("x2", this.props.length * this.options.cell_side);

    updateTotalPerOrganismPanel(this);
    updateMasks(this);
    this.sorter.y = 0;
    this.zoomer.y = this.buttonHeight;
    this.sorter.refresh();
    this.zoomer.refresh();
    if (!this.skip_scroll_refreshing) updateScrollBars(this, visible_cols, dx);
    if (this.erz_mode && this.erz_change_callback)
      this.erz_change_callback(this.organisms);
  }

  update_col(gp, i, c) {
    const cell_width =
      this.options.cell_side *
      (gp.isShowingSteps ? Math.max(2, gp.steps.length) : 1);
    const side = this.options.cell_side;
    const localX = this.options.cell_side * 0.75;
    const localY =
      this.options.dimensions.total.short_side +
      this.organisms.length * this.options.cell_side +
      this.options.dimensions.scroller.short_side;

    const newY = d3
      .scaleBand()
      .range([0, this.organisms.length * this.options.cell_side])
      .domain(this.current_order);

    const gps = d3
      .select(c[i])
      .selectAll(".top_level_gp")
      .data(gp.parent_top_properties, (d) => d);
    const text_heigth = d3.select("text").node().getBBox().height;
    let radius = (side - text_heigth) / 2 - 4;
    if (radius < 2) radius = 2;
    if (radius > 6) radius = 6;

    gps.attr("cy", localY).attr("cx", localX).attr("r", radius);

    gps
      .enter()
      .append("circle")
      .attr("class", "top_level_gp")
      .attr("cy", localY)
      .attr("cx", localX)
      .attr("r", radius)
      .style("fill", (d) => this.gp_hierarchy.color(d));

    const cells = d3
      .select(c[i])
      .selectAll(".cell")
      .data(this.organisms, (d) => d);

    cells
      .transition()
      .attr("y", (d, j) => newY(j))
      .attr("width", cell_width)
      .attr("height", this.y.bandwidth());

    cells.exit().remove();

    const mouseover = (event, p) => {
      d3.select(event.currentTarget.parentNode)
        .select("text")
        .classed("active", true);
      d3.selectAll(".node--leaf text").classed("active", (d) => d.label === p);
      const data = d3.select(event.currentTarget.parentNode).data();
      if (data.length < 1) return;

      const info = {
        Property: data[0].property,
        Name: data[0].name,
        Organism: `${this.getOrganismNameFromTaxId(p)} (${p})`,
        Value: data[0].values[p],
      };
      if (p === "TOTAL") {
        this.controller.draw_legends(data[0].values[p]);
        info.Value = `TOTAL: {YES: ${data[0].values[p].YES}, PARTIAL: ${data[0].values[p].PARTIAL}, NO: ${data[0].values[p].NO}}`;
        info.Organism = "All";
      }
      this.controller.draw_tooltip(event, info);
    };
    const mouseout = (event, p) => {
      d3.selectAll("text").classed("active", false);
      d3.selectAll(".gpv-name").remove();
      this.controller.draw_tooltip();
      if (p === "TOTAL") this.controller.draw_legends();
    };

    cells
      .enter()
      .insert("rect", ":first-child")
      .attr("class", "cell")
      .attr("y", (d, j) => newY(j))
      .attr("width", cell_width)
      .attr("height", this.y.bandwidth())
      .on("mouseover", mouseover)
      .on("mouseout", mouseout)
      .style("fill", (d) => (d in gp.values ? this.c[gp.values[d]] : null));

    const arc_f = d3
      .arc()
      .outerRadius(side * 0.4)
      .innerRadius(0);
    const pie_f = d3.pie().value((d) => d.value);

    const cells_t = d3
      .select(c[i])
      .selectAll(".total_cell")
      .data(["TOTAL"], (d) => d);

    cells_t.attr(
      "transform",
      () => `translate(${cell_width * 0.5}, ${side * -0.5})`
    );

    cells_t
      .enter()
      .append("g")
      .attr("class", "total_cell")
      .attr("transform", () => `translate(${cell_width * 0.5}, ${side * -0.5})`)
      .on("mouseover", mouseover)
      .on("mouseout", mouseout);

    const arcs = d3
      .select(c[i])
      .selectAll(".total_cell")
      .selectAll(".arc")
      .data(pie_f(d3.entries(gp.values.TOTAL)), (d) => d.data.key);

    arcs.attr("d", arc_f);

    arcs
      .enter()
      .append("path")
      .attr("class", "arc")
      .attr("d", arc_f)
      .style("fill", (d) => this.c[d.data.key]);

    updateStepToggler(this, gp, c[i], side);
    updateSteps(this, gp, c[i], side, newY);
  }

  order_organisms(value) {
    this.current_order = this.gp_taxonomy.orders[value];
    this.order_organisms_current_order();
  }

  order_organisms_current_order() {
    this.y.domain(this.current_order);
    updateTotalPerOrganismPanel(this);
    this.refresh();
  }

  change_gp_label(type) {
    this.gp_label_type = type;
    this.refresh();
  }

  loadGenomePropertiesText(name, text) {
    loadGenomePropertiesText(this, name, text, true);
  }

  loadGenomePropertiesFile() {
    loadGenomePropertiesFile(this);
  }

  getOrganismNameFromTaxId(taxId) {
    return (
      this.gp_taxonomy &&
      this.gp_taxonomy.nodes &&
      this.gp_taxonomy.nodes[taxId] &&
      this.gp_taxonomy.nodes[taxId].name
    );
  }

  refreshSVGHeight(newHeight) {
    if (newHeight > this.svg.attr("height")) {
      this.svg.attr("height", newHeight);
      this.options.height = newHeight;
      this.update_viewer();
    }
  }

  refresh() {
    transformByScroll(this);
  }

  async switchToERZMode() {
    // Save taxonomy state so we can restore it later
    const loaded_taxa = this.gp_taxonomy.nodes
      ? Object.values(this.gp_taxonomy.nodes)
          .filter((n) => n.loaded)
          .map((n) => n.taxid)
      : [];
    this._taxonomy_state = {
      data: this.data,
      organism_totals: this.organism_totals,
      propsOrder: this.propsOrder,
      loaded_taxa,
    };
    // Unload all currently loaded taxonomy organisms from the tree
    if (this.gp_taxonomy.nodes) {
      Object.values(this.gp_taxonomy.nodes).forEach((n) => {
        n.loaded = false;
      });
    }
    this.organisms = [];
    this.organism_totals = {};
    this.propsOrder = null;
    this.erz_mode = true;
    this.gp_taxonomy.show_tree = false;

    // Load the pre-built ERZ_MERGED.json (mirrors JSON_MERGED format,
    // with step names sourced from JSON_MERGED via `npm run create-erz-merged`)
    const data = await this.fileGetter.getJSON(this.options.erz_merged_path);
    preloadSpecies(this, data);
    this.update_viewer(0);
  }

  switchToTaxonomyMode() {
    // Remove ERZ fake nodes that were added to the taxonomy
    if (this.gp_taxonomy.nodes) {
      const erzNodes = Object.values(this.gp_taxonomy.nodes).filter(
        (n) => n.isFromFile
      );
      for (const node of erzNodes) {
        this.gp_taxonomy.remove_organism_loaded(node.taxid, true);
      }
    }
    // Restore saved taxonomy state
    const state = this._taxonomy_state || {};
    this.data = state.data || {};
    this.organism_totals = state.organism_totals || {};
    this.propsOrder = state.propsOrder || null;
    // Re-mark previously loaded taxa
    for (const taxId of state.loaded_taxa || []) {
      if (this.gp_taxonomy.nodes && this.gp_taxonomy.nodes[taxId]) {
        this.gp_taxonomy.nodes[taxId].loaded = true;
      }
    }
    this._taxonomy_state = null;
    this.erz_mode = false;
    this.gp_taxonomy.show_tree = true;
    this.update_viewer(0);
  }

  // Enable an ERZ organism from the pre-loaded ERZ_MERGED data
  enableERZ(erzCode) {
    enableSpeciesFromPreLoaded(this, erzCode, true, true);
  }

  // Remove an ERZ organism from the viewer
  removeERZ(erzCode) {
    removeGenomePropertiesFile(this, erzCode);
  }
}
