import * as d3 from "./d3";

/**
 * @summary A cell in the heatmap can have 1 of 3 values: Yes, No or partial. Indicating if there is evidence that the GP is present in a given species.
 * Given multiple species, this function filters the list of genome properties to which currentluy selected species match the given condition, For example:
 *
 * |Value    | Filter | JSON               | Explanation                                          |
 * |---------|--------|--------------------|------------------------------------------------------|
 * | YES     | ∀      | `{"YES": "∀"}`     | All the species have this GP                         |
 * | NO      | ∃      | `{"NO": "∃"}`      | There is at least 1 species with this GP             |
 * | PARTIAL | ∄      | `{"PARTIAL": "∄"}` | None of the species have partial evidence of this GP |
 *
 * The current set of filters is in `viewer.legend_filters` and the filtered props will be saved in `viewer.props`.
 * @param {GernomeProperiesViewer} viewer - The instance of the genome properites viewer
 */
export const filterByLegend = (viewer) => {
  if (viewer.legend_filters) {
    for (const x of Object.keys(viewer.legend_filters)) {
      if (viewer.legend_filters[x] === "∀") {
        viewer.props = viewer.props.filter((prop) => {
          const values = d3
            .entries(prop.values)
            .filter((e) => viewer.organisms.indexOf(e.key) !== -1);
          return values.filter((e) => e.value === x).length === values.length;
        });
      } else if (viewer.legend_filters[x] === "∃") {
        viewer.props = viewer.props.filter((prop) => {
          const values = d3
            .entries(prop.values)
            .filter((e) => viewer.organisms.indexOf(e.key) !== -1);
          return values.filter((e) => e.value === x).length > 0;
        });
      } else if (viewer.legend_filters[x] === "∄") {
        viewer.props = viewer.props.filter((prop) => {
          const values = d3
            .entries(prop.values)
            .filter((e) => viewer.organisms.indexOf(e.key) !== -1);
          return values.filter((e) => e.value === x).length === 0;
        });
      }
    }
  }
};

/**
 * Genome Properties are organised in a hierarchy. By invoking this function, the list of properties in `viewer.props` is filtered
 * by only including those whose `parent_top_properties` are included in `viewer.gp_hierarchy`
 * @param {GernomeProperiesViewer} viewer - The instance of the genome properites viewer
 */
export const filterByHierarchy = (viewer) => {
  viewer.props = viewer.props.filter((e) => {
    if (e.parent_top_properties === null) return true;
    for (const p of e.parent_top_properties)
      for (const tp of viewer.gp_hierarchy.hierarchy_switch)
        if (p === tp.id && tp.enable) return true;
    return false;
  });
};

/**
 * Filters the list of properties in `viewer.props` by checnking if their name includes the text in `viewer.filter_text`
 * @param {GernomeProperiesViewer} viewer - The instance of the genome properites viewer
 */
export const filterByText = (viewer) => {
  if (viewer.filter_text) {
    viewer.props = viewer.props.filter(
      (e) =>
        e.name.toLowerCase().indexOf(viewer.filter_text.toLowerCase()) !== -1 ||
        String(e.property)
          .toLowerCase()
          .indexOf(viewer.filter_text.toLowerCase()) !== -1,
    );
  }
};
