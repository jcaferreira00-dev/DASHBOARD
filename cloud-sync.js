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
let pararDeOuvirGastosSnap = null;
let pararDeOuvirFiadoSnap = null;

function referenciaDoUsuario(uid) {
  // Coleção exclusiva deste app — cada app da mesma conta Firebase
  // deve usar seu próprio nome de coleção aqui pra não sobrescrever os outros.
  return doc(db, "dashboard_usuarios", uid);
}

// Documento do app de contas (Gestão Financeira). Este app SÓ LÊ daqui:
// nunca grava nessa coleção. Os dados ficam no campo "gestaoFinanceira".
function referenciaDoAppDeContas(uid) {
  return doc(db, "gastosmensais_usuarios", uid);
}

// Documento do app Fiado. Este app SÓ LÊ daqui: nunca grava nessa coleção.
// Os dados ficam no campo "caderneta" ({ pessoas, updatedAt }).
function referenciaDoFiado(uid) {
  return doc(db, "fiado_usuarios", uid);
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

  // Troca por inteiro cada campo de nível superior enviado (sem mesclar por dentro,
  // pra itens apagados não "ressuscitarem") e não mexe em campos que não foram enviados.
  // O JSON.parse/stringify tira valores "undefined", que o Firestore recusa.
  async salvarNaNuvem(uid, dados) {
    const limpo = JSON.parse(JSON.stringify(dados));
    await setDoc(referenciaDoUsuario(uid), limpo, { mergeFields: Object.keys(limpo) });
  },

  // Busca direto do servidor (não do cache local). Se estiver offline, cai pro cache.
  // Retorna null SOMENTE quando o documento realmente não existe.
  // Se não deu pra saber (sem rede e sem cache), LANÇA ERRO — quem chama não deve
  // tratar isso como "não existe" e gravar por cima.
  async buscarDaNuvem(uid) {
    let snap;
    try { snap = await getDocFromServer(referenciaDoUsuario(uid)); }
    catch (e) { snap = await getDoc(referenciaDoUsuario(uid)); }
    if (!snap.exists()) {
      if (snap.metadata && snap.metadata.fromCache) throw new Error("sem-confirmacao-do-servidor");
      return null;
    }
    return snap.data();
  },

  // Lê os dados do app de contas. Retorna { dados, doCache }:
  // dados = conteúdo de "gestaoFinanceira" (ou null se ainda não existe).
  // Lança erro se não foi possível ler (permissão, rede...).
  async buscarGastos(uid) {
    let snap, doCache = false;
    try { snap = await getDocFromServer(referenciaDoAppDeContas(uid)); }
    catch (e) {
      if (e && e.code === "permission-denied") throw e;
      snap = await getDoc(referenciaDoAppDeContas(uid));
      doCache = true;
    }
    const d = snap.exists() ? snap.data() : null;
    return { dados: d && d.gestaoFinanceira ? d.gestaoFinanceira : null, doCache };
  },

  // Avisa quando o app de contas salvar algo novo (qualquer aparelho).
  ouvirGastos(uid, callback, aoErrar) {
    if (pararDeOuvirGastosSnap) pararDeOuvirGastosSnap();
    pararDeOuvirGastosSnap = onSnapshot(referenciaDoAppDeContas(uid), (snap) => {
      if (snap.exists()) callback(snap.data());
    }, (e) => { if (aoErrar) aoErrar(e); });
  },

  // Lê os dados do Fiado (doc inteiro; o campo útil é "caderneta"). Retorna null se o documento não existe.
  // Lança erro se não foi possível ler (permissão, rede...).
  async buscarFiado(uid) {
    let snap;
    try { snap = await getDocFromServer(referenciaDoFiado(uid)); }
    catch (e) {
      if (e && e.code === "permission-denied") throw e;
      snap = await getDoc(referenciaDoFiado(uid));
    }
    return snap.exists() ? snap.data() : null;
  },

  // Avisa quando o Fiado salvar algo novo (qualquer aparelho). Ignora o que veio só do cache do aparelho.
  ouvirFiado(uid, callback, aoErrar) {
    if (pararDeOuvirFiadoSnap) pararDeOuvirFiadoSnap();
    pararDeOuvirFiadoSnap = onSnapshot(referenciaDoFiado(uid), (snap) => {
      if (snap.metadata.fromCache) return;
      if (snap.exists()) callback(snap.data());
    }, (e) => { if (aoErrar) aoErrar(e); });
  },

  // Só repassa mudanças confirmadas pelo servidor: ignora o "eco" do próprio salvamento
  // e a cópia antiga guardada no aparelho (que poderia estar atrás da nuvem).
  ouvirMudancas(uid, callback, aoErrar) {
    if (pararDeOuvirSnapshot) pararDeOuvirSnapshot();
    pararDeOuvirSnapshot = onSnapshot(referenciaDoUsuario(uid), (snap) => {
      if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
      if (snap.exists()) callback(snap.data());
    }, (e) => { if (aoErrar) aoErrar(e); });
  },

  pararDeOuvir() {
    if (pararDeOuvirSnapshot) {
      pararDeOuvirSnapshot();
      pararDeOuvirSnapshot = null;
    }
    if (pararDeOuvirGastosSnap) {
      pararDeOuvirGastosSnap();
      pararDeOuvirGastosSnap = null;
    }
    if (pararDeOuvirFiadoSnap) {
      pararDeOuvirFiadoSnap();
      pararDeOuvirFiadoSnap = null;
    }
  }
};

// Avisa o script.js que já pode usar o CloudSync
window.dispatchEvent(new Event("cloudsync-pronto"));
