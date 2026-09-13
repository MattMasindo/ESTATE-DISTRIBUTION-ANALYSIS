// Saved client cases, backed by Supabase. Entirely optional: with config.js
// unset this module adds nothing to the page and the calculator behaves exactly
// as the offline version does.
import { S } from "./state.js";
import { render, renderPropRows, renderHeirList } from "./ui/render.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
let sb = null;

const el = (tag, cls, text) => {
const n = document.createElement(tag);
if (cls) n.className = cls;
if (text != null) n.textContent = text;
return n;
};

export async function initCloud() {
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return; // local-only: nothing to do
try {
  const { createClient } = await import(CDN);
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.warn("Cloud storage unavailable, continuing offline.", e);
  return;
}
mountBar();
sb.auth.onAuthStateChange(() => refresh());
refresh();
}

function mountBar() {
const bar = el("div", "cloudbar no-print");
bar.id = "cloudbar";
document.querySelector(".appbar .masthead").appendChild(bar);
}

async function refresh() {
const bar = document.getElementById("cloudbar");
if (!bar) return;
const { data: { session } } = await sb.auth.getSession();
bar.innerHTML = "";

if (!session) {
  const email = el("input");
  email.type = "email";
  email.placeholder = "you@example.com";
  email.setAttribute("aria-label", "Email for a sign-in link");
  const go = el("button", "ghost", "Email me a sign-in link");
  go.type = "button";
  go.onclick = async () => {
    if (!email.value.trim()) return;
    go.disabled = true;
    go.textContent = "Sending…";
    const { error } = await sb.auth.signInWithOtp({
      email: email.value.trim(),
      options: { emailRedirectTo: window.location.href }
    });
    go.textContent = error ? "Couldn't send — check the address" : "Check your inbox";
    if (error) { go.disabled = false; console.warn(error); }
  };
  bar.append(email, go);
  return;
}

const sel = el("select");
sel.setAttribute("aria-label", "Saved cases");
sel.append(new Option("Saved cases…", ""));
const { data: rows, error } = await sb
  .from("cases").select("id,title,updated_at").order("updated_at", { ascending: false });
if (error) console.warn(error);
(rows || []).forEach(r => sel.append(new Option(r.title, r.id)));
sel.onchange = () => sel.value && openCase(sel.value);

const save = el("button", "ghost", "Save case");
save.type = "button";
save.onclick = () => saveCase(sel);

const out = el("button", "ghost", "Sign out");
out.type = "button";
out.onclick = () => sb.auth.signOut();

bar.append(sel, save, out);
}

async function openCase(id) {
const { data, error } = await sb.from("cases").select("state").eq("id", id).single();
if (error) return console.warn(error);
Object.assign(S, data.state);
syncInputs();
}

async function saveCase(sel) {
const title = prompt("Name this case", (S.client || "Untitled").trim());
if (!title) return;
const { data: { user } } = await sb.auth.getUser();
const { error } = await sb.from("cases").insert({
  owner: user.id, title, client_name: S.client, state: S
});
if (error) return console.warn(error);
refresh();
}

// Push loaded state back into the form controls, then redraw.
function syncInputs() {
const set = (id, v) => { const n = document.getElementById(id); if (n) n.value = v; };
set("in-client", S.client);
set("in-spousename", S.spouseName);
set("in-date", S.date);
set("in-prenup", S.prenup);
set("in-death", S.deathDate);
set("in-route", S.route);
set("in-debton", S.debtOn);
set("in-freeto", S.freeTo);
const sp = document.getElementById("in-spouse");
if (sp) sp.checked = !!S.spouse;
renderPropRows();
["lc", "ilc", "lp"].forEach(renderHeirList);
render();
}
