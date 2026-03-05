import * as d3 from "./d3";

const displayStepsModal = (viewer, gp) => {
  const organisms = viewer.gp_taxonomy.current_order.map(
    (i) => viewer.organisms[i]
  );

  const html = `<h3>Steps for ${gp.property}</h3>
        <table>
            <tr>
                <th>Step</th>
                <th>Name</th>
                ${organisms
                  .map(
                    (o) =>
                      `<th>${viewer.getOrganismNameFromTaxId(
                        o
                      )}<br/>(${o})</th>`
                  )
                  .join("")}
            </tr>
            ${gp.steps
              .map(
                (step) => `
            <tr>
                <td>${step.step}</td>
                <td>${step.step_name}</td>
                ${organisms
                  .map(
                    (o) => `
                    <td class="gp-${gp.values[o]}">
                        <div class="step-popup ${
                          step.values[o] ? "passed" : "failed"
                        }" />
                     </td>`
                  )
                  .join("")}
            </tr>
            `
              )
              .join("")}
        </table>
    `;
  viewer.modal.showContent(html);
};

const updateStepDetailsButton = (viewer, gp, element, cellSide) => {
  const localY =
    viewer.organisms.length * cellSide +
    viewer.options.dimensions.scroller.short_side;
  const x0 = cellSide * 0.1;
  const side = cellSide * 0.8;
  const top = cellSide * 0.1;
  const half = side / 2;

  const buttonG = d3
    .select(element)
    .selectAll(".step-details-button")
    .data(gp.isShowingSteps ? [gp] : [], (d) => d.property);

  buttonG.exit().remove();

  const button = buttonG
    .enter()
    .append("g")
    .attr("class", "step-details-button")
    .on("click", () => displayStepsModal(viewer, gp));

  button.append("circle");

  button.append("path").attr("fill", "white");

  buttonG
    .merge(button)
    .attr("transform", `translate(${cellSide}, ${localY})`)
    .selectAll("circle")
    .transition()
    .attr("cx", x0 + half)
    .attr("cy", top + half)
    .attr("r", half);

  const symbol1 = d3.symbol()
    .type(d3.symbolCross)
    .size((cellSide / 2) ** 2);
  buttonG
    .merge(button)
    .selectAll("path")
    .transition()
    .attr("d", symbol1())
    .attr("transform", `translate(${x0 + half}, ${top + half})`);
};

export const updateSteps = (viewer, gp, element, cellSide, yScale) => {
  const side = cellSide * 0.6;
  const p = cellSide * 0.2;

  const steps = d3
    .select(element)
    .selectAll(".step")
    .data(gp.isShowingSteps ? gp.steps : []);

  steps.exit().remove();

  const step_g = steps
    .enter()
    .append("g")
    .attr("class", "step")
    .merge(steps)
    .attr("transform", (d, i) => `translate(${i * cellSide + p}, 0)`);

  const onMouseOver = (event, d) => {
    viewer.controller.draw_tooltip(event, {
      Property: gp.property,
      Name: gp.name,
      Step: `${d.step}. ${d.stepName}`,
      Passed: d.value ? "YES" : "NO",
      Organism: d.organism,
    });
  };
  const onMouseOut = () => {
    viewer.controller.draw_tooltip();
  };
  const stepPerSpecie = step_g
    .merge(steps)
    .selectAll(".step-per-specie")
    .data(
      (d, i) =>
        viewer.organisms.map((organism) => ({
          organism,
          value: gp.steps[i].values[organism],
          step: gp.steps[i].step,
          stepName: gp.steps[i].step_name,
          key: `${organism}__${i}`,
        })),
      (d) => d.key
    );
  stepPerSpecie.exit().remove();
  stepPerSpecie
    .enter()
    .append("rect")
    .attr("class", "step-per-specie")
    .attr("stroke", "black")
    .on("mouseover", onMouseOver)
    .on("mouseout", onMouseOut)
    .merge(stepPerSpecie)
    .attr("y", (d, i) => yScale(i) + p)
    .transition()
    .attr("width", side)
    .attr("height", side)
    .attr("fill", (d) =>
      d.value ? "rgba(100,250,100,0.7)" : "rgba(200,200,200,0.3)"
    );
};

export const updateStepToggler = (viewer, gp, element, cellSide) => {
  const onClick = (event, id) => {
    viewer.data[id].isShowingSteps = !viewer.data[id].isShowingSteps;
    viewer.update_viewer();
  };
  const localY =
    viewer.organisms.length * cellSide +
    viewer.options.dimensions.scroller.short_side;

  const toggler = d3
    .select(element)
    .selectAll(".step-toggler")
    .data([gp.property], (d) => d);

  const x0 = 0.1;
  const side = cellSide * 0.8;
  const top = cellSide * 0.1;
  const half = side / 2;
  const fifth = side / 5;

  const expand =
    `M${x0 + half},${top + 2 * fifth}L${x0 + side},${top + 2 * fifth}L${
      x0 + half
    },${top}L${x0},${top + 2 * fifth}L${x0 + half},${top + 2 * fifth}` +
    `L${x0 + half},${top + 3 * fifth}` +
    `L${x0 + side},${top + 3 * fifth}L${x0 + half},${top + side}L${x0},${
      top + 3 * fifth
    }L${x0 + half},${top + 3 * fifth}Z`;

  const collapse =
    `M${x0 + half},${top + 2 * fifth}L${x0 + side},${top}L${x0},${top}L${
      x0 + half
    },${top + 2 * fifth}` +
    `L${x0 + half},${top + 3 * fifth}` +
    `L${x0 + side},${top + side}L${x0},${top + side}L${x0 + half},${
      top + 3 * fifth
    }Z`;

  const newG = toggler
    .enter()
    .append("g")
    .attr("class", "step-toggler")
    .on("click", onClick);

  newG.append("circle").attr("fill", "rgba(30,60,90,0)");

  newG.append("path").attr("fill", "rgba(30,60,90,0.2)");

  newG
    .merge(toggler)
    .attr(
      "transform",
      `translate(0, ${localY})rotate(90,${cellSide / 2},${cellSide / 2})`
    )
    .attr(
      "class",
      (id) => `step-toggler ${viewer.data[id].isShowingSteps ? "expanded" : ""}`
    )
    .selectAll("path")
    .transition()
    .attr("d", (id) => (viewer.data[id].isShowingSteps ? collapse : expand));

  newG
    .merge(toggler)
    .selectAll("circle")
    .transition()
    .attr("cx", x0 + half)
    .attr("cy", top + half)
    .attr("r", half);

  updateStepDetailsButton(viewer, gp, element, cellSide);
};
