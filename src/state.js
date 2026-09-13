// Generated from the single-file prototype. Behaviour is identical; see test/engine.test.mjs.

export const S = {
  client:"Juan Dela Cruz",
  spouse:true, spouseName:"Maria Dela Cruz", date:"1985-02-14", prenup:"none",
  debts:0, debtOn:"conjugal", otherCash:0, freeTo:"prorata",
  coverMode:"auto", coverAmount:0,
  citizen:"resident", familyHome:3, monthsLate:0, route:"ejs",
  deathDate:"", funeral:0, medical:0, judicial:0,
  rTransfer:0.75, rReg:0.5, rNotarial:1.5, rExecutor:5, pub:10000,
  waive:{},
  props:[
    {name:"Quezon City",        note:"House and lot",         value:10000000, owner:"client", acq:"before",     liq:"realty", to:"lc:1"},
    {name:"Marikina",           note:"Townhouse",             value:3000000,  owner:"client", acq:"before",     liq:"realty", to:"residue"},
    {name:"Taguig",             note:"Condominium unit",      value:5000000,  owner:"both",   acq:"onerous",    liq:"realty", to:"residue"},
    {name:"Makati Family Home", note:"Family home",           value:9000000,  owner:"both",   acq:"onerous",    liq:"realty", to:"residue"},
    {name:"Bulacan Farmland",   note:"Inherited from mother", value:4000000,  owner:"spouse", acq:"gratuitous", liq:"realty", to:"residue"},
    {name:"Joint Bank Account", note:"Savings",               value:2000000,  owner:"both",   acq:"onerous",    liq:"liquid",   to:"residue"},
    {name:"Philequity Fund",    note:"Mutual fund",           value:1500000,  owner:"both",   acq:"onerous",    liq:"liquid",   to:"residue"}
  ],
  lc:["Juan Jr.","Ana Marie","Miguel"],
  ilc:["Carlo","Beatriz"],
  lp:[]
};

export const CUT = Date.UTC(1988,7,3);
export const $ = function(id){ return document.getElementById(id); };

export const ACQ = {
  before:"Before the marriage",
  onerous:"During — bought or earned",
  gratuitous:"During — inherited or gifted",
  fruits:"Fruits of exclusive property"
};
