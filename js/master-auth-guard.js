(function(){
  const cfg=window.AM_SYNC_CONFIG||{};
  if(!(cfg.mode==="supabase"&&cfg.supabaseUrl&&cfg.supabaseAnonKey)) return;
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.onload=async()=>{
    try{
      const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
      const {data}=await client.auth.getUser();
      if(!data||!data.user){ location.href='master-login.html'; }
    }catch(_){ location.href='master-login.html'; }
  };
  document.head.appendChild(script);
})();
