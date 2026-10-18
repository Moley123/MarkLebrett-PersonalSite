/**
 * Test-only stand-in for maplibre-gl.
 *
 * Two reasons it exists. MapLibre 6 is ESM-only — no `main`, no `require`
 * condition — so CRA 5's Jest resolver cannot load it at all; and it needs
 * WebGL, which jsdom does not have. craco.config.js points Jest's
 * `moduleNameMapper` at this file, so nothing in the app has to know.
 *
 * `Marker` is the only part with behaviour, because it is the only part the
 * drag interaction leans on. It records every instance and puts its element in
 * the document, so a test can find a handle, fire a drag on it and inspect the
 * classes the hook put there.
 *
 * Not bundled: webpack never sees this file, only Jest does.
 */

export class Marker {
  constructor(options = {}) {
    this.options = options;
    this.element = options.element || document.createElement('div');
    this.lngLat = null;
    this.handlers = {};
    this.added = false;
    Marker.instances.push(this);
  }

  setLngLat(value) {
    this.lngLat = Array.isArray(value) ? { lng: value[0], lat: value[1] } : value;
    return this;
  }

  getLngLat() { return this.lngLat; }

  getElement() { return this.element; }

  addTo() {
    this.added = true;
    document.body.appendChild(this.element);
    return this;
  }

  remove() {
    this.added = false;
    this.element.remove();
    return this;
  }

  on(type, fn) {
    (this.handlers[type] = this.handlers[type] || []).push(fn);
    return this;
  }

  /** Fire one of the drag events MapLibre would fire. */
  fire(type) {
    (this.handlers[type] || []).forEach((fn) => fn({ type, target: this }));
  }
}
Marker.instances = [];

/** Forget every marker made so far. Call between tests. */
Marker.reset = () => { Marker.instances = []; };

export class Map {
  constructor(options = {}) { this.options = options; }
}

export class NavigationControl {}
export class FullscreenControl {}
export class AttributionControl {}

export class LngLatBounds {
  extend() { return this; }
}

export const setWorkerUrl = () => {};
