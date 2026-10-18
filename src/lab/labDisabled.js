/**
 * Stub that stands in for the /lab/ pages in public production builds.
 *
 * craco.config.js rewrites every import of `./lab/<Page>` to this file unless
 * REACT_APP_LAB=1, so the real sandbox source never enters the webpack module
 * graph. Without that rewrite webpack still emits a chunk for the dynamic
 * import even when the branch guarding it is dead — which would ship the lab
 * code, and its URL token, to the public bundle.
 */

const LabDisabled = () => null;

export default LabDisabled;
