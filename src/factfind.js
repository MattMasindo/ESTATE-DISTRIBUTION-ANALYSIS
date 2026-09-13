// The fact-find sheet's behaviour: repeating rows, the hand-off, and printing.
// The mapping itself lives in intake.js so it can be tested without a DOM.

import { buildIntake, stashIntake } from "./intake.js";

var $ = function(id){ return document.getElementById(id); };

var SEED = { lc:3, ilc:2, lp:2, props:6 };   // enough ruled lines for a printed sheet

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

function add(key){
  var host = $("ff-" + key);
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

function say(msg, bad){
  var el = $("ff-said");
  el.textContent = msg || "";
  el.className = "said" + (bad ? " bad" : "");
}

export function wireFactfind(){
  ["lc","ilc","lp","props"].forEach(function(k){
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

  (function(){
    var d = new Date();
    $("ff-metdate").value = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  })();
}
