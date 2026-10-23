// =====================================================
// FIREBASE — LOGIN + SINCRONIZAÇÃO NA NUVEM
// Este arquivo não mexe na lógica do app (script.js).
// Ele só expõe window.CloudSync com funções prontas pra usar.
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ===========================
// CONFIGURAÇÃO DO SEU PROJETO
// ===========================

const firebaseConfig = {
  apiKey: "AIzaSyCQBwZU8NK9YTGrnI-1-XDUhRGcmn3vMHs",
  authDomain: "ajuste-financeiro.firebaseapp.com",
  projectId: "ajuste-financeiro",
  storageBucket: "ajuste-financeiro.firebasestorage.app",
  messagingSenderId: "1084264963597",
  appId: "1:1084264963597:web:fbf369dfa8e5dcb1d1bf44"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Cache offline que funciona com o app aberto em várias abas, e conexão por
// "long polling", que passa por proxies/firewalls de rede corporativa
// (a conexão em tempo real padrão costuma ser bloqueada no PC do trabalho).
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalForceLongPolling: true
});

let pararDeOuvirSnapshot = null;

function referenciaDoUsuario(uid) {
  // Coleção exclusiva deste app — cada app da mesma conta Firebase
  // deve usar seu próprio nome de coleção aqui pra não sobrescrever os outros.
  return doc(db, "dashboard_usuarios", uid);
}

// ===========================
// API EXPOSTA PRO script.js
// ===========================

window.CloudSync = {

  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },

  login(email, senha) {
    return signInWithEmailAndPassword(auth, email, senha);
  },

  cadastrar(email, senha) {
    return createUserWithEmailAndPassword(auth, email, senha);
  },

  logout() {
    return signOut(auth);
  },

  async salvarNaNuvem(uid, dados) {
    await setDoc(referenciaDoUsuario(uid), dados);
  },

  // Busca direto do servidor (não do cache local). Se estiver offline, cai pro cache.
  async buscarDaNuvem(uid) {
    let snap;
    try { snap = await getDocFromServer(referenciaDoUsuario(uid)); }
    catch (e) { snap = await getDoc(referenciaDoUsuario(uid)); }
    return snap.exists() ? snap.data() : null;
  },

  // Só repassa mudanças que vieram do servidor (ignora o "eco" do próprio salvamento).
  ouvirMudancas(uid, callback, aoErrar) {
    if (pararDeOuvirSnapshot) pararDeOuvirSnapshot();
    pararDeOuvirSnapshot = onSnapshot(referenciaDoUsuario(uid), (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      if (snap.exists()) callback(snap.data());
    }, (e) => { if (aoErrar) aoErrar(e); });
  },

  pararDeOuvir() {
    if (pararDeOuvirSnapshot) {
      pararDeOuvirSnapshot();
      pararDeOuvirSnapshot = null;
    }
  }
};

// Avisa o script.js que já pode usar o CloudSync
window.dispatchEvent(new Event("cloudsync-pronto"));
