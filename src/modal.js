import * as d3 from "./d3";
/**
 * Manager for a modal dialog, that has an overlay grey area and a dialog box in the middle
 */
class GPModal {
  /**
   * Appends the divs for the modal overlay and the popup.
   * Inside the popup creates a `div` element with a refence in `this.content`.
   * @param {HTMLElement} element - DOM element where the modal should be appended.
   */
  constructor(element) {
    this.fixed = false;
    this.mask = d3
      .selectAll(element)
      .append("div")
      .attr("class", "gp-modal")
      .on("click", () => !this.fixed && this.setVisibility(false));
    this.popup = d3
      .selectAll(element)
      .append("div")
      .attr("class", "gp-modal-popup");
    this.content = this.popup.append("div").attr("class", "gp-modal-content");
  }

  /**
   * Sets the visibility of the components of the modal
   * @param {Boolean} visibility - visibility of the components of the modal
   */
  setVisibility(visibility) {
    if (!visibility) this.fixed = false;
    this.mask.classed("gp-modal-active", visibility);
    this.popup.classed("gp-modal-active", visibility);
    this.content.classed("gp-modal-active", visibility);
  }

  /**
   * Sets the content of the popup, and sets the visibility to `true`
   * @param {String} content - HTML to be appended in the dialog.
   * @param {Boolean} fixed - If `false`, a click on the layover area closes the dialog..
   */
  showContent(content, fixed = false) {
    this.fixed = fixed;
    this.content.html(content);
    this.setVisibility(true);
  }

  /**
   * Returns the reference(created in d3) to the content object.
   * @return {D3Selector} Reference(created in d3) to the content object.
   */
  getContentElement() {
    return this.content;
  }
}

export default GPModal;
