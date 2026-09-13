// Generated from the single-file prototype. Behaviour is identical; see test/engine.test.mjs.

import { S, $, ACQ } from "../state.js";
import { peso, pct, frac, commafy, esc, client, spouseWho, firstName, heirName, ROLE,
         nameOf, dobOf, ageAt } from "../format.js";
import { regime, REGIME_NAME, bucket, totals, liquidate } from "../engine/regime.js";
import { testate, intestate } from "../engine/succession.js";
import { plan } from "../engine/plan.js";
import { FH_CAP, OLD_FH_CAP } from "../engine/tax.js";
import { COLOR, HATCH, drawPie, slicesOf } from "./charts.js";

function renderLegend(el, res, E){
  var rows = slicesOf(res).map(function(s){
    var f = E>0 ? frac(s.total/E) : null, names = "";
    if (s.key === "lc" || s.key === "ilc" || s.key === "lp"){
      names = S[s.key].map(function(_,i){ return heirName(s.key,i); }).join(", ")
        + (s.count>1 ? " · " + peso(s.total/s.count) + " each" : "");
    }
    return '<div class="lrow'+(s.key==="free"?" free":"")+'">'
      + '<span class="sw" style="background:'+(s.key==="free"?HATCH:COLOR[s.key])+'"></span>'
      + '<span class="lname">'+esc(s.label)+(names?'<span class="per">'+esc(names)+'</span>':'')+'</span>'
      + '<span class="lval">'+peso(s.total)+'<span class="frac">'+(E>0?pct(s.total/E*100):"—")+(f?' · '+f:'')+'</span></span>'
      + '</div>';
  }).join("");
  el.innerHTML = rows || '<div class="lrow"><span></span><span class="lname">Nothing to distribute</span><span></span></div>';
}

function renderNotes(el, res){
  el.innerHTML = res.notes.map(function(n){ return '<p><span class="art">'+n[0]+'</span> — '+esc(n[1])+'</p>'; }).join("");
}

function renderTable(t, i, E){
  var find = function(res,k){ for (var j=0;j<res.groups.length;j++) if (res.groups[j].key===k) return res.groups[j]; return null; };
  var rows = [];
  ["lc","lp","ss","ilc"].forEach(function(k){
    var a = find(t,k), b = find(i,k), g = a || b;
    if (!g) return;
    for (var x = 0; x < g.count; x++)
      rows.push({key:k, name:heirName(k,x), role:ROLE[k], av:a?a.each:0, bv:b?b.each:0});
  });

  var body = rows.map(function(r){
    var d = r.bv - r.av;
    return '<tr><td><span class="heir"><span class="sw" style="background:'+COLOR[r.key]+'"></span>'
      + '<span class="who">'+esc(r.name)+'<span class="role">'+r.role+'</span></span></span></td>'
      + '<td>'+peso(r.av)+'</td><td>'+(E>0?pct(r.av/E*100):'—')+'</td>'
      + '<td>'+peso(r.bv)+'</td><td>'+(E>0?pct(r.bv/E*100):'—')+'</td>'
      + '<td class="delta '+(d>0.5?'up':(d<-0.5?'down':''))+'">'+(Math.abs(d)<0.5?'—':(d>0?'+':'−')+peso(Math.abs(d)))+'</td></tr>';
  }).join("");

  if (t.free > 0.005){
    body += '<tr class="freerow"><td><span class="heir"><span class="sw" style="background:'+HATCH+'"></span>'
      + '<span class="who">Free portion<span class="role">Assigned by the will</span></span></span></td>'
      + '<td>'+peso(t.free)+'</td><td>'+pct(t.free/E*100)+'</td><td>₱0</td><td>0%</td>'
      + '<td class="delta down">−'+peso(t.free)+'</td></tr>';
  }
  if (!body) body = '<tr><td colspan="6" style="text-align:center;color:var(--ink-3);font-style:italic">No heirs listed yet</td></tr>';

  $("cmp-body").innerHTML = body;
  $("cmp-foot").innerHTML = '<tr><td>Net distributable estate</td><td>'+peso(E)+'</td><td>100%</td><td>'+peso(E)+'</td><td>100%</td><td>—</td></tr>';
}

function renderDerive(L, reg){
  var cells;
  if (S.spouse){
    var shareWord = reg === "cpg" ? "Conjugal" : reg === "sep" ? "Shared" : "Community";
    cells = [
      [shareWord + " property", peso(L.netConj), reg === "sep" ? "Nothing is shared under this settlement" : "Split down the middle"],
      ["Exclusive to " + firstName(client()), peso(L.netExd), "Enters the estate in full"],
      ["Exclusive to " + firstName(spouseWho()), peso(L.exs), "Never part of the estate"],
      ["Debts", (L.debtPaid>0?"−":"") + peso(L.debtPaid),
       L.debtPaid > 0 ? (L.dConj > 0.5 ? peso(L.dConj) + " from the shared pot" + (L.dExd > 0.5 ? ", " + peso(L.dExd) + " from " + firstName(client()) + "'s own" : "")
                                       : "All from " + firstName(client()) + "'s own property")
                      : "None entered"],
      [firstName(spouseWho()) + " retains", peso(L.spouseOwn),
       peso(L.netConj/2) + " conjugal half + " + peso(L.exs) + " her own — none of it inheritance"]
    ];
  } else {
    cells = [
      ["Property of " + firstName(client()), peso(L.exd + L.debtPaid), "No spouse — nothing to split"],
      ["Debts", (L.debtPaid>0?"−":"") + peso(L.debtPaid), L.debtPaid>0 ? "Settled before any share" : "None entered"]
    ];
  }
  $("derive").innerHTML = cells.map(function(c){
    return '<div class="cell2"><span class="k">'+esc(c[0])+'</span><span class="v">'+c[1]+'</span><span class="n">'+esc(c[2])+'</span></div>';
  }).join("")
  + '<div class="cell2 net"><span class="k">Net distributable estate</span><span class="v">'+peso(L.estate)+'</span><span class="n">This is what gets distributed</span></div>';
}

/* ---------- schedule rows (rebuilt only on add / remove) ---------- */
function renderPropRows(){
  $("prop-rows").innerHTML = S.props.map(function(p,i){
    var opts = Object.keys(ACQ).map(function(k){
      return '<option value="'+k+'"'+(p.acq===k?" selected":"")+'>'+ACQ[k]+'</option>';
    }).join("");
    return '<div class="prow" data-i="'+i+'">'
      + '<div class="cell">'
        + '<input type="text" data-f="name" value="'+esc(p.name)+'" placeholder="Property" aria-label="Property name">'
        + '<input type="text" data-f="note" value="'+esc(p.note)+'" placeholder="Description" aria-label="Description" style="font-size:12px;padding:5px 9px;color:var(--ink-2)">'
      + '</div>'
      + '<div class="cell"><span class="mini">Value</span><input type="text" class="num" data-f="value" inputmode="numeric" value="'+commafy(p.value)+'" placeholder="0" aria-label="Value"></div>'
      + '<div class="cell sp-col"><span class="mini">Owned by</span><select data-f="owner" aria-label="Owned by">'
        + '<option value="client"'+(p.owner==="client"?" selected":"")+'>Client</option>'
        + '<option value="spouse"'+(p.owner==="spouse"?" selected":"")+'>Spouse</option>'
        + '<option value="both"'+(p.owner==="both"?" selected":"")+'>Both</option></select></div>'
      + '<div class="cell sp-col"><span class="mini">How acquired</span><select data-f="acq" aria-label="How acquired">'+opts+'</select></div>'
      + '<div class="cell sp-col"><span class="mini">Classification</span><span class="chip" data-chip="'+i+'"></span></div>'
      + '<button class="kill no-print" type="button" data-kill="'+i+'" aria-label="Remove this property">×</button>'
      + '</div>';
  }).join("") || '<p class="empty" style="padding:10px 0">No properties listed. Add one to begin.</p>';
}

function renderChips(){
  var reg = regime();
  S.props.forEach(function(p,i){
    var el = document.querySelector('[data-chip="'+i+'"]'); if (!el) return;
    if (!S.spouse){ el.className = "chip cli"; el.textContent = "Estate"; return; }
    var b = bucket(p, reg);
    if (b.cls === "shared"){
      el.className = "chip shared";
      el.textContent = reg === "cpg" ? "Conjugal" : "Community";
    } else if (p.owner === "client"){
      el.className = "chip cli"; el.textContent = "Exclusive — " + firstName(client());
    } else if (p.owner === "spouse"){
      el.className = "chip sp"; el.textContent = "Exclusive — " + firstName(spouseWho());
    } else {
      el.className = "chip split"; el.textContent = "Exclusive — split 50/50";
    }
  });
}

function renderHeirList(key){
  var list = S[key];
  $("list-"+key).innerHTML = list.length
    ? list.map(function(e,i){
        return '<div class="person">'
          + '<div class="namerow"><span class="ord">'+(i+1)+'</span>'
            + '<input type="text" data-hkey="'+key+'" data-hi="'+i+'" value="'+esc(nameOf(e))+'" placeholder="Name" aria-label="Name">'
            + '<button class="kill no-print" type="button" data-hkill="'+key+'" data-hi="'+i+'" aria-label="Remove">×</button></div>'
          + '<div class="dobline">'
            + '<input type="date" data-hdob="'+key+'" data-hi="'+i+'" value="'+esc(dobOf(e))+'" aria-label="Date of birth">'
            + '<span class="age" data-age="'+key+':'+i+'"></span></div>'
          + '</div>';
      }).join("")
    : '<p class="empty">None surviving</p>';
}

function renderTotals(reg){
  var t = totals();
  var shareWord = reg === "cpg" ? "Conjugal" : reg === "sep" ? "Shared" : "Community";
  $("prop-totals").innerHTML = '<b>Total</b>'
    + (S.spouse ? '<div class="tcell sp-col"><span>'+shareWord+'</span><span class="tv">'+peso(t.conj)+'</span></div>' : '')
    + '<div class="tcell"><span>'+(S.spouse ? "Exclusive — " + esc(firstName(client())) : "Estate value")+'</span><span class="tv">'+peso(S.spouse ? t.exd : t.conj+t.exd+t.exs)+'</span></div>'
    + (S.spouse ? '<div class="tcell sp-col"><span>Exclusive — '+esc(firstName(spouseWho()))+'</span><span class="tv">'+peso(t.exs)+'</span></div>' : '')
    + '<span></span>';
}

/* ---------- liquidity / bequest / receipt rendering ---------- */
function renderLiquidity(P, E){
  var pctOf = function(v){ return P.T > 0 ? (v/P.T*100) : 0; };
  var lp = pctOf(P.liqTotal), ip = 100 - lp;
  var bar = "";
  if (P.T <= 0){
    bar = '<div class="seg ill" style="width:100%;color:var(--ink-3)">Nothing scheduled</div>';
  } else {
    bar = (P.liqTotal > 0 ? '<div class="seg liq" style="width:'+lp.toFixed(2)+'%">'+(lp>=7?pct(lp):"")+'</div>' : '')
        + (P.illiqTotal > 0 ? '<div class="seg ill" style="width:'+ip.toFixed(2)+'%">'+(ip>=7?pct(ip):"")+'</div>' : '');
    if (P.cashNeed > 0 && P.cashNeed < P.T)
      bar += '<div class="need" style="left:'+pctOf(P.cashNeed).toFixed(2)+'%"><i>Cash needed</i></div>';
  }
  $("lbar").innerHTML = bar;
  $("lkey").innerHTML =
      '<span class="k"><i class="sw" style="background:var(--liq)"></i>Liquid — cash, deposits, funds <b>'+peso(P.liqTotal)+'</b></span>'
    + '<span class="k"><i class="sw" style="background:var(--illiq)"></i>Illiquid — property, business <b>'+peso(P.illiqTotal)+'</b></span>'
    + '<span class="k"><i class="sw" style="background:var(--seal);width:2px;height:12px;border-radius:0"></i>Settlement needs <b>'+peso(P.cashNeed)+'</b></span>';
  $("liq-caption").textContent = P.T > 0 ? pct(lp) + " of the estate is cash" : "";

  var say;
  if (P.T <= 0) say = "Schedule some properties above and the liquidity picture appears here.";
  else if (P.liqShort > 0)
    say = "The estate holds <b>" + peso(P.liqTotal) + "</b> in cash against <b>" + peso(P.cashNeed)
        + "</b> of settlement costs — a shortfall of <b>" + peso(P.liqShort) + "</b>. Without outside money the family sells "
        + "property under time pressure, borrows against it, or waits. The pie above divides value; it cannot divide a house.";
  else
    say = "The estate holds <b>" + peso(P.liqTotal) + "</b> in cash. Settlement takes <b>" + peso(P.cashNeed)
        + "</b> of it, leaving <b>" + peso(P.cashLeft) + "</b> against <b>" + peso(P.illiqTotal)
        + "</b> of property. Every share above that cash line is a claim on real property — it has to be sold, mortgaged, or held in co-ownership before anyone is actually paid.";
  if (P.tax.mode === "train" && P.liqTotal > 0.5)
    say += ' <br><br>One early valve: under TRAIN the bank will release the deceased\'s deposits before settlement closes, '
         + 'less a <b>6% final withholding tax</b> — about ' + peso(P.liqTotal * 0.06) + ' on the cash scheduled here.';
  $("liq-say").innerHTML = say;
}

function renderBequests(P){
  if (!P.rows.length){
    $("bq-rows").innerHTML = '<p class="empty" style="padding:12px 0">No property in the estate yet.</p>';
    return;
  }
  var opts = '<option value="residue">Residue — divided by law</option>'
    + P.heirs.map(function(h){ return '<option value="'+h.id+'">'+esc(h.name)+' — '+h.role.toLowerCase()+'</option>'; }).join("");
  $("bq-rows").innerHTML = P.rows.map(function(r){
    var share = r.est < r.whole - 0.5 ? "half interest of " + peso(r.whole) : "whole";
    return '<div class="bqrow" data-i="'+r.i+'">'
      + '<span class="pn">'+esc(r.name || "Unnamed asset")+(r.note?'<small>'+esc(r.note)+'</small>':'')+'</span>'
      + '<span class="ev">'+peso(r.est)+'<small>'+share+'</small></span>'
      + '<select data-b="liq" aria-label="Liquidity">'
        + '<option value="liquid"'+(r.kind==="liquid"?" selected":"")+'>Liquid — cash</option>'
        + '<option value="realty"'+(r.kind==="realty"?" selected":"")+'>Real property</option>'
        + '<option value="other"'+(r.kind==="other"?" selected":"")+'>Other illiquid</option></select>'
      + '<select data-b="to" aria-label="Given to">'+opts.replace('value="'+r.to+'"','value="'+r.to+'" selected')+'</select>'
      + '</div>';
  }).join("");
}

function renderFreePortion(P, E){
  var opts = '<option value="prorata"'+(P.freeTo==="prorata"?" selected":"")+'>Nobody in particular — split by the legitimes</option>'
    + P.heirs.map(function(h){ return '<option value="'+h.id+'"'+(P.freeTo===h.id?" selected":"")+'>'+esc(h.name)+' — on top of their legitime</option>'; }).join("")
    + '<option value="outside"'+(P.freeTo==="outside"?" selected":"")+'>Someone outside the family</option>';
  if ($("in-freeto").innerHTML !== opts) $("in-freeto").innerHTML = opts;

  var floor = P.floorTotal, free = Math.max(E - floor, 0), pool = P.freePool, say;
  var lead = "The legitimes take <b>" + peso(floor) + "</b> and cannot be touched. The remaining <b>"
           + peso(free) + "</b> is the only part " + esc(client()) + " actually controls. ";

  if (E <= 0 || !P.heirs.length){
    say = "Add heirs and properties above and the free portion appears here.";
  } else if (free <= 0.005){
    say = "There is no free portion in this estate — the compulsory legitimes absorb all of " + peso(E)
        + ", so there is nothing for a will to direct.";
  } else if (pool <= 0.005){
    // the specific gifts above have already eaten it
    say = lead + "The specific gifts above have already used it up"
        + (P.impaired > 0.5
            ? " and gone <b>" + peso(P.impaired) + "</b> past it, into legitimes the law protects — which is what the alarm below is reporting. "
              + "Cut the gifts back by that much and the free portion becomes directable again."
            : " exactly, so there is nothing left to direct.");
  } else {
    var named = P.heirs.filter(function(h){ return h.id === P.freeTo; })[0];
    if (pool < free - 0.005)
      lead = "The legitimes take <b>" + peso(floor) + "</b> and cannot be touched. Of the <b>" + peso(free)
           + "</b> free portion, the specific gifts above have used " + peso(free - pool) + ", leaving <b>"
           + peso(pool) + "</b> still to direct. ";
    if (P.freeTo === "outside")
      say = lead + "Directed outside the family, it leaves the heirs entirely — they keep their legitimes and nothing more.";
    else if (named)
      say = lead + "All of it goes to <b>" + esc(named.name) + "</b>, who therefore receives <b>" + peso(named.receives)
          + "</b> — a " + peso(named.legitime) + " legitime plus " + peso(named.fromFree) + " of free portion. "
          + "That is the ceiling: no will can take it higher, because everything above it is somebody else's protected floor.";
    else
      say = lead + "No will directs it, so it follows the legitimes in proportion.";
  }
  $("free-say").innerHTML = say;
}

function renderReceipts(P, E){
  $("rec-caption").textContent = P.anyGift
    ? "After the specific gifts in the will" : "No specific gifts — everyone takes their fair share";

  var outsideRow = P.freeOutside > 0.005
    ? '<tr class="freerow"><td><span class="heir"><span class="sw" style="background:'+HATCH+'"></span>'
      + '<span class="who">Outside the family<span class="role">Free portion, directed by the will</span></span></span></td>'
      + '<td>₱0</td><td>'+peso(P.freeOutside)+'</td><td>—</td>'
      + '<td class="delta down">−'+peso(P.freeOutside)+'</td><td>—</td></tr>'
    : "";
  $("rec-body").innerHTML = P.heirs.length ? P.heirs.map(function(h){
    var d = h.gap, bad = h.shortLegitime > 0.5;
    return '<tr'+(bad?' style="background:var(--seal-soft)"':'')+'>'
      + '<td><span class="heir"><span class="sw" style="background:'+COLOR[h.key]+'"></span>'
        + '<span class="who">'+esc(h.name)+'<span class="role">'+h.role+(h.gifts.length?' &middot; '+esc(h.gifts.join(", ")):'')+'</span></span></span></td>'
      + '<td>'+peso(h.base)+'</td>'
      + '<td>'+peso(h.receives)+'</td>'
      + '<td>'+peso(h.cash)+'</td>'
      + '<td class="delta '+(d>0.5?'up':(d<-0.5?'down':''))+'">'+(Math.abs(d)<0.5?'—':(d>0?'+':'−')+peso(Math.abs(d)))+'</td>'
      + '<td>'+(h.shortBase>0.5?peso(h.shortBase):'—')+'</td></tr>';
  }).join("") + outsideRow : '<tr><td colspan="6" style="text-align:center;color:var(--ink-3);font-style:italic">No heirs listed yet</td></tr>';

  // one scale across every bar
  var max = 0;
  P.heirs.forEach(function(h){ max = Math.max(max, h.receives + h.shortBase, h.base); });
  $("hbars").innerHTML = max > 0 ? P.heirs.map(function(h){
    var w = function(v){ return (v/max*100).toFixed(2) + "%"; };
    return '<div class="hbrow">'
      + '<span class="hbname">'+esc(h.name)+'<small>'+h.role+'</small></span>'
      + '<div class="hbar">'
        + (h.cash>0.5?'<div class="seg cash" style="width:'+w(h.cash)+'"></div>':'')
        + (h.property>0.5?'<div class="seg prop" style="width:'+w(h.property)+'"></div>':'')
        + (h.shortBase>0.5?'<div class="seg ins" style="width:'+w(h.shortBase)+'"></div>':'')
        + '<div class="tick" style="left:'+w(h.base)+'"></div>'
      + '</div>'
      + '<span class="hbval">'+peso(h.receives + h.shortBase)+'</span>'
      + '</div>';
  }).join("") : "";

  // the legitime alarm
  var flag = "";
  if (P.over)
    flag = '<div class="flag" style="margin:14px 16px 0"><b>The gifts exceed the estate.</b>&nbsp;The specific gifts add up to more than '
         + peso(E) + ', so there is nothing left to divide. Reduce a gift or revalue the assets.</div>';
  else if (P.impaired > 0.5)
    flag = '<div class="flag" style="margin:14px 16px 0"><b>Legitime impaired.</b>&nbsp;These gifts leave '
         + P.impairedCount + ' heir' + (P.impairedCount>1?'s':'') + ' below the legitime the law reserves — '
         + peso(P.impaired) + ' short in total. Under Arts. 906–907 the excessive gift is reducible on demand, so the will can be '
         + 'cut down in court unless the shortfall is funded from outside the estate.</div>';
  $("rec-flag").innerHTML = flag;

  renderInsurance(P);
}

function renderInsurance(P){
  var recommended = P.coverage, zero = $("cov-zero"), panel = $("insure");

  if (recommended <= 0.5){
    panel.classList.add("hidden"); zero.classList.remove("hidden");
    zero.innerHTML = '<b>No equalizer needed as things stand.</b> Every heir reaches their fair share out of the estate itself, '
      + 'and the liquid assets cover the settlement. Assign a property to one heir above, direct the free portion, or switch to '
      + 'probate, and the coverage this plan would need appears here.';
    return;
  }
  panel.classList.remove("hidden"); zero.classList.add("hidden");

  var custom = S.coverMode === "custom";
  var cover = custom ? S.coverAmount : recommended;
  var el = $("in-cover");
  if (document.activeElement !== el) el.value = commafy(Math.round(cover)) || "0";

  // every beneficiary keeps their proportion of the need, whatever the policy size
  var needs = P.heirs.filter(function(h){ return h.shortBase > 0.5; })
    .map(function(h){ return { label:h.name, role:h.role, need:h.shortBase }; });
  if (P.liqShort > 0.5)
    needs.push({ label:"The estate", role:"Settlement costs it cannot cover", need:P.liqShort });

  var lines = needs.map(function(n){
    var share = n.need/recommended, amt = cover * share;
    return '<li><span>'+esc(n.label)+'</span><span class="n">'+peso(amt)
      + '<span class="pc">'+pct(share*100)+'</span></span></li>';
  }).join("");

  $("cov-lines").innerHTML = lines
    + '<li class="tot"><span>Total coverage</span><span class="n">'+peso(cover)+'<span class="pc">100%</span></span></li>'
    + (P.impaired > 0.5
        ? '<li style="border-top:1px solid var(--line);color:var(--ink-3);font-size:12px"><span>Legal minimum — restore the impaired legitimes only</span><span class="n">'+peso(P.impaired)+'</span></li>'
        : '');

  var gap = cover - recommended, funded = recommended > 0 ? cover/recommended*100 : 0;
  var status;
  if (!custom || Math.abs(gap) < 0.5)
    status = '<span class="exact">Sized to close the gap exactly.</span>';
  else if (gap < 0)
    status = '<span class="under">' + peso(-gap) + ' short</span> of the ' + peso(recommended)
           + ' this plan needs — <b>' + pct(funded) + '</b> funded.';
  else
    status = '<span class="over">' + peso(gap) + ' more</span> than this plan needs — ' + peso(recommended)
           + ' closes it, the rest is extra legacy.';
  if (custom) status += ' <button type="button" id="cov-reset">Use the recommended ' + peso(recommended) + '</button>';
  $("cov-status").innerHTML = status;

  var m = $("cov-meter");
  m.classList.toggle("full", funded >= 99.5);
  m.querySelector(".fill").style.width = Math.max(0, Math.min(100, funded)).toFixed(1) + "%";

  $("cov-why").innerHTML = 'Proceeds paid to a named beneficiary land outside the estate — cash on death, with no waiting for '
    + 'settlement and nothing to sell. Name the beneficiaries irrevocably and the proceeds stay out of the gross estate for tax as well.'
    + (custom && gap < -0.5 ? ' At this face amount every beneficiary is funded to ' + pct(funded) + ' of their gap, not made whole.' : '');
}

/* ---------- tax / routes / waivers rendering ---------- */
function renderTax(P, reg){
  var X = P.tax, L = [], train = X.mode === "train", cap = train ? FH_CAP : OLD_FH_CAP;
  var row = function(k, v, cls, note){
    return '<div class="lrow2 '+(cls||'')+'"><span>'+k+(note?'<small>'+note+'</small>':'')+'</span><span class="n">'+v+'</span></div>';
  };
  L.push(row("Gross estate", peso(X.gross), "", "Client's exclusive property plus the whole shared pot"));
  if (S.debts > 0) L.push(row("Claims against the estate", peso(X.ordinary), "sub"));
  X.active.extras.forEach(function(e){ if (e[1] > 0.5) L.push(row(e[0], peso(e[1]), "sub", e[2])); });
  L.push(row("Standard deduction", peso(X.std), "sub",
    train ? "Filipino citizen or resident, no receipts needed" : "Pre-TRAIN allowance"));
  L.push(row("Family home", peso(X.fhDeduction), "sub",
    X.fhRow ? esc(X.fhRow.name) + " — the client's interest" + (X.fhInterest > cap ? ", capped at " + peso(cap) : "")
            : "None selected"));
  if (S.spouse) L.push(row("Net conjugal share of " + esc(firstName(spouseWho())), peso(X.spouseShare), "sub",
    "Half the shared pot, which was added whole above: " + peso(X.conj)
    + (X.dConj > 0.5 ? " less " + peso(X.dConj) + " of debts charged to it = " + peso(X.netConj) : "")
    + ", halved. None of " + esc(firstName(client())) + "'s " + peso(X.exd) + " of exclusive property is in this figure, and "
    + esc(firstName(spouseWho())) + "'s own " + peso(X.exs) + " never entered the gross estate above, so there is nothing to deduct for it."));
  L.push(row("Net taxable estate", peso(X.netTaxable), "rule"));
  L.push(row(train ? "Estate tax at 6%" : "Estate tax, graduated 5%–20%", peso(X.tax), "big"));
  if (X.surcharge > 0 || X.interest > 0){
    L.push(row("Surcharge, 25%", peso(X.surcharge), "sub"));
    L.push(row("Interest, 12% per year", peso(X.interest), "sub"));
    L.push(row("Total payable to the BIR", peso(X.taxTotal), "rule"));
  }
  $("ledger").innerHTML = L.join("");
  $("tax-caption").textContent = X.gross > 0 ? pct(X.effective) + " of the gross estate" : "";

  var side = '<div><span class="cap">Estate tax due</span><div class="bignum">'+peso(X.taxTotal)+'</div>'
    + '<p class="note">' + (train ? 'The headline rate is 6%, but deductions bring the effective cost to <b>'+pct(X.effective)+'</b> of the gross estate. '
                                  : 'The graduated table tops out at 20%. The effective cost here is <b>'+pct(X.effective)+'</b> of the gross estate. ')
    + peso(X.active.extraTotal + X.std + X.fhDeduction + X.spouseShare) + ' never reaches the tax base.</p></div>';
  if (S.spouse && X.exs > 0.5)
    side += '<p class="note"><b>Why this differs from the schedule.</b> ' + esc(firstName(spouseWho())) + ' retains '
      + peso(X.spouseKeeps) + ' in total, but only <b>' + peso(X.spouseShare) + '</b> is deducted here. '
      + 'The gross estate above took in the whole shared pot, so her half of it has to come back out. '
      + 'Her ' + peso(X.exs) + ' of exclusive property was never added in the first place, so it is not deducted either. '
      + peso(X.gross) + ' − ' + peso(X.spouseShare) + ' = ' + peso(X.gross - X.spouseShare)
      + ', which is exactly the net distributable estate.</p>';
  if (Math.abs(X.saved) > 0.5)
    side += '<p class="note">' + (train
      ? 'Had this death fallen before 2018, the old graduated table would have charged <b>' + peso(X.preRun.tax)
        + '</b>. <b>TRAIN saves ' + peso(X.saved) + '</b> on this estate.'
      : 'Under the TRAIN rules this same estate would pay <b>' + peso(X.trainRun.tax) + '</b> — '
        + peso(X.saved) + ' less. The date of death is what decides it, and it cannot be chosen.') + '</p>';
  if (S.monthsLate > 0)
    side += '<div class="lateflag"><b>Filed '+S.monthsLate+' month'+(S.monthsLate>1?'s':'')+' late.</b> '
      + 'A 25% surcharge and 12% annual interest add '+peso(X.surcharge + X.interest)
      + ' to the bill, plus a compromise penalty on the BIR schedule. The return is due one year from death.</div>';
  else
    side += '<p class="note">Filed on time. Miss the deadline and the BIR adds a <b>25% surcharge</b>, '
      + '<b>12% annual interest</b> and a compromise penalty — set the months late above to see it.'
      + (train ? ' If the cash is short, TRAIN lets the tax be paid <b>in installments over two years</b>.' : '') + '</p>';
  $("taxside").innerHTML = side;

  var fmt = function(d){ return d ? d.toLocaleDateString("en-PH",{day:"numeric",month:"long",year:"numeric"}) : "—"; };
  $("tax-badge").textContent = train ? "TRAIN Law — RA 10963" : "Pre-TRAIN — old NIRC rules";
  $("tax-why").innerHTML = train
    ? 'Death on or after <b>1 January 2018</b>. Flat 6%, a ₱5,000,000 standard deduction and up to ₱10,000,000 for the family home. '
      + '<b style="color:var(--ink)">Funeral, medical and judicial expenses are no longer deductible — the ₱5,000,000 standard deduction absorbs them.</b> '
      + 'Return due ' + fmt(X.due) + ', one year from death.'
    : 'Death before <b>1 January 2018</b>. The graduated 5%–20% table applies, with only ₱1,000,000 of standard deduction and ₱1,000,000 for the family home — '
      + '<b style="color:var(--ink)">but funeral, medical and judicial expenses are deductible.</b> Return due ' + fmt(X.due) + ', six months from death.';
  $("u-death").textContent = train ? "On or after 1 Jan 2018 — TRAIN applies" : "Before 1 Jan 2018 — old rules apply";
  $("u-fh").textContent = "Deductible up to " + peso(cap) + " of the client's interest";
  $("u-late").textContent = "Return is due " + (train ? "1 year" : "6 months") + " from death";
  document.querySelector(".optrow").classList.toggle("train", train);

  var opts = '<option value="-1">None selected</option>' + P.rows.map(function(r){
    return '<option value="'+r.i+'"'+(r.i===S.familyHome?' selected':'')+'>'+esc(r.name || "Unnamed asset")+' — '+peso(r.est)+'</option>';
  }).join("");
  if ($("in-fh").innerHTML !== opts) $("in-fh").innerHTML = opts;
}

function renderRoutes(P){
  var X = P.tax, ejsPick = S.route === "ejs";
  var r = function(label, jud, ejs, noteJ, noteE){
    return '<tr><td>'+label+'</td>'
      + '<td'+(ejsPick?'':' class="pick"')+'>'+jud+(noteJ?'<small>'+noteJ+'</small>':'')+'</td>'
      + '<td'+(ejsPick?' class="pick"':'')+'>'+ejs+(noteE?'<small>'+noteE+'</small>':'')+'</td></tr>';
  };
  $("routes").innerHTML =
    '<thead><tr><th>Cost</th><th'+(ejsPick?'':' class="pick"')+'>Judicial / probate</th><th'+(ejsPick?' class="pick"':'')+'>Extrajudicial</th></tr></thead><tbody>'
    + r("Estate tax", peso(X.taxTotal), peso(X.taxTotal), "6% of the net taxable estate", "6% of the net taxable estate")
    + r("Executor / administrator", peso(X.executor), "₱0", S.rExecutor+"% of the gross estate", "Heirs manage it directly")
    + r("Notarial fee", "—", peso(X.notarial), "Inside the probate lawyer's fees", S.rNotarial+"% of the gross estate")
    + r("Newspaper publication", peso(X.pub), peso(X.pub), "Ordered by the court", "3 consecutive weeks")
    + r("Local transfer tax", peso(X.transfer), peso(X.transfer), S.rTransfer+"% of "+peso(X.realty)+" real property", S.rTransfer+"% of "+peso(X.realty)+" real property")
    + r("Registration fee", peso(X.registration), peso(X.registration), S.rReg+"% to the Register of Deeds", S.rReg+"% to the Register of Deeds")
    + r("Donor's tax", peso(0), P.donorsTax > 0 ? peso(P.donorsTax) : "₱0", "No waivers in probate", P.donorsTax > 0 ? "A share was waived to a named heir" : "None waived")
    + '</tbody><tfoot><tr><td>Total cash to transfer the estate</td>'
    + '<td'+(ejsPick?'':' class="pick"')+'>'+peso(X.jud)+'</td><td'+(ejsPick?' class="pick"':'')+'>'+peso(X.ejs + P.donorsTax)+'</td></tr>'
    + '<tr class="saving"><td>Difference</td><td colspan="2" style="text-align:right">'
    + (X.jud > X.ejs + P.donorsTax
        ? 'Extrajudicial settlement saves ' + peso(X.jud - X.ejs - P.donorsTax) + ' — but it needs every heir to agree, and no one may be a minor without a court-appointed guardian.'
        : 'Probate costs ' + peso(X.ejs + P.donorsTax - X.jud) + ' less here.')
    + '</td></tr></tfoot>';
}

function renderWaivers(P){
  $("waive-say").innerHTML = 'There are two ways to give up an inheritance and they are taxed very differently. '
    + 'A plain <b>repudiation</b> — refusing outright, with the share accruing to the co-heirs by operation of law — costs nothing. '
    + 'A <b>waiver in favour of a named person</b> is a donation in the BIR\'s eyes, and the heir who gave it up owes '
    + '<b>6% donor\'s tax on everything above ₱250,000</b> — on money they never received.';

  $("wgrid").innerHTML = P.heirs.length ? P.heirs.map(function(h){
    var opts = '<option value="accept"'+(h.waive==="accept"?" selected":"")+'>Accepts their share</option>'
      + '<option value="repudiate"'+(h.waive==="repudiate"?" selected":"")+'>Repudiates — share goes to the co-heirs</option>'
      + P.heirs.filter(function(o){ return o.id !== h.id; }).map(function(o){
          return '<option value="'+o.id+'"'+(h.waive===o.id?" selected":"")+'>Waives to '+esc(o.name)+'</option>';
        }).join("");
    var acting = h.waive !== "accept";
    var line = h.waive === "repudiate"
      ? 'Repudiated. Nothing to the BIR — the share accrues to the co-heirs.'
      : (acting ? 'Donor&rsquo;s tax owed by ' + esc(h.name) + ': <b>' + peso(h.donorsTax) + '</b>'
                : 'If waived to a named heir, ' + esc(firstName(h.name)) + ' would owe <b>' + peso(h.wouldOwe) + '</b>');
    return '<div class="wcard'+(acting?" acting":"")+'">'
      + '<div class="top"><span class="nm">'+esc(h.name)+'<small>'+h.role+'</small></span>'
      + '<span class="amt">'+peso(h.waive==="accept"?h.receives:h.gave)+'</span></div>'
      + '<select data-w="'+h.id+'" aria-label="What '+esc(h.name)+' does with their share">'+opts+'</select>'
      + '<span class="owe">'+line+'</span></div>';
  }).join("") : '<p class="empty">No heirs listed yet.</p>';

  $("waive-caption").textContent = P.donorsTax > 0 ? peso(P.donorsTax) + " of donor's tax triggered" : "Nobody has waived";

  var out = "";
  if (P.donorsTax > 0){
    var t = P.waivers.filter(function(w){ return w.targeted; });
    out = '<div class="flag"><b>The waived-share trap.</b>&nbsp;'
      + t.map(function(w){
          return esc(w.from.name) + ' waived ' + peso(w.amount) + ' to ' + esc(w.to.name)
            + ' and owes ' + peso(w.tax) + ' in donor\'s tax on it — payable in cash, out of pocket, on an inheritance '
            + esc(firstName(w.from.name)) + ' never took.';
        }).join(" ")
      + ' A total partition agreement that simply allots the property differently avoids this; an explicit, targeted waiver does not.</div>';
  } else if (P.waivers.length){
    out = '<div class="flag" style="background:var(--accent-soft);border-left-color:var(--accent)"><b>No donor\'s tax.</b>&nbsp;'
      + 'The repudiated share accrues to the co-heirs by operation of law, so the BIR sees no gift. This is the clean way to step aside.</div>';
  }
  $("waive-result").innerHTML = out;
}


/* ---------- ages, and what being a minor actually blocks ---------- */
function renderAges(P){
  var say = function(age){
    if (age === null) return "";
    if (age < 0) return "not yet born";
    return age + (age < 18 ? " — a minor" : "");
  };
  var put = function(el, age){
    if (!el) return;
    el.textContent = say(age);
    el.classList.toggle("minor", age !== null && age >= 0 && age < 18);
  };
  put($("age-client"), P.clientAge);
  put($("age-spouse"), S.spouse ? ageAt(S.spouseDob, S.deathDate) : null);
  P.heirs.forEach(function(h){
    if (h.key === "ss") return;
    put(document.querySelector('[data-age="' + h.id + '"]'), h.age);
  });

  var names = P.minors.map(function(h){ return esc(h.name) + " (" + h.age + ")"; }).join(", ");
  var plural = P.minors.length > 1;

  // Rule 74: an extrajudicial settlement needs every heir to be of legal age.
  var route = $("minor-route");
  if (route){
    route.innerHTML = P.hasMinor
      ? '<div class="flag"><b>A minor heir is involved.</b>&nbsp;' + names
        + (plural ? ' are' : ' is') + ' under 18 at the assumed date of death. Under Rule 74 an extrajudicial settlement '
        + 'needs every heir to be of legal age, so this family cannot use it unless the court appoints a guardian to sign for '
        + (plural ? 'them' : 'him or her') + ' — which costs time and most of the saving. Price the judicial route until that is resolved.'
        + (P.minors.length ? ' ' + esc(P.minors[0].name) + ' reaches 18 in ' + P.minors[0].yearsToMajority + ' year'
            + (P.minors[0].yearsToMajority === 1 ? '' : 's') + '.' : '')
        + '</div>'
      : "";
  }

  // Family Code Art. 225: parents administer a child's property only up to P50,000.
  var ins = $("minor-benef");
  if (ins){
    var big = P.minors.filter(function(h){ return h.shortBase > 50000; });
    ins.innerHTML = big.length
      ? '<div class="flag" style="margin-top:12px"><b>Proceeds to a minor need somewhere to land.</b>&nbsp;'
        + big.map(function(h){ return esc(h.name) + " (" + h.age + ") is allocated " + peso(h.shortBase); }).join("; ")
        + '. Under Family Code Art. 225 a parent administers a child\'s property only up to ₱50,000 — above that the court '
        + 'appoints a guardian and requires a bond. Name a trust, or a guardian of the property, rather than the child directly.</div>'
      : "";
  }
}

/* ---------- the summary sheet ---------- */
function renderSummary(P, L, E, reg, t, i){
  var X = P.tax;
  $("sum-title").textContent = "Estate of " + client();
  $("sum-sub").textContent = (S.spouse ? REGIME_NAME[reg] : "No property regime")
    + " · " + (S.lc.length + S.ilc.length + S.lp.length + (S.spouse?1:0)) + " heirs";

  var settle = X.chosen + P.donorsTax;
  var tiles = [
    ["Net distributable estate", peso(E), "What actually passes to the heirs", "key"],
    ["Tax and settlement", peso(settle), (S.route==="ejs"?"Extrajudicial":"Judicial") + " · " + pct(X.effective) + " effective estate tax", ""],
    ["Cash in the estate", peso(P.liqTotal), P.liqShort > 0.5 ? peso(P.liqShort) + " short of what settlement needs" : peso(P.cashLeft) + " left after settlement", P.liqShort > 0.5 ? "warn" : ""],
    ["Insurance to balance it", P.coverage > 0.5 ? peso(S.coverMode==="custom"?S.coverAmount:P.coverage) : "None needed",
      P.coverage > 0.5 ? "Closes the gap without selling property" : "Every heir reaches their fair share", P.coverage > 0.5 ? "warn" : "good"]
  ];
  $("sum-tiles").innerHTML = tiles.map(function(c){
    return '<div class="tile '+c[3]+'"><span class="k">'+esc(c[0])+'</span><span class="v">'+c[1]+'</span><span class="n">'+esc(c[2])+'</span></div>';
  }).join("");

  var facts = [];
  if (S.spouse)
    facts.push("<b>" + esc(firstName(spouseWho())) + " keeps " + peso(L.spouseOwn) + " before any inheritance</b> — her half of the shared property plus her own. Only " + peso(E) + " is " + esc(firstName(client())) + "'s to pass on.");
  facts.push("<b>" + peso(P.floorTotal) + " is reserved by law</b> as legitimes and cannot be changed by any will. The free portion — <b>" + peso(Math.max(E - P.floorTotal, 0)) + "</b> — is the only part " + esc(firstName(client())) + " controls.");
  facts.push("<b>Without a will</b> the estate is split by the Civil Code's fixed ratios. <b>With one</b>, the free portion can be directed, but the legitimes stand either way.");
  facts.push("<b>Only " + peso(P.liqTotal) + " of the estate is cash</b> — " + (P.T>0?pct(P.liqTotal/P.T*100):"0%") + " of it. The remaining " + peso(P.illiqTotal) + " is property that has to be sold, mortgaged or co-owned before anyone is paid.");
  facts.push("<b>The BIR must be paid " + peso(X.taxTotal) + "</b> within " + (X.mode==="train"?"one year":"six months") + " of death" + (X.due ? ", by " + X.due.toLocaleDateString("en-PH",{day:"numeric",month:"long",year:"numeric"}) : "") + ". Late filing adds a 25% surcharge and 12% annual interest.");
  if (P.impaired > 0.5)
    facts.push("<b>The current gifts impair " + P.impairedCount + " legitime" + (P.impairedCount>1?"s":"") + " by " + peso(P.impaired) + "</b>, which makes the will reducible in court. Fund it or cut the gifts back.");
  else if (P.equalize > 0.5)
    facts.push("<b>" + peso(P.equalize) + " separates the heirs from an equal outcome.</b> Life insurance paid to named beneficiaries closes it on death, outside the estate and outside probate.");
  else
    facts.push("<b>Every heir reaches their fair share from the estate itself.</b> Insurance would be a legacy, not a repair.");

  drawPie($("pie-st"), $("tip-st"), $("pie-st").parentNode, slicesOf(t), E, "st");
  drawPie($("pie-si"), $("tip-si"), $("pie-si").parentNode, slicesOf(i), E, "si");
  renderLegend($("leg-st"), t, E);
  renderLegend($("leg-si"), i, E);

  $("sum-facts").innerHTML = facts.map(function(f,n){
    return '<div class="fact"><span class="no">'+(n+1)+'</span><span>'+f+'</span></div>';
  }).join("");
}

/* ---------- main ---------- */
function render(){
  var reg = regime();

  if (!S.spouse){
    $("regime-badge").textContent = "No property regime";
    $("regime-why").textContent = "With no spouse, every property listed below belongs to " + client() + " alone and enters the estate in full.";
  } else {
    $("regime-badge").textContent = REGIME_NAME[reg];
    var by = S.prenup !== "none"
      ? "Set by pre-nuptial agreement, overriding the default for the date of marriage."
      : (reg === "cpg" ? "No marriage settlement, and the marriage predates 3 August 1988 — the Civil Code default."
                       : "No marriage settlement, and the marriage is on or after 3 August 1988 — the Family Code default.");
    var rule = reg === "cpg"
      ? "Property owned before the marriage stays exclusive to its owner — but the fruits and income of that exclusive property belong to the partnership."
      : reg === "acp"
      ? "Property owned before the marriage joins the community. Only property inherited or received by gift during the marriage, and its fruits, stay exclusive."
      : "Each spouse keeps everything in their own name. Nothing is pooled, so nothing is split.";
    $("regime-why").innerHTML = esc(by) + " <b style='color:var(--ink)'>" + esc(rule) + "</b>";
  }

  $("spouse-fields").classList.toggle("hidden", !S.spouse);
  $("hint-lp").textContent = S.lc.length > 0
    ? "Excluded — legitimate children are surviving." : "Inherit only when no legitimate children survive.";
  document.querySelector(".sched").classList.toggle("no-spouse", !S.spouse);
  $("in-debton").classList.toggle("hidden", !S.spouse);
  $("debt-hint").textContent = !S.spouse
    ? "Settled out of the estate before any share is computed. Heirs never pay out of pocket."
    : (S.debtOn === "conjugal"
        ? "A conjugal charge comes out of the shared pot, so it halves " + firstName(spouseWho()) + "'s share along with the estate."
        : "The client's own debt is settled out of his exclusive property and leaves " + firstName(spouseWho()) + "'s half untouched.");

  renderChips();
  renderTotals(reg);

  var L = liquidate(), E = L.estate;
  renderDerive(L, reg);

  var t = testate(E), i = intestate(E);
  drawPie($("pie-t"), $("tip-t"), $("wrap-t"), slicesOf(t), E, "t");
  drawPie($("pie-i"), $("tip-i"), $("wrap-i"), slicesOf(i), E, "i");
  renderLegend($("leg-t"), t, E);
  renderLegend($("leg-i"), i, E);
  renderNotes($("notes-t"), t);
  renderNotes($("notes-i"), i);
  renderTable(t, i, E);

  $("table-caption").textContent = "Estate of " + client() + " · " + peso(E);

  var P = plan(E, t, reg);
  renderTax(P, reg);
  renderRoutes(P);
  renderWaivers(P);
  $("cost-hint").innerHTML = "On top of " + peso(P.tax.chosen + P.donorsTax) + " of estate tax and settlement costs computed above, under "
    + (S.route === "ejs" ? "extrajudicial settlement" : "judicial settlement") + ".";
  renderLiquidity(P, E);
  renderBequests(P);
  renderFreePortion(P, E);
  renderReceipts(P, E);
  renderSummary(P, L, E, reg, t, i);
  renderAges(P);

  var msg = t.cap || i.cap, flag = $("cap-flag");
  if (msg){ flag.innerHTML = '<b>Legitime floor reached.</b>&nbsp;' + esc(msg); flag.style.display = "flex"; }
  else flag.style.display = "none";
}

export { render, renderPropRows, renderHeirList };
