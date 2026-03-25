import * as d3 from "./d3";

export default class TaxonomyNodeManager {
  constructor(tax_component, r = 6) {
    this.tree_g = null;
    this.main = tax_component;
    this.t = null;
    this.r = r;
  }

  draw_nodes(visible_nodes, t) {
    this.t = t;
    const move_leaf = (d, d_col) => {
      const current_i = this.main.organisms.indexOf(d.data.id);
      const current_o = this.main.current_order.indexOf(current_i);
      d_col = current_o + d_col < 0 ? -current_o : d_col;
      if (d_col !== 0) {
        const e = this.main.current_order.splice(current_o, 1);
        this.main.current_order.splice(current_o + d_col, 0, e[0]);
        this.main.update_tree(1000);
        this.main.dispatcher.call(
          "changeOrder",
          this.main,
          this.main.current_order,
        );
      }
    };
    const move_tree = (d, d_col) => {
      if (!d.children) {
        move_leaf(d, d_col);
      } else {
        d.children.sort((a, b) => (d_col > 0 ? b.x - a.x : a.x - b.x));
        for (const child of d.children) move_tree(child, d_col);
      }
    };

    const node = this.tree_g
      .selectAll(".node")
      .data(visible_nodes, (d) => d.data.id);

    node
      .attr(
        "class",
        (d) =>
          `node ${d.children ? " node--internal" : " node--leaf"}${
            d.data.loaded ? " loaded" : ""
          }`,
      )
      .style("fill-opacity", (d) => (d.data.id === "fake-root" ? 0 : null))
      .transition(t)
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .each((d, i, c) => this.update_node(d, i, c));
    node.exit().remove();
    node
      .enter()
      .append("g")
      .attr(
        "class",
        (d) =>
          `node ${d.children ? " node--internal" : " node--leaf"}${
            d.data.loaded ? " loaded" : ""
          }`,
      )
      .style("fill-opacity", (d) => (d.data.id === "fake-root" ? 0 : null))
      .on("mouseover", (event, d) => {
        d3.select("#info_organism").text(
          `${d.label}${d.data.taxid ? ` - ${d.data.taxid}` : ""}`,
        );
        d3.select(event.currentTarget)
          .selectAll("circle")
          .transition(300)
          .attr("r", this.r + 2);
      })
      .on("mouseout", (event) => {
        d3.select("#info_organism").text("");
        d3.select(event.currentTarget)
          .selectAll("circle")
          .transition(300)
          .attr("r", (d) => {
            if (d.children || d._children) return this.r;
            if (d.data.loaded) return this.r / 2;
            return this.r - 2;
          });
      })
      .on("click", (event, d) => {
        if (
          !d.data.loaded &&
          (!d.data.children || d.data.children.length === 0)
        ) {
          // Only leaves have taxId attached
          this.main.dispatcher.call(
            "speciesRequested",
            this.main,
            d.data.taxid,
          );
        }
        if (d.parent) {
          setTimeout(() => {
            d.data.expanded = !d.data.expanded;
            // _prune_to_opu() creates shallow copies, so also sync to the
            // original node so the state persists across update_tree() calls.
            const orig = this.main.nodes && this.main.nodes[d.data.taxid];
            if (orig && orig !== d.data) orig.expanded = d.data.expanded;
            this.main.update_tree(500);
          }, 200);
        }
      })
      .on("dblclick", (event, d) => {
        if (!d.data.children || d.data.children.length === 0) {
          // Only leaves have taxId attached
          this.main.dispatcher.call(
            "speciesRequested",
            this.main,
            d.data.taxid,
          );
        }
        if (d.parent) {
          this.main.dispatcher.call(
            "multipleSpeciesRequested",
            this.main,
            this.main.getLeaves(d.data),
          );
        }
      })
      .call(
        d3
          .drag()
          .subject((event) => {
            const g = d3.select(event.sourceEvent.target.closest("g.node"));
            const transform = g
              .attr("transform")
              .match(/translate\((.*),(.*)\)/);
            const pos = {
              x: Number(transform[1]), // + Number(g.attr("x")),
              y: Number(transform[2]), // + Number(g.attr("y")),
            };
            return pos;
          })
          .on("drag", (event, d) => {
            event.sourceEvent.stopPropagation();
            const g = d3.select(event.sourceEvent.target.closest("g.node"));
            if (d.has_loaded_leaves) {
              g.attr("transform", (p) => `translate(${p.x},${event.y})`);
            }
          })
          .on("end", (event, d) => {
            if (d.has_loaded_leaves) {
              const g = d3.select(event.sourceEvent.target.closest("g.node"));
              const w = this.main.cell_side;
              const dy = event.y - d.y; // - w/2,
              const d_row = Math.round(dy / w);
              move_tree(d, d_row);
              const time = d3.transition().duration(500);
              g.transition(time).attr(
                "transform",
                (p) => `translate(${p.x},${p.y})`,
              );
            }
          }),
      )
      .each((d, i, c) => this.draw_node(d, i, c));
  }

  draw_node(node, i, context) {
    const g = d3.select(context[i]);
    g.append("circle");
    g.attr("transform", (d) => `translate(${d.x},${d.y})scale(0)`)
      .transition(this.t)
      .delay(300)
      .attr("transform", (d) => `translate(${d.x},${d.y})scale(1)`);

    g.append("text")
      .attr("class", "label-leaves")
      .attr("x", -this.r)
      .attr("y", -this.r)
      .style("text-anchor", "end")
      .text((d) =>
        d.data.number_of_leaves > 1 ? d.data.number_of_leaves : "",
      );

    g.append("text")
      .attr("class", "label-species")
      .attr("x", -this.r / 2)
      .attr("y", this.r + 4)
      .style("text-anchor", "end")
      .style("fill", (d) =>
        d.data.isFromFile && d.data.loaded ? "darkred" : null,
      )
      .text((d) => {
        let label = "";
        if (d.label !== "ROOT") {
          if (d.children || d._children) label = d.label;
          else {
            switch (this.main.tax_label_type) {
              case "id":
                label = d.data.taxid;
                break;
              case "both":
                label = `${d.data.taxid}: ${d.label}`;
                break;
              default:
                break;
            }
          }
        }
        return label;
      });

    g.append("path")
      .attr("class", "node-type")
      .attr("fill", "white")
      .on("click", (event, d) => {
        if (d.data.loaded) {
          this.main.dispatcher.call(
            "removeSpecies",
            this.main,
            event,
            d.data.taxid,
          );
        } else if (
          d.data.isFromFile &&
          (!d.data.children || d.data.children.length === 0)
        ) {
          // Stop propagation so the group click handler doesn't also fire
          // speciesRequested for the same leaf node.
          event.stopPropagation();
          this.main.dispatcher.call(
            "speciesRequested",
            this.main,
            d.data.taxid,
          );
        }
      });

    this.update_node(node, i, context);
  }

  update_node(node, i, context) {
    const g = d3.select(context[i]);
    const { r } = this;

    g.selectAll(".label-leaves").text(
      node.data.number_of_leaves > 1 ? node.data.number_of_leaves : "",
    );

    g.selectAll("circle").attr("r", (d) => {
      if (d.children || d._children) return r;
      if (d.data.loaded) return r / 2;
      return r - 2;
    });

    g.selectAll(".node-type")
      .attr("d", (d) => {
        const s = d3.symbol().size((4 * r * r) / 5);
        if (d.data.loaded) {
          s.type(d3.symbolCross);
          return s();
        }
        if (d.children || d._children) {
          s.type(d.data.expanded ? d3.symbolTriangle : d3.symbolCross);
        } else {
          s.type(d3.symbolCircle);
        }
        return s();
      })
      .attr("transform", (d) => (d.data.loaded ? "rotate(45)" : null))
      .attr("fill", (d) => (d.data.loaded ? "rgb(183, 83, 84)" : "white"));
    g.selectAll(".label-species")
      .style("pointer-events", node.data.loaded ? "auto" : "none")
      .style("user-select", node.data.loaded ? "auto" : "none")
      .style(
        "fill",
        node.data.isFromFile && node.data.loaded ? "darkred" : null,
      )
      .text(() => {
        // Unloaded OPU leaf nodes: suppress label
        if (
          node.data.isFromFile &&
          !node.data.loaded &&
          !node.children &&
          !node._children
        )
          return "";
        let label = "";
        if (node.label !== "ROOT") {
          label = node.label;
          if (node.data.taxid) {
            switch (this.main.tax_label_type) {
              case "id":
                label = node.data.taxid;
                break;
              case "both":
                label = `${node.data.taxid}: ${node.label}`;
                break;
              default:
                break;
            }
          }
        }
        return label;
      });
  }
}
