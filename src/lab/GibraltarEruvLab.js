/**
 * Gibraltar Eruv — LAB. Sandbox copy of /gibraltareruv on the lab engine; see
 * ./EruvLab.js for what that means and ./labs.js for this page's settings.
 *
 * Differences from the live page, beyond the lab engine itself:
 *   - Route search uses the same detour search as Zurich (interior waypoints
 *     near where a direct route strays) rather than picking among Google's
 *     route alternatives, so it can find in-eruv detours Google never offers.
 *   - The "Layer Toggles" panel is gone. With a single eruv it had one
 *     checkbox that was fixed on and did nothing.
 */
import React from 'react';
import EruvLab from './EruvLab';
import { GIBRALTAR_LAB } from './labs';

const GibraltarEruvLab = () => <EruvLab config={GIBRALTAR_LAB} />;

export default GibraltarEruvLab;
