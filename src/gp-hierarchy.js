import * as d3 from "./d3";
/**
 * Genome Properties are organized in a hierarchy.
 * This Class manages the file that defines that hierarchy and uses is to allow filtering over the heatmap
 */
class GenomePropertiesHierarchy {
  /**
   * Initializes all the class attributes.
   */
  constructor() {
    /**
     * Hashmap object from nodeId to its object.
     * @type {Object}
     * */
    this.nodes = {};
    /**
     * Reference to the root of the GP hierarchy
     * @type {Object}
     * */
    this.root = null;
    /**
     * List of top level GP indicating if its enabled or not for filtering purposes
     * @type {Array}
     * */
    this.hierarchy_switch = [];
    /**
     * Event dispatcher using `d3.dispatch`
     * @type {Object}
     * */
    this.dispatcher = d3.dispatch("switchChanged", "hierarchyLoaded");
  }

  /**
   * Fetches  the hierarchy from a given URL, and triggers the processing of the file.
   * @param {String} path - The URL where the hierarchy file is.
   * @return {GenomePropertiesHierarchy} The curent instance for chaining methods.
   */
  load_hierarchy_from_path(path) {
    fetch(path)
      .then((response) => {
        if (!response.ok)
          throw new Error(`${response.status} ${response.statusText}`);
        return response.json();
      })
      .then((data) => {
        this.load_hierarchy_from_data(data);
      });

    return this;
  }

  /**
   * Defines all the attributes by processing the JSON object
   * @param {Object} data - Object representing the root of the Hierarchy
   */
  load_hierarchy_from_data(data) {
    this.root = data;
    this.nodes = {};
    this.add_node_recursively(this.root);
    this.color = d3
      .scaleOrdinal()
      .domain(this.root.children.map((d) => d.id))
      .range(d3.schemeCategory20b);
    this.hierarchy_switch = this.root.children.map((d) => ({
      id: d.id,
      enable: true,
    }));
    this.dispatcher.call("hierarchyLoaded", this, this.root);
  }

  /**
   * Walks the tree, adding each node in `this.nodes` and generating a list of parents(in `node.parents`) for each node.
   * @param {Object} node - each node has the shape `{id: <String>, name: <String>, children: [<Node>]}`.
   */
  add_node_recursively(node, parent = null) {
    if (!node.parents) node.parents = [];
    if (parent) node.parents.push(parent);
    if (!this.nodes[node.id]) {
      this.nodes[node.id] = node;
    } else {
      this.nodes[node.id].parents.splice(0, 0, ...node.parents);
    }
    if (node.children && node.children.length > 0)
      for (const child of node.children) this.add_node_recursively(child, node);
  }

  /**
   * Gets the node from `this.nodes` and searches it top level properties
   * @param {String} id - node present in this.nodes
   * @return {Array} Array of ids of the top level properties.
   */
  get_top_level_gp_by_id(id) {
    if (id in this.nodes)
      return [...this.get_top_level_gp(this.nodes[id])].map((d) => d.id);
    return [];
  }

  /**
   * Gets the top level genome properties associated with a given node
   * @param {Object} node - node present in this.nodes
   * @return {Set} Set of top level genome properties.
   */
  get_top_level_gp(node) {
    if (node === this.root) return null;
    if (node.top_level_gp) return node.top_level_gp;
    if (node.parents.indexOf(this.root) !== -1) {
      node.top_level_gp = new Set([node]);
      return node.top_level_gp;
    }
    node.top_level_gp = new Set();
    for (const parent of node.parents) {
      node.top_level_gp = new Set([
        ...node.top_level_gp,
        ...this.get_top_level_gp(parent),
      ]);
    }
    return node.top_level_gp;
  }

  /**
   * Finds the top level property with the given id, toggles the value of `enable`, and then dispatches an event announcing the change.
   * @param {String} id - Id of the top level genome property
   */
  toggle_switch(id) {
    this.hierarchy_switch.forEach((e) => {
      if (e.id === id.id) e.enable = !e.enable;
    });
    this.dispatcher.call("switchChanged", this, this.hierarchy_switch);
  }

  /**
   * shortcut to add invoke a callback when one of the dispatched events gets trigger
   * @param {String} typename - one of the dispatched events: "switchChanged", "hierarchyLoaded"
   * @return {GenomePropertiesHierarchy} The curent instance for chaining methods.
   */
  on(typename, callback) {
    this.dispatcher.on(typename, callback);
    return this;
  }
}

export default GenomePropertiesHierarchy;
