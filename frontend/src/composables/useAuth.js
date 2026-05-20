import { ref } from 'vue';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import { auth } from '../firebase/config.js';
import { isAllowedGoogleEmail } from '../auth/allowedGoogleEmails.js';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const user = ref(null);
const authLoading = ref(true);
const authError = ref(null);
const userDisplayName = ref(null);

onAuthStateChanged(auth, (firebaseUser) => {
  if (firebaseUser) {
    if (!isAllowedGoogleEmail(firebaseUser.email)) {
      authError.value =
        'Esta cuenta no tiene acceso. Solo se permiten cuentas autorizadas de Voren.';
      firebaseSignOut(auth).catch(() => {});
      user.value = null;
      userDisplayName.value = null;
      authLoading.value = false;
      return;
    }
  }
  user.value = firebaseUser;
  userDisplayName.value = firebaseUser?.displayName ?? null;
  authLoading.value = false;
});

async function nukeFirebaseAuthStorage() {
  // Clear all Firebase Auth persistence so the next sign-in starts from a
  // truly blank slate. Needed when previous failed flows left a zombie user
  // record that triggers `auth/provider-already-linked`.
  try { await firebaseSignOut(auth); } catch { /* noop */ }
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('firebase:'))
      .forEach((k) => localStorage.removeItem(k));
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('firebase:'))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch { /* noop */ }
  try {
    const dbs = (await indexedDB.databases?.()) || [];
    await Promise.all(
      dbs
        .filter((d) => d.name && /firebase|firebaseLocalStorageDb/i.test(d.name))
        .map(
          (d) =>
            new Promise((resolve) => {
              const req = indexedDB.deleteDatabase(d.name);
              req.onsuccess = req.onerror = req.onblocked = () => resolve();
            })
        )
    );
  } catch { /* noop */ }
}

async function signInWithGoogle() {
  authError.value = null;
  if (auth.currentUser) {
    try { await firebaseSignOut(auth); } catch { /* noop */ }
  }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error('[auth] signInWithPopup failed:', err?.code, err?.message, err);
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      authError.value = null;
    } else if (err.code === 'auth/popup-blocked') {
      authError.value = 'El navegador bloqueó la ventana emergente. Permite ventanas para este sitio.';
    } else if (err.code === 'auth/provider-already-linked' || err.code === 'auth/credential-already-in-use') {
      authError.value = 'Limpiando sesión previa. Recargando…';
      await nukeFirebaseAuthStorage();
      window.location.reload();
    } else {
      authError.value = `No se pudo iniciar sesión: ${err?.code || err?.message || 'error desconocido'}`;
    }
  }
}

async function signOut() {
  authError.value = null;
  await firebaseSignOut(auth);
  user.value = null;
  userDisplayName.value = null;
}

async function updateUserProfile(displayName) {
  if (!user.value) throw new Error('No hay usuario autenticado.');
  await firebaseUpdateProfile(user.value, { displayName: displayName.trim() });
  userDisplayName.value = displayName.trim();
}

export function useAuth() {
  return { user, authLoading, authError, userDisplayName, signInWithGoogle, signOut, updateUserProfile };
}
