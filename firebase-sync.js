/* Firebase online sync — Pão da Dilma
   Usa o mesmo projeto Firebase do Controle de Viaturas CPA-7.
   Os dados do Pão da Dilma ficam isolados no documento app/pao_da_dilma.
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
  let db = null, unsubscribe = null, ready = false, writing = false;

  function notify(msg, ok=false){
    try { if(typeof toast === "function") toast(msg); } catch(e) {}
    window.dispatchEvent(new CustomEvent("pao-firebase-status", {detail:{msg,ok}}));
  }

  async function start(state, applyRemote){
    try {
      if (!window.firebase) throw new Error("SDK do Firebase não carregado.");
      if (!firebase.apps.length) firebase.initializeApp(PAO_FIREBASE_CONFIG);
      db = firebase.firestore();
      await firebase.auth().signInAnonymously();
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
        // Primeiro aparelho: publica o que já existe localmente.
        if (state && (state.clients?.length || state.sales?.length || state.costs?.length || state.receipts?.length || state.credits?.length || state.reports?.length)) {
          writing = true;
          await ref.set({app:"Pão da Dilma", version:33, updatedAt:firebase.firestore.FieldValue.serverTimestamp(), data:state});
          writing = false;
        }
        ready = true;
      }, err => {
        console.error("Firebase snapshot:", err);
        notify("Firebase indisponível. O aplicativo continua usando os dados deste aparelho.");
      });
      return true;
    } catch(err) {
      console.error("Firebase init:", err);
      notify("Firebase ainda não configurado. O aplicativo continua funcionando localmente.");
      return false;
    }
  }

  async function save(state){
    if (!db || !ready) return;
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

  window.paoFirebaseStart = start;
  window.paoFirebaseSave = save;
})();
