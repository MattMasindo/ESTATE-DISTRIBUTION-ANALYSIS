// Generated from the single-file prototype. Behaviour is identical; see test/engine.test.mjs.

import { peso, pct, esc } from "../format.js";

/* ---------- pie ---------- */
var COLOR = { lc:"var(--s-lc)", ss:"var(--s-ss)", ilc:"var(--s-ilc)", lp:"var(--s-lp)", free:"var(--s-free)" };
var HATCH = "repeating-linear-gradient(45deg,var(--s-free),var(--s-free) 2px,var(--s-free-line) 2px,var(--s-free-line) 4px)";

function arc(cx,cy,r,a0,a1){
  if (a1-a0 >= Math.PI*2 - 1e-6) return "M "+cx+" "+(cy-r)+" A "+r+" "+r+" 0 1 1 "+(cx-0.01)+" "+(cy-r)+" Z";
  var big = (a1-a0) > Math.PI ? 1 : 0;
  return "M "+cx+" "+cy
    + " L "+(cx+r*Math.cos(a0)).toFixed(2)+" "+(cy+r*Math.sin(a0)).toFixed(2)
    + " A "+r+" "+r+" 0 "+big+" 1 "+(cx+r*Math.cos(a1)).toFixed(2)+" "+(cy+r*Math.sin(a1)).toFixed(2)+" Z";
}

function drawPie(svg, tip, wrap, slices, E, uid){
  var cx=120, cy=120, r=104, a=-Math.PI/2;
  var live = slices.filter(function(s){ return s.total > 0.005; });
  if (!live.length || E <= 0){
    svg.innerHTML = '<circle cx="120" cy="120" r="104" fill="none" stroke="var(--line-strong)" stroke-width="1.5" stroke-dasharray="4 5"/>'
      + '<text x="120" y="125" text-anchor="middle" fill="var(--ink-3)" font-size="12" font-family="IBM Plex Sans,sans-serif">Nothing to divide</text>';
    return;
  }
  var parts = ['<defs><pattern id="hatch-'+uid+'" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">'
    + '<rect width="7" height="7" fill="var(--s-free)"/><line x1="0" y1="0" x2="0" y2="7" stroke="var(--s-free-line)" stroke-width="2.5"/></pattern></defs>'];
  var labels = [];
  live.forEach(function(s,i){
    var p = s.total/E, a1 = a + p*Math.PI*2;
    parts.push('<path class="slice" data-i="'+i+'" d="'+arc(cx,cy,r,a,a1)+'" fill="'
      + (s.key==="free" ? "url(#hatch-"+uid+")" : COLOR[s.key])
      + '" stroke="var(--surface)" stroke-width="2" stroke-linejoin="round"></path>');
    if (p >= 0.075){
      var mid=(a+a1)/2, lr=r*0.62;
      labels.push('<text class="slice-pct'+(s.key==="free"?" dark-text":"")+'" x="'+(cx+lr*Math.cos(mid)).toFixed(1)
        + '" y="'+(cy+lr*Math.sin(mid)+4).toFixed(1)+'" text-anchor="middle">'+pct(p*100)+'</text>');
    }
    s._pct = p*100; s._mid = (a+a1)/2;
    a = a1;
  });
  svg.innerHTML = parts.join("") + labels.join("");

  Array.prototype.forEach.call(svg.querySelectorAll(".slice"), function(el){
    el.addEventListener("mouseenter", function(){
      var s = live[+el.dataset.i];
      wrap.classList.add("hovering"); el.classList.add("on");
      tip.innerHTML = esc(s.label) + (s.count>1 ? " ("+s.count+")" : "") + "<b>" + peso(s.total) + " · " + pct(s._pct) + "</b>";
      var box = svg.getBoundingClientRect(), wbox = wrap.getBoundingClientRect();
      tip.style.left = (box.left-wbox.left + box.width/2 + Math.cos(s._mid)*box.width*0.30) + "px";
      tip.style.top  = (box.top-wbox.top + box.height/2 + Math.sin(s._mid)*box.height*0.30) + "px";
      tip.style.opacity = 1;
    });
    el.addEventListener("mouseleave", function(){
      wrap.classList.remove("hovering"); el.classList.remove("on"); tip.style.opacity = 0;
    });
  });
}

function slicesOf(res){
  var out = res.groups.map(function(g){ return {key:g.key,label:g.label,count:g.count,total:g.total}; });
  if (res.free > 0.005) out.push({key:"free",label:"Free portion",count:0,total:res.free});
  return out;
}

export { COLOR, HATCH, arc, drawPie, slicesOf };
