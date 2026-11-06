/* Musab Shoaib & Co - site behaviour: tabs, form handling, saving, admin table, CSV export.
   NOTE: claude.use(...) only works on Claude's hosting. Replace with Supabase when moving to your own host. */
(function(){
  var FALLBACK_EMAIL = "hello@example.com"; // replace with your email
  document.getElementById("yr").textContent = new Date().getFullYear();
  var db = null, user = null, all = [];

  // tabs
  document.querySelectorAll(".tab").forEach(function(t){
    t.addEventListener("click", function(){
      document.querySelectorAll(".tab").forEach(function(x){x.setAttribute("aria-selected", x===t)});
      document.getElementById("enquiry").hidden = t.dataset.t !== "enquiry";
      document.getElementById("onboard").hidden = t.dataset.t !== "onboard";
    });
  });

  function collect(f){
    var d = {type:f.dataset.type, received:new Date().toISOString()}, svc = [];
    new FormData(f).forEach(function(v,k){
      if(k==="svc") svc.push(v); else if(k!=="consent") d[k]=String(v).trim();
    });
    if(svc.length) d.services = svc;
    d.consent = true;
    return d;
  }
  function show(f, cls, text){var m=f.querySelector(".msg");m.className="msg "+cls;m.textContent=text;}

  document.querySelectorAll("form").forEach(function(f){
    f.addEventListener("submit", async function(e){
      e.preventDefault();
      if(!f.checkValidity()){f.reportValidity();return;}
      var data = collect(f);
      if(db){
        try{
          var uid = await user.id();
          var ref = db.doc("submissions/"+uid);
          var snap = await ref.get();
          var prev = (snap && snap.exists && snap.data().entries) || [];
          await ref.set({entries: prev.concat([data])});
          f.reset(); show(f,"ok","Thank you – your details have been received. I'll be in touch soon.");
          return;
        }catch(err){}
      }
      // fallback when storage isn't available to this visitor
      var body = Object.keys(data).map(function(k){return k+": "+(Array.isArray(data[k])?data[k].join(", "):data[k]);}).join("\n");
      show(f,"err","Secure storage isn't available right now, so your email app will open with your details to send instead.");
      location.href = "mailto:"+FALLBACK_EMAIL+"?subject="+encodeURIComponent("Client "+data.type+" – "+(data.business||data.name))+"&body="+encodeURIComponent(body);
    });
  });

  function esc(s){var d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML;}
  function render(){
    var tb = document.getElementById("rows");
    document.getElementById("count").textContent = "(" + all.length + ")";
    if(!all.length){tb.innerHTML='<tr><td colspan="6" class="note">No submissions yet.</td></tr>';return;}
    tb.innerHTML = all.map(function(d){
      var skip={type:1,received:1,name:1,business:1,email:1,consent:1};
      var det = Object.keys(d).filter(function(k){return !skip[k]&&d[k]}).map(function(k){
        return "<b>"+esc(k)+":</b> "+esc(Array.isArray(d[k])?d[k].join(", "):d[k]);}).join("<br>");
      return "<tr><td>"+esc(new Date(d.received).toLocaleString("en-GB"))+"</td><td>"+esc(d.type)+"</td><td>"+esc(d.name)+"</td><td>"+esc(d.business)+"</td><td>"+esc(d.email)+"</td><td>"+det+"</td></tr>";
    }).join("");
  }

  document.getElementById("csv").addEventListener("click", async function(){
    var dl = await claude.use("downloads"); if(!dl) return;
    var keys = []; all.forEach(function(d){Object.keys(d).forEach(function(k){if(keys.indexOf(k)<0)keys.push(k)})});
    var q = function(v){v=Array.isArray(v)?v.join("; "):(v==null?"":String(v));return '"'+v.replace(/"/g,'""')+'"';};
    var csv = [keys.join(",")].concat(all.map(function(d){return keys.map(function(k){return q(d[k])}).join(",")})).join("\n");
    try{await dl.save({filename:"client-submissions.csv",data:csv});}catch(e){}
  });

  (async function(){
    try{ if(!window.claude) return;
      db = await claude.use("db"); user = await claude.use("user");
      if(db && user && user.isOwner()){
        document.getElementById("admin").hidden = false;
        document.getElementById("adminLink").hidden = false;
        db.collection("submissions").onSnapshot(function(snap){
          all = [];
          snap.docs.forEach(function(x){var d=x.data(); if(d&&d.entries) all=all.concat(d.entries);});
          all.sort(function(a,b){return a.received<b.received?1:-1;}); render();
        }, function(){});
      }
    }catch(e){}
  })();
})();
