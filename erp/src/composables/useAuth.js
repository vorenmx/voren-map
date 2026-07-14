import { ref, computed } from 'vue';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config.js';
import { isAllowedGoogleEmail } from '../auth/allowedGoogleEmails.js';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const user = ref(null);
const authLoading = ref(true);
const authError = ref(null);
const rol = ref(null); // 'admin' | 'gerente' | 'ventas' | 'lectura' | null

async function cargarRol(email) {
  const key = email.toLowerCase().trim();
  try {
    const snap = await getDoc(doc(db, 'empleados', key));
    if (snap.exists()) {
      rol.value = snap.data().rol ?? 'lectura';
    } else {
      // First seen: create a minimal empleado record with the lowest role.
      // An admin can elevate it afterwards from the Equipo module.
      await setDoc(
        doc(db, 'empleados', key),
        {
          email: key,
          nombre: user.value?.displayName ?? key,
          rol: 'lectura',
          activo: true,
          fechaIngreso: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
      rol.value = 'lectura';
    }
  } catch {
    rol.value = 'lectura';
  }
}

onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser && !isAllowedGoogleEmail(firebaseUser.email)) {
    authError.value = 'Esta cuenta no tiene acceso. Solo cuentas de Voren.';
    await firebaseSignOut(auth).catch(() => {});
    user.value = null;
    rol.value = null;
    authLoading.value = false;
    return;
  }
  user.value = firebaseUser;
  if (firebaseUser) {
    await cargarRol(firebaseUser.email);
  } else {
    rol.value = null;
  }
  authLoading.value = false;
});

async function signInWithGoogle() {
  authError.value = null;
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      authError.value = null;
    } else if (err.code === 'auth/popup-blocked') {
      authError.value = 'El navegador bloqueó la ventana emergente.';
    } else {
      authError.value = `No se pudo iniciar sesión: ${err?.code || 'error'}`;
    }
  }
}

async function signOut() {
  await firebaseSignOut(auth);
  user.value = null;
  rol.value = null;
}

export function useAuth() {
  const esAdminOGerente = computed(() => ['admin', 'gerente'].includes(rol.value));
  const esVentas = computed(() => ['admin', 'gerente', 'ventas'].includes(rol.value));
  const userDisplayName = computed(() => user.value?.displayName ?? user.value?.email ?? null);

  return {
    user,
    authLoading,
    authError,
    rol,
    esAdminOGerente,
    esVentas,
    userDisplayName,
    signInWithGoogle,
    signOut,
  };
}
