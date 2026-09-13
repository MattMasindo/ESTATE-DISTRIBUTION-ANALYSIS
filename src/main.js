// Boot. The calculator runs entirely in the browser — no network, no account,
// nothing leaves the page. cloud.js only wakes up if config.js is filled in.
import { wire } from "./ui/wire.js";
import { initCloud } from "./cloud.js";

wire();
initCloud();
