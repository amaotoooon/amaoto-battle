(function(){
  const emailInput=document.getElementById("master-login-email");
  const passwordInput=document.getElementById("master-login-password");
  const submitBtn=document.getElementById("master-login-submit");
  const notice=document.getElementById("master-login-notice");
  const cfg=window.AM_SYNC_CONFIG||{};
  function ready(){return cfg.mode==="supabase"&&cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase&&window.supabase.createClient;}
  async function tryExisting(){
    if(!ready()) { notice.textContent='Supabase設定が未入力のため、ログイン機能はまだ有効ではありません。'; return; }
    const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
    const {data}=await client.auth.getUser();
    if(data&&data.user){ location.href='master.html'; }
  }
  submitBtn?.addEventListener('click', async ()=>{
    if(!ready()){ notice.textContent='Supabase設定を入力してからご利用ください。'; return; }
    const email=(emailInput.value||'').trim();
    const password=passwordInput.value||'';
    if(!email||!password){ notice.textContent='メールアドレスとパスワードを入力してください。'; return; }
    notice.textContent='ログイン中…';
    const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
    const {error}=await client.auth.signInWithPassword({email,password});
    if(error){ notice.textContent=error.message||'ログインに失敗しました。'; return; }
    location.href='master.html';
  });
  tryExisting();
})();
