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

async function signInWithGoogle() {
  authError.value = null;
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') {
      authError.value = null;
    } else if (err.code === 'auth/popup-blocked') {
      authError.value = 'El navegador bloqueó la ventana emergente. Permite ventanas para este sitio.';
    } else if (err.code === 'auth/cancelled-popup-request') {
      authError.value = null;
    } else {
      authError.value = 'No se pudo iniciar sesión con Google. Intenta de nuevo.';
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
