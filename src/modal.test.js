// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import GPModal from "./modal";

describe("GPModal", () => {
  let container;
  let modal;

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "test-modal-host";
    document.body.appendChild(container);
    // GPModal uses d3.selectAll(element) — pass a CSS selector so d3 can
    // resolve it against the document and append children to the right node.
    modal = new GPModal("#test-modal-host");
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  // ── construction ──────────────────────────────────────────
  describe("constructor", () => {
    it("appends a .gp-modal overlay element", () => {
      expect(container.querySelector(".gp-modal")).not.toBeNull();
    });

    it("appends a .gp-modal-popup element", () => {
      expect(container.querySelector(".gp-modal-popup")).not.toBeNull();
    });

    it("appends a .gp-modal-content element inside the popup", () => {
      expect(
        container.querySelector(".gp-modal-popup .gp-modal-content"),
      ).not.toBeNull();
    });

    it("starts with fixed=false", () => {
      expect(modal.fixed).toBe(false);
    });
  });

  // ── setVisibility ─────────────────────────────────────────
  describe("setVisibility", () => {
    it("true adds gp-modal-active to mask, popup and content", () => {
      modal.setVisibility(true);
      expect(
        container
          .querySelector(".gp-modal")
          .classList.contains("gp-modal-active"),
      ).toBe(true);
      expect(
        container
          .querySelector(".gp-modal-popup")
          .classList.contains("gp-modal-active"),
      ).toBe(true);
      expect(
        container
          .querySelector(".gp-modal-content")
          .classList.contains("gp-modal-active"),
      ).toBe(true);
    });

    it("false removes gp-modal-active from all elements", () => {
      modal.setVisibility(true);
      modal.setVisibility(false);
      expect(
        container
          .querySelector(".gp-modal")
          .classList.contains("gp-modal-active"),
      ).toBe(false);
      expect(
        container
          .querySelector(".gp-modal-popup")
          .classList.contains("gp-modal-active"),
      ).toBe(false);
      expect(
        container
          .querySelector(".gp-modal-content")
          .classList.contains("gp-modal-active"),
      ).toBe(false);
    });

    it("false resets fixed to false", () => {
      modal.fixed = true;
      modal.setVisibility(false);
      expect(modal.fixed).toBe(false);
    });

    it("true does not reset fixed", () => {
      modal.fixed = true;
      modal.setVisibility(true);
      expect(modal.fixed).toBe(true);
    });
  });

  // ── showContent ───────────────────────────────────────────
  describe("showContent", () => {
    it("sets innerHTML of the content element", () => {
      modal.showContent("<p>hello</p>");
      expect(container.querySelector(".gp-modal-content").innerHTML).toBe(
        "<p>hello</p>",
      );
    });

    it("makes the modal visible", () => {
      modal.showContent("<p>hello</p>");
      expect(
        container
          .querySelector(".gp-modal")
          .classList.contains("gp-modal-active"),
      ).toBe(true);
    });

    it("fixed=false (default) — overlay click closes the modal", () => {
      modal.showContent("test", false);
      container.querySelector(".gp-modal").click();
      expect(
        container
          .querySelector(".gp-modal")
          .classList.contains("gp-modal-active"),
      ).toBe(false);
    });

    it("fixed=true — overlay click does NOT close the modal", () => {
      modal.showContent("test", true);
      container.querySelector(".gp-modal").click();
      expect(
        container
          .querySelector(".gp-modal")
          .classList.contains("gp-modal-active"),
      ).toBe(true);
    });

    it("sets fixed on the instance", () => {
      modal.showContent("test", true);
      expect(modal.fixed).toBe(true);
    });
  });

  // ── getContentElement ─────────────────────────────────────
  describe("getContentElement", () => {
    it("returns the d3 selection wrapping .gp-modal-content", () => {
      const el = modal.getContentElement();
      expect(el.node()).toBe(container.querySelector(".gp-modal-content"));
    });
  });
});
