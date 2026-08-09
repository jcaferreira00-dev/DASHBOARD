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
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  enableIndexedDbPersistence
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
const db = getFirestore(app);

// Permite o app funcionar offline e sincronizar quando voltar a internet
try {
  enableIndexedDbPersistence(db);
} catch (e) {
  // Ignora: acontece se o site estiver aberto em mais de uma aba, por exemplo
}

let pararDeOuvirSnapshot = null;

function referenciaDoUsuario(uid) {
  return doc(db, "usuarios", uid);
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

  async buscarDaNuvem(uid) {
    const snap = await getDoc(referenciaDoUsuario(uid));
    return snap.exists() ? snap.data() : null;
  },

  ouvirMudancas(uid, callback) {
    if (pararDeOuvirSnapshot) pararDeOuvirSnapshot();
    pararDeOuvirSnapshot = onSnapshot(referenciaDoUsuario(uid), (snap) => {
      if (snap.exists()) callback(snap.data());
    });
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
