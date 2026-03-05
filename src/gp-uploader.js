import { tsvParseRows, select } from "./d3";

const isLineOK = (line) => line.length === 3;

const mergeObjectToData = (data, obj) => {
  for (const gp of Object.keys(data)) {
    for (const newOrg of Object.keys((obj[gp] && obj[gp].values) || {})) {
      if (newOrg !== "TOTAL") data[gp].values[newOrg] = obj[gp].values[newOrg];
    }
    const stepsObj = ((obj[gp] && obj[gp].steps) || []).reduce((agg, v) => {
      agg[v.step] = v;
      return agg;
    }, {});
    for (const step of data[gp].steps) {
      for (const newOrg of Object.keys(stepsObj[step.step].values)) {
        step.values[newOrg] = stepsObj[step.step].values[newOrg];
      }
    }
  }
};

export const enableSpeciesFromPreLoaded = (
  viewer,
  taxId,
  isFromFile = false,
  shouldUpdate = true
) => {
  let tax_id = Number(taxId);
  if (Number.isNaN(tax_id)) tax_id = taxId;
  viewer.gp_taxonomy.set_organisms_loaded(tax_id, isFromFile);
  viewer.organisms.push(tax_id);
  viewer.organism_totals[tax_id] = { YES: 0, NO: 0, PARTIAL: 0 };
  if (shouldUpdate) viewer.update_viewer(500);
};

export const loadGenomePropertiesText = (
  viewer,
  label,
  text,
  isFromFile = false
) => {
  try {
    const obj = JSON.parse(text);
    mergeObjectToData(viewer.data, obj);
    const objOrgs = Object.keys(Object.values(obj)[0].values).filter(
      (x) => x !== "TOTAL"
    );
    for (const org of objOrgs) {
      enableSpeciesFromPreLoaded(viewer, org, isFromFile);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("File is not JSON. Trying to parse it as TSV now.");
    const wl = viewer.whitelist;
    let tax_id = Number(label);
    if (isFromFile) tax_id = label;
    viewer.organisms.push(tax_id);
    viewer.organism_totals[tax_id] = { YES: 0, NO: 0, PARTIAL: 0 };
    let allLinesAreOK = true;
    const errorLines = [];
    tsvParseRows(text, (d, i) => {
      if (!isLineOK(d)) {
        allLinesAreOK = false;
        errorLines.push([i, d]);
      }
      if (wl && wl.indexOf(d[0]) === -1) return;
      if (!(d[0] in viewer.data))
        viewer.data[d[0]] = {
          property: d[0],
          name: d[1],
          values: { TOTAL: { YES: 0, NO: 0, PARTIAL: 0 } },
          parent_top_properties: viewer.gp_hierarchy.get_top_level_gp_by_id(
            d[0]
          ),
          // TODO: Replace for actual steps information
          steps: d[0]
            .slice(7)
            .split("")
            .filter((x) => x !== "0")
            .reduce((agg) => {
              agg.push({
                step: agg.length + 1,
                values: {},
              });
              return agg;
            }, []),
          isShowingSteps: false,
        };
      if (tax_id in viewer.data[d[0]].values) return;
      viewer.data[d[0]].values[tax_id] = d[2];
      viewer.data[d[0]].values.TOTAL[d[2]]++;
      viewer.organism_totals[tax_id][d[2]]++;
      // TODO: Replace for actual steps information
      viewer.data[d[0]].steps.forEach(
        (step) => (step.values[tax_id] = Math.random() > 0.5)
      );
    });
    if (allLinesAreOK) {
      viewer.gp_taxonomy.set_organisms_loaded(tax_id, isFromFile);
      if (!viewer.propsOrder)
        viewer.propsOrder = Object.keys(viewer.data).sort();
      viewer.update_viewer(500);
    } else {
      viewer.organisms.splice(viewer.organisms.indexOf(tax_id), 1);
      delete viewer.organism_totals[tax_id];
      throw new Error(
        `File didn't load. The following lines have errors:${errorLines
          .map((l) => l.join(": "))
          .join("\n")}`
      );
    }
  }
};

export const preloadSpecies = (viewer, data) => {
  viewer.data = data;
  Object.values(viewer.data).forEach((gp) => {
    gp.parent_top_properties = viewer.gp_hierarchy.get_top_level_gp_by_id(
      gp.property
    );
    gp.isShowingSteps = false;
  });
};

export const removeGenomePropertiesFile = (viewer, id) => {
  let tax_id = Number(id);
  const isFromFile = Number.isNaN(tax_id);
  if (isFromFile) tax_id = id;
  delete viewer.organism_totals[tax_id];
  const i = viewer.organisms.indexOf(tax_id);
  viewer.organisms.splice(i, 1);
  viewer.gp_taxonomy.remove_organism_loaded(tax_id, isFromFile);
  viewer.update_viewer(500);
};

function concat(arrays) {
  let i = 0;
  let n = 0;
  for (const a of arrays) n += a.length;
  const newArray = new Uint8Array(n);
  for (const a of arrays) {
    newArray.set(a, i);
    i += a.length;
  }
  return newArray.buffer;
}
export class FileGetter {
  constructor({ element = "body", viewer }) {
    this.base = select(element);
    this.files = {};
    this.isActive = false;
    this.viewer = viewer;
    this.activeGauge = 0;
    this.activeGauges = [];
    setInterval(
      (_this) => {
        if (_this.activeGauges.length > 0)
          _this.activeGauge = (_this.activeGauge + 1) % _this.activeGauges.length;
      },
      3000,
      this
    );
  }

  getJSON(path) {
    return this.getText(path, true);
  }

  async getText(path, shouldParseAsJSON = false) {
    if (this.files[path]) return this.files[path].request;
    this.files[path] = {
      loading: true,
      path,
    };
    const { modal } = this.viewer;
    if (!this.isActive) this.createProgressContent(modal);
    // this.activeGauge = path;
    const response = await fetch(path);
    this.files[path].request = response;
    const total = response.headers.get("content-length");
    const reader = response.body && response.body.getReader();
    const values = [];
    let loaded = 0;
    let responseAsArrayBuffer = null;
    if (!reader) {
      responseAsArrayBuffer = await response.arrayBuffer();
      loaded = responseAsArrayBuffer.byteLength;
      this.files[path].progress = 1;
    } else {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.length;
        this.files[path].progress = total ? loaded / total : null;
        this.files[path].event = {
          total,
          loaded,
        };
        this.updateProgress();
        values.push(value);
      }
      responseAsArrayBuffer = concat(values);
    }
    const codeUnits = new Uint8Array(responseAsArrayBuffer);
    let text = "";
    for (let i = 0; i < codeUnits.length; i++) {
      text += String.fromCharCode(codeUnits[i]);
    }
    this.files[path].loading = false;
    this.files[path].data = shouldParseAsJSON ? JSON.parse(text) : text;

    if (Object.values(this.files).every((file) => !file.loading)) {
      modal.setVisibility(false);
      this.isActive = false;
    }

    return this.files[path].data;
  }

  createProgressContent(modal) {
    modal.showContent("", true);
    this.progressContent = modal.getContentElement();
    this.progressContent.append("h1").text("Loading Assets");
    const pp = this.progressContent
      .append("div")
      .attr("class", "progress-panel");
    this.gaugeDiv = pp.append("div").attr("class", "gauges-panel");
    this.gaugeSVG = this.gaugeDiv
      .append("svg")
      .attr("width", "10vw")
      .attr("height", "10vw")
      .attr("class", "gauges");
    this.gaugeLabel = this.gaugeDiv
      .append("div")
      .attr("class", "gauge-label")
      .text("...");
    this.requestsList = pp.append("div").attr("class", "requests-list");
    this.isActive = true;
  }

  updateProgress() {
    if (!this.isActive) return;

    const files = Object.values(this.files);
    const total = {
      path: "TOTAL",
      progress:
        files.reduce((agg, v) => agg + (v.progress || 0), 0) / files.length,
    };
    this.activeGauges = files
      .concat(total)
      .filter((f) => f.progress === null || f.progress < 1);
    this.gaugeLabel.text(
      this.activeGauges[this.activeGauge]
        ? this.activeGauges[this.activeGauge].path
        : ""
    );

    const requestDiv = this.requestsList
      .selectAll("div.request")
      .data(files, (d) => d.path);
    requestDiv
      .enter()
      .append("div")
      .attr("class", "request")
      .merge(requestDiv)
      .text(
        (d) => `${d.path}: 
        ${d.progress ? (d.progress * 100).toFixed(1) : " ? "}% 
        - ${d.event ? d.event.loaded : "_"}/${(d.event && d.event.total) || "?"}
       `
      );

    const w = this.gaugeSVG.node().getBoundingClientRect().width;

    const gauges = this.gaugeSVG.selectAll("g.gauge").data(this.activeGauges);
    const current = this.activeGauge;

    const gauge = gauges
      .enter()
      .append("g")
      .attr("class", "gauge")
      .attr("transform", (d, i) => `translate(0,${w * (i - current)})`);

    const r = w / 2 - 10;

    const circunferencia = 2 * Math.PI * r;
    gauge
      .append("circle")
      .attr("class", "gauge-bg")
      .attr("r", r)
      .attr("cx", w / 2)
      .attr("cy", w / 2);
    gauge
      .append("circle")
      .attr("class", "gauge-val")
      .attr("stroke-linecap", "round")
      .attr("stroke-dasharray", circunferencia)
      .attr("stroke-dashoffset", circunferencia)
      .attr("r", r)
      .attr("transform", `rotate(90,${w / 2},${w / 2})`)
      .attr("cx", w / 2)
      .attr("cy", w / 2);

    gauge
      .append("text")
      .attr("class", "percentage")
      .attr("x", w / 2)
      .attr("y", w / 2);

    gauges
      .transition()
      .attr("transform", (d, i) => `translate(0,${w * (i - current)})`);
    gauges
      .select(".percentage")
      .text((d) => (d.progress ? `${(d.progress * 100).toFixed(1)}%` : "?"));
    gauges
      .select(".gauge-val")
      .classed("uncertain", (d) => d.progress === null)
      .attr("stroke-dashoffset", (d) =>
        d.progress === null
          ? circunferencia / 2
          : circunferencia * (1 - d.progress)
      );
  }
}
export const loadGenomePropertiesFile = (viewer, tax_id) => {
  if (viewer.organisms.indexOf(Number(tax_id)) !== -1) return;
  fetch(viewer.options.server.replace("{}", tax_id))
    .then((response) => {
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.text();
    })
    .then((text) => {
      loadGenomePropertiesText(viewer, tax_id, text);
      viewer.update_viewer(500);
    });
};

function isIpproLine(line) {
  const parts = line.split("\t");
  return !(parts.length < 11 || parts[1].length !== 32);
}

export const uploadLocalGPFile = (viewer, fileToRead) => {
  const reader = new FileReader();
  reader.fileToRead = fileToRead;
  reader.onload = (evt) => {
    try {
      const firstline = evt.target.result.split("\n")[0];
      if (isIpproLine(firstline)) {
        viewer.modal.showContent(
          "<h3><div class='loading'>◉</div>Calculation Genome Properties from InterProScan Data</h3>",
          true
        );

        fetch(viewer.options.gp_server, {
          method: "POST",
          body: `ipproname=${reader.fileToRead.name}&ipprotsv=${evt.target.result}`,
          headers: new Headers({
            "Content-Type": "application/x-www-form-urlencoded",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "X-PINGOTHER, Content-Type",
          }),
        })
          .then((response) => response.text())
          .then((x) => {
            viewer.loadGenomePropertiesText(reader.fileToRead.name, x);
            viewer.modal.setVisibility(false);
          })
          .catch(() => {
            viewer.modal.showContent(
              "<h3><div class='error'>Server Error processing the file</div></h3>",
              false
            );
          });
      } else {
        viewer.loadGenomePropertiesText(
          reader.fileToRead.name,
          evt.target.result
        );
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
    document.getElementById("newfile").value = null;
  };
  reader.readAsText(fileToRead);
};
