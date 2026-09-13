// Boot. The calculator runs entirely in the browser — no network, no account,
// nothing leaves the page. cloud.js only wakes up if config.js is filled in.
import { S } from "./state.js";
import { applyIntake, takeIntake } from "./intake.js";
import { wire } from "./ui/wire.js";
import { initCloud } from "./cloud.js";

applyIntake(S, takeIntake());   // a fact-find sheet handed across, if there is one
wire();
initCloud();
