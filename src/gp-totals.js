import * as d3 from "./d3";

export const drawTotalPerOrganismPanel = (viewer) => {
  viewer.total_g = viewer.mainGroup
    .append("g")
    .attr("class", "total-group")
    .attr(
      "transform",
      `translate(${
        viewer.options.width - viewer.options.dimensions.total.short_side / 2
      }, ${viewer.options.dimensions.total.short_side / 2}
      )`
    );
};

export const refreshGPTotals = (viewer) => {
  for (const prop of viewer.props) {
    const total = {
      NO: 0,
      YES: 0,
      PARTIAL: 0,
    };
    for (const org of viewer.organisms) {
      total[prop.values[org]]++;
    }
    prop.values.TOTAL = total;
  }
};

const refreshOrganismTotals = (viewer) => {
  for (const o of Object.keys(viewer.organism_totals))
    viewer.organism_totals[o] = { YES: 0, NO: 0, PARTIAL: 0 };
  viewer.props.forEach((e) => {
    for (const v of Object.keys(viewer.organism_totals))
      viewer.organism_totals[v][e.values[v]]++;
  });
};

export const updateTotalPerOrganismPanel = (viewer) => {
  viewer.options.total_panel_height = viewer.options.cell_side;
  const ph = viewer.options.total_panel_height;

  viewer.total_g.attr(
    "transform",
    `translate(${
      viewer.options.width - viewer.options.dimensions.total.short_side / 2
    }, ${viewer.options.dimensions.total.short_side / 2}
      )`
  );

  const arc_f = d3
    .arc()
    .outerRadius(ph * 0.4)
    .innerRadius(0);

  const pie_f = d3.pie().value((d) => d.value);

  refreshOrganismTotals(viewer);

  const cells_t = viewer.total_g.selectAll(".total_cell_org").data(
    d3
      .entries(viewer.organism_totals)
      .sort(
        (a, b) =>
          viewer.organisms.indexOf(a.key) - viewer.organisms.indexOf(b.key)
      ),
    (d) => d.key
  );

  const newY = d3
    .scaleBand()
    .range([0, viewer.organisms.length * viewer.options.cell_side])
    .domain(viewer.current_order);

  cells_t.attr(
    "transform",
    (d, i) => `translate(0, ${newY(i) + viewer.options.cell_side})`
  );
  cells_t.exit().remove();

  const g_e = cells_t
    .enter()
    .append("g")
    .attr("class", "total_cell_org")
    .attr(
      "transform",
      (d, i) => `translate(0, ${newY(i) + viewer.options.cell_side})`
    )
    .on("mouseover", (event, p) => {
      d3.selectAll(".node--leaf text").classed(
        "active",
        () => viewer.textContent === p.key
      );
      viewer.controller.draw_tooltip(event, {
        Organism: p.key,
      });
      viewer.controller.draw_legends(p.value);
    })
    .on("mouseout", () => {
      viewer.controller.draw_legends();
      viewer.controller.draw_tooltip();
      d3.selectAll(".node--leaf text").classed("active", false);
    });

  const group = g_e.size() ? g_e : cells_t;
  const arcs = group.selectAll(".arc").data((d) => pie_f(d3.entries(d.value)));

  arcs.attr("d", arc_f).attr("transform", "scale(1)");

  arcs
    .enter()
    .append("path")
    .attr("class", "arc")
    .attr("d", arc_f)
    .style("fill", (d) => viewer.c[d.data.key]);
};
