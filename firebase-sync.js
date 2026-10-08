/* Firebase online sync — Pão da Dilma
   Autenticação por e-mail/senha + recuperação de senha.
   Dados do Pão da Dilma ficam isolados no documento app/pao_da_dilma.
*/
const PAO_FIREBASE_CONFIG = {
  apiKey: "AIzaSyA2H-sd3gaBArqy6pE1pVcV-1Nz14N-dZE",
  authDomain: "controle-de-viaturas-cpa-7.firebaseapp.com",
  projectId: "controle-de-viaturas-cpa-7",
  storageBucket: "controle-de-viaturas-cpa-7.firebasestorage.app",
  messagingSenderId: "630650169264",
  appId: "1:630650169264:web:498aa0a12d48bcb3de9875",
  measurementId: "G-V4NC72LX2L2"
};

(function(){
  const docPath = "app/pao_da_dilma";
  let db = null, auth = null, unsubscribe = null, ready = false, writing = false;

  function notify(msg, ok=false){
    try { if(typeof toast === "function") toast(msg); } catch(e) {}
    window.dispatchEvent(new CustomEvent("pao-firebase-status", {detail:{msg,ok}}));
  }

  function init(){
    if (!window.firebase) throw new Error("SDK do Firebase não carregado.");
    if (!firebase.apps.length) firebase.initializeApp(PAO_FIREBASE_CONFIG);
    db = firebase.firestore();
    auth = firebase.auth();
    return auth;
  }

  try { init(); } catch(e) { console.error("Firebase init:", e); }

  async function login(email,password){
    try {
      init();
      await auth.signInWithEmailAndPassword(String(email).trim(), password);
      return {ok:true};
    } catch(err) {
      console.error("Firebase login:", err);
      let msg="Não foi possível entrar.";
      if(err.code==="auth/invalid-credential" || err.code==="auth/wrong-password" || err.code==="auth/user-not-found") msg="E-mail ou senha incorretos.";
      else if(err.code==="auth/too-many-requests") msg="Muitas tentativas. Aguarde alguns minutos e tente novamente.";
      else if(err.code==="auth/invalid-email") msg="E-mail inválido.";
      else if(err.code==="auth/network-request-failed") msg="Sem conexão com a internet.";
      return {ok:false,msg};
    }
  }

  async function resetPassword(email){
    try {
      init();
      await auth.sendPasswordResetEmail(String(email).trim());
      return {ok:true,msg:"Enviamos um link de recuperação para o seu e-mail."};
    } catch(err) {
      console.error("Firebase reset:", err);
      let msg="Não foi possível enviar o e-mail de recuperação.";
      if(err.code==="auth/user-not-found") msg="Não encontramos uma conta com esse e-mail.";
      else if(err.code==="auth/invalid-email") msg="Digite um e-mail válido.";
      else if(err.code==="auth/network-request-failed") msg="Sem conexão com a internet.";
      return {ok:false,msg};
    }
  }

  async function changePassword(newPassword){
    try {
      init();
      if(!auth.currentUser) return {ok:false,msg:"Usuário não autenticado."};
      await auth.currentUser.updatePassword(newPassword);
      return {ok:true,msg:"Senha alterada com sucesso."};
    } catch(err) {
      console.error("Firebase change password:", err);
      let msg="Não foi possível alterar a senha.";
      if(err.code==="auth/requires-recent-login") msg="Por segurança, saia e entre novamente antes de alterar a senha.";
      else if(err.code==="auth/weak-password") msg="A senha precisa ter pelo menos 6 caracteres.";
      return {ok:false,msg};
    }
  }

  async function logout(){
    try { init(); await auth.signOut(); } catch(e) { console.error(e); }
  }

  async function start(state, applyRemote){
    try {
      init();
      if(!auth.currentUser) throw new Error("Usuário não autenticado.");
      ready=false;
      if(unsubscribe) { unsubscribe(); unsubscribe=null; }
      const ref = db.doc(docPath);
      unsubscribe = ref.onSnapshot(async snap => {
        if (writing) return;
        if (snap.exists && snap.data()?.data) {
          const remote = snap.data().data;
          applyRemote(remote);
          localStorage.setItem("pao_da_dilma_v33", JSON.stringify(remote));
          ready = true;
          return;
        }
        // Primeiro acesso: publica o que já existe localmente.
        if (state && (state.clients?.length || state.sales?.length || state.costs?.length || state.receipts?.length || state.credits?.length || state.reports?.length)) {
          writing = true;
          await ref.set({app:"Pão da Dilma", version:33, updatedAt:firebase.firestore.FieldValue.serverTimestamp(), data:state});
          writing = false;
        }
        ready = true;
      }, err => {
        console.error("Firebase snapshot:", err);
        notify("Não foi possível sincronizar agora. O aplicativo continua funcionando neste aparelho.");
      });
      return true;
    } catch(err) {
      console.error("Firebase start:", err);
      notify("Não foi possível conectar ao Firebase.");
      return false;
    }
  }

  async function save(state){
    if (!db || !auth?.currentUser || !ready) return;
    try {
      writing = true;
      await db.doc(docPath).set({app:"Pão da Dilma", version:33, updatedAt:firebase.firestore.FieldValue.serverTimestamp(), data:state});
      writing = false;
    } catch(err) {
      writing = false;
      console.error("Firebase save:", err);
      notify("Não foi possível sincronizar agora. Os dados continuam salvos neste aparelho.");
    }
  }

  window.paoFirebaseLogin = login;
  window.paoFirebaseResetPassword = resetPassword;
  window.paoFirebaseChangePassword = changePassword;
  window.paoFirebaseLogout = logout;
  window.paoFirebaseGetUser = ()=>auth?.currentUser||null;
  window.paoFirebaseStart = start;
  window.paoFirebaseSave = save;
})();
