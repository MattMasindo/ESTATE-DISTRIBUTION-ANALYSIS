// The fact-find sheet's behaviour: repeating rows, the hand-off, and printing.
// The mapping itself lives in intake.js so it can be tested without a DOM.

import { buildIntake, buildPolicies, buildBeneficiaries, stashIntake, commafyInput,
         caretAfterDigits, resolveInsured, policyDuration, shareNote } from "./intake.js";

var $ = function(id){ return document.getElementById(id); };

var SEED = { lc:3, ilc:2, lp:2, props:6, policies:1 };   // enough ruled lines for a printed sheet

function personRow(key){
  var d = document.createElement("div");
  d.className = "row person";
  d.innerHTML =
    '<input type="text" data-f="name" aria-label="Name">' +
    '<input type="date" data-f="dob" aria-label="Date of birth">' +
    '<button class="kill no-print" type="button" title="Remove">&times;</button>';
  return d;
}

function assetRow(){
  var d = document.createElement("div");
  d.className = "row asset";
  d.innerHTML =
    '<input type="text" data-f="name" aria-label="Description" placeholder="Quezon City">' +
    '<input type="text" data-f="note" aria-label="Detail" placeholder="House and lot">' +
    '<input type="text" data-f="value" class="num" aria-label="Value" placeholder="0">' +
    '<select data-f="owner" aria-label="Held by">' +
      '<option value="client">Client</option><option value="spouse">Spouse</option><option value="both">Both</option>' +
    '</select>' +
    '<select data-f="acq" aria-label="Acquired">' +
      '<option value="onerous">During &mdash; bought</option>' +
      '<option value="before">Before the marriage</option>' +
      '<option value="gratuitous">Inherited or gifted</option>' +
      '<option value="fruits">Fruits of exclusive property</option>' +
    '</select>' +
    '<select data-f="liq" aria-label="Type">' +
      '<option value="realty">Property</option><option value="liquid">Cash or fund</option>' +
    '</select>' +
    '<button class="kill no-print" type="button" title="Remove">&times;</button>';
  return d;
}

function policyCard(){
  var d = document.createElement("div");
  d.className = "policy";
  d.innerHTML =
    '<div class="policy-head"><span class="eyebrow policy-n"></span>' +
      '<button class="kill no-print" type="button" title="Remove this policy">&times;</button></div>' +
    '<div class="grid g2">' +
      '<div class="f"><label>Insurance company</label><input type="text" data-f="insurer" placeholder="Sun Life of Canada"></div>' +
      '<div class="f"><label>Product name</label><input type="text" data-f="product" placeholder="Sun Maxilink Prime"></div>' +
      '<div class="f"><label>Owner</label><input type="text" data-f="owner" placeholder="Who pays and controls it"></div>' +
      '<div class="f"><label>Insured</label><input type="text" data-f="insured" placeholder="Type same if it is the owner">' +
        '<span class="hint">Type <strong>same</strong> and the owner\'s name fills in.</span></div>' +
    '</div>' +
    '<div class="grid g3" style="margin-top:13px">' +
      '<div class="f"><label>Date of inception</label><input type="date" data-f="inception"></div>' +
      '<div class="f"><label>Policy duration</label><input type="text" data-f="duration" readonly tabindex="-1" placeholder="&mdash;"><span class="hint">Counted to today.</span></div>' +
      '<div class="f"><label>Policy in force</label>' +
        '<select data-f="status">' +
          '<option value="verify">To be verified</option>' +
          '<option value="inforce">Yes &mdash; in force</option>' +
          '<option value="lapsed">Lapsed</option>' +
        '</select></div>' +
    '</div>' +
    '<div class="grid g3" style="margin-top:13px">' +
      '<div class="f"><label>Insurance coverage &#8369;</label><input type="text" data-f="coverage" class="num" placeholder="0"></div>' +
      '<div class="f"><label>Type</label>' +
        '<select data-f="plan"><option value="traditional">Traditional</option><option value="vul">VUL</option></select></div>' +
      '<div class="f"><label>Policy number</label><input type="text" data-f="policyno" placeholder="If known"></div>' +
    '</div>' +
    '<div class="bens">' +
      '<span class="lbl">Beneficiaries</span>' +
      '<span class="hint">Each designation stands on its own &mdash; one share can be irrevocable while another is not.</span>' +
      '<div class="rowhead ben"><span>Name</span><span>Relationship</span><span>Share %</span><span>Primary or contingent</span><span>Designation</span><span></span></div>' +
      '<div class="benrows"></div>' +
      '<button class="add no-print" type="button" data-addben>+ Add beneficiary</button>' +
      '<span class="said benshare"></span>' +
    '</div>';
  return d;
}

function benRow(){
  var d = document.createElement("div");
  d.className = "row ben";
  d.innerHTML =
    '<input type="text" data-b="name" aria-label="Beneficiary name" placeholder="Beneficiary name">' +
    '<input type="text" data-b="relationship" aria-label="Relationship" placeholder="Spouse, child">' +
    '<input type="text" data-b="share" class="num" aria-label="Share" placeholder="Share %">' +
    '<select data-b="role"><option value="primary">Primary</option><option value="contingent">Contingent</option></select>' +
    '<select data-b="revocability">' +
      '<option value="unknown">Not confirmed</option>' +
      '<option value="revocable">Revocable</option>' +
      '<option value="irrevocable">Irrevocable</option>' +
    '</select>' +
    '<button class="kill no-print" type="button" title="Remove">&times;</button>';
  return d;
}

function readBens(card){
  return Array.prototype.map.call(card.querySelectorAll(".benrows .row"), function(row){
    var o = {};
    row.querySelectorAll("[data-b]").forEach(function(el){ o[el.dataset.b] = el.value; });
    return o;
  });
}

function refreshShare(card){
  card.querySelector(".benshare").textContent = shareNote(buildBeneficiaries(readBens(card)));
}

function numberPolicies(){
  var cards = $("ff-policies").querySelectorAll(".policy");
  Array.prototype.forEach.call(cards, function(c, i){
    c.querySelector(".policy-n").textContent = "Policy " + (i + 1);
  });
}

function add(key){
  var host = $("ff-" + key);
  if (key === "policies"){
    var card = policyCard();
    host.appendChild(card);
    card.querySelector(".benrows").appendChild(benRow());
    numberPolicies();
    return;
  }
  host.appendChild(key === "props" ? assetRow() : personRow(key));
}

function readRows(key){
  return Array.prototype.map.call($("ff-" + key).querySelectorAll(".row"), function(row){
    var o = {};
    row.querySelectorAll("[data-f]").forEach(function(el){ o[el.dataset.f] = el.value; });
    return o;
  });
}

function gather(){
  return {
    client:       $("ff-client").value,
    clientDob:    $("ff-clientdob").value,
    married:      $("ff-married").checked,
    spouseName:   $("ff-spousename").value,
    spouseDob:    $("ff-spousedob").value,
    marriageDate: $("ff-marriagedate").value,
    prenup:       $("ff-prenup").value,
    lc:  readRows("lc"),
    ilc: readRows("ilc"),
    lp:  readRows("lp"),
    props: readRows("props"),
    debts:  $("ff-debts").value,
    debtOn: $("ff-debton").value
  };
}

function readPolicies(){
  return Array.prototype.map.call($("ff-policies").querySelectorAll(".policy"), function(card){
    var o = {};
    card.querySelectorAll("[data-f]").forEach(function(el){ o[el.dataset.f] = el.value; });
    o.beneficiaries = readBens(card);
    return o;
  });
}

// Group the thousands while the advisor types. Values on this sheet run to eight
// figures and are often read back to the client out loud; an ungrouped
// 12500000 is the one number nobody can check at a glance.
function groupAmount(el){
  var caret = el.selectionStart;
  var digitsBefore = el.value.slice(0, caret).replace(/[^0-9]/g, "").length;
  var next = commafyInput(el.value);
  if (next === el.value) return;
  el.value = next;
  var at = caretAfterDigits(next, digitsBefore);
  try { el.setSelectionRange(at, at); } catch (e) {}   // a detached field cannot take a caret
}

function watchAmounts(){
  ["ff-debts", "ff-liquid"].forEach(function(id){
    $(id).addEventListener("input", function(e){ groupAmount(e.target); });
  });
  // Asset rows come and go, so listen on the container rather than the fields.
  $("ff-props").addEventListener("input", function(e){
    var el = e.target;
    if (el.dataset && el.dataset.f === "value") groupAmount(el);
  });
}

function say(msg, bad){
  var el = $("ff-said");
  el.textContent = msg || "";
  el.className = "said" + (bad ? " bad" : "");
}

export function wireFactfind(){
  ["lc","ilc","lp","props","policies"].forEach(function(k){
    for (var i = 0; i < SEED[k]; i++) add(k);
  });

  document.querySelectorAll("[data-add]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var k = btn.dataset.add;
      if (k === "lp" && $("ff-lp").querySelectorAll(".row").length >= 2) return;  // two parents, no more
      add(k);
      var rows = $("ff-" + k).querySelectorAll('.row input[data-f="name"]');
      if (rows.length) rows[rows.length - 1].focus();
    });
  });

  $("ff-policies").addEventListener("click", function(e){
    var addBen = e.target.closest("[data-addben]");
    if (addBen){
      var host = addBen.closest(".policy").querySelector(".benrows");
      host.appendChild(benRow());
      host.querySelectorAll('.row [data-b="name"]')[host.querySelectorAll(".row").length - 1].focus();
      refreshShare(addBen.closest(".policy"));
      return;
    }

    var benKill = e.target.closest(".benrows .kill");
    if (benKill){
      var pcard = benKill.closest(".policy"), rows = pcard.querySelectorAll(".benrows .row");
      if (rows.length > 1) benKill.closest(".row").remove();
      else benKill.closest(".row").querySelectorAll("input,select").forEach(function(el){
        if (el.tagName === "SELECT") el.selectedIndex = 0; else el.value = "";
      });
      refreshShare(pcard);
      return;
    }

    var b = e.target.closest(".kill"); if (!b) return;
    var card = b.closest(".policy");
    if ($("ff-policies").querySelectorAll(".policy").length > 1) card.remove();
    else card.querySelectorAll("input,select").forEach(function(el){
      if (el.tagName === "SELECT") el.selectedIndex = 0; else el.value = "";
    });
    numberPolicies(); say("");
  });

  // "Same" resolves to the owner, in either order — the advisor may type the
  // shorthand before the name it stands for.
  $("ff-policies").addEventListener("input", function(e){
    var el = e.target;
    if (el.dataset && el.dataset.b){ refreshShare(el.closest(".policy")); return; }
    if (!el.dataset || !el.dataset.f) return;
    var card = el.closest(".policy");
    var ownerEl   = card.querySelector('[data-f="owner"]');
    var insuredEl = card.querySelector('[data-f="insured"]');

    if (el.dataset.f === "coverage") groupAmount(el);

    if (el.dataset.f === "insured" && /^same$/i.test(el.value.trim()) && ownerEl.value.trim()){
      insuredEl.value = ownerEl.value.trim();
    }
    if (el.dataset.f === "owner"){
      var cur = insuredEl.value.trim();
      if (cur === "" || /^same$/i.test(cur) || cur === insuredEl.dataset.mirrored){
        insuredEl.value = ownerEl.value.trim();
        insuredEl.dataset.mirrored = insuredEl.value;   // keep mirroring until edited by hand
      }
    }
    if (el.dataset.f === "insured") delete insuredEl.dataset.mirrored;
  });

  $("ff-policies").addEventListener("change", function(e){
    if (e.target.dataset && e.target.dataset.b){ refreshShare(e.target.closest(".policy")); return; }
    if (!e.target.dataset || e.target.dataset.f !== "inception") return;
    var card = e.target.closest(".policy");
    card.querySelector('[data-f="duration"]').value = policyDuration(e.target.value);
  });

  ["lc","ilc","lp","props"].forEach(function(k){
    $("ff-" + k).addEventListener("click", function(e){
      var b = e.target.closest(".kill"); if (!b) return;
      var row = b.closest(".row");
      if ($("ff-" + k).querySelectorAll(".row").length > 1) row.remove();
      else row.querySelectorAll("input,select").forEach(function(el){
        if (el.tagName === "SELECT") el.selectedIndex = 0; else el.value = "";
      });
      say("");
    });
  });

  $("ff-married").addEventListener("change", function(e){
    $("ff-spousefields").style.display = e.target.checked ? "" : "none";
  });

  $("ff-go").addEventListener("click", function(){
    var raw = gather();
    var payload = buildIntake(raw);
    // Recorded, not computed: the analysis sizes the cover a plan needs, and
    // what the client already holds is a separate fact about the estate.
    payload.policies = buildPolicies(readPolicies());

    if (!payload.client){ say("Name the client first.", true); $("ff-client").focus(); return; }
    if (payload.spouse && !payload.date){
      say("The date of marriage decides the property regime — it cannot be left blank.", true);
      $("ff-marriagedate").focus(); return;
    }
    if (!payload.props.length){ say("Add at least one asset.", true); return; }
    if (!payload.lc.length && !payload.ilc.length && !payload.lp.length && !payload.spouse){
      say("No heirs recorded — add a child, a parent, or a surviving spouse.", true); return;
    }

    if (!stashIntake(payload)){ say("This browser is blocking session storage, so the hand-off cannot run.", true); return; }
    window.location.href = "index.html";
  });

  $("ff-print").addEventListener("click", function(){ window.print(); });

  $("ff-clear").addEventListener("click", function(){
    document.querySelectorAll(".wrap input, .wrap textarea").forEach(function(el){
      if (el.type === "checkbox") el.checked = false; else el.value = "";
    });
    document.querySelectorAll(".wrap select").forEach(function(el){ el.selectedIndex = 0; });
    $("ff-married").checked = true;
    $("ff-spousefields").style.display = "";
    say("Cleared.");
  });

  watchAmounts();

  (function(){
    var d = new Date();
    $("ff-metdate").value = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  })();
}
