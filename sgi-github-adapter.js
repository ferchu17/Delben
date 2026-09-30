/* DELBEN SGI - adaptador para ejecutar en GitHub Pages.
 * Conserva la interfaz google.script.run del SGI original y la transporta
 * por POST al puente SGI_GitHub_API.gs.
 */
(function(){
  'use strict';
  var BACKEND_KEY='delben_sgi_backend';
  var BACKEND_URL='';
  try{ BACKEND_URL=localStorage.getItem(BACKEND_KEY)||''; }catch(e){}
  window.DELBEN_SGI_BACKEND_URL=BACKEND_URL;

  function setDelbenSgiBackendUrl(url){
    BACKEND_URL=String(url||'').trim();
    window.DELBEN_SGI_BACKEND_URL=BACKEND_URL;
    try{localStorage.setItem(BACKEND_KEY,BACKEND_URL);}catch(e){}
    return BACKEND_URL;
  }
  window.setDelbenSgiBackendUrl=setDelbenSgiBackendUrl;

  function invoke(fn,args,success,failure,userObj){
    if(!BACKEND_URL){
      var err=new Error('Falta configurar la URL del backend del SGI.');
      if(failure) failure(err,userObj);
      return;
    }
    fetch(BACKEND_URL,{
      method:'POST',
      redirect:'follow',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({fn:fn,args:args||[]})
    }).then(function(res){
      return res.text().then(function(txt){
        var payload;
        try{payload=JSON.parse(txt);}catch(e){throw new Error('Respuesta no válida del backend.');}
        if(!res.ok||!payload||payload.ok!==true){
          throw new Error((payload&&payload.error)||('HTTP '+res.status));
        }
        return payload.result;
      });
    }).then(function(result){
      if(success) success(result,userObj);
    }).catch(function(err){
      if(failure) failure(err,userObj);
      else console.error('SGI RPC '+fn,err);
    });
  }

  function runner(success,failure,userObj){
    var base={
      withSuccessHandler:function(fn){return runner(typeof fn==='function'?fn:success,failure,userObj);},
      withFailureHandler:function(fn){return runner(success,typeof fn==='function'?fn:failure,userObj);},
      withUserObject:function(obj){return runner(success,failure,obj);}
    };
    return new Proxy(base,{get:function(target,prop){
      if(prop in target)return target[prop];
      if(prop==='then')return undefined;
      return function(){invoke(String(prop),Array.prototype.slice.call(arguments),success,failure,userObj);};
    }});
  }

  window.google=window.google||{};
  window.google.script=window.google.script||{};
  window.google.script.run=runner(null,null,null);
})();
