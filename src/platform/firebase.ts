// Firebase (Auth + Firestore) access. The SDK is loaded lazily and only when configured,
// so builds without Firebase env vars stay small and hide every account feature.
import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { isNative } from './native';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};
const useEmulator = env.VITE_FIREBASE_EMULATOR === 'true';

export const firebaseConfigured = !!(config.apiKey && config.projectId && config.appId && config.authDomain);

export interface CloudUser {
  uid: string;
  email: string | null;
  name: string | null;
}

export interface CloudSave {
  data: string; // JSON string of GameState (album images stripped)
  clientUpdatedAt: number;
  device: string;
  version: number;
  summary: { playerLevel: number; cafeLevel: number; gold: number; days: number };
}

let ready: Promise<{ app: FirebaseApp; auth: Auth; db: Firestore }> | null = null;

function load() {
  if (!firebaseConfigured) return Promise.reject(new Error('firebase not configured'));
  ready ??= (async () => {
    const [{ initializeApp }, authMod, fsMod] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    const app = initializeApp(config as Record<string, string>);
    // In the Android WebView the default (popup/redirect) resolver is not usable; native sign-in hands us a credential.
    const auth = isNative ? authMod.initializeAuth(app, { persistence: authMod.indexedDBLocalPersistence }) : authMod.getAuth(app);
    const db = fsMod.getFirestore(app);
    if (useEmulator) {
      authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      fsMod.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    return { app, auth, db };
  })();
  return ready;
}

/** Warm up the SDK so a later click can open the Google popup without losing the user gesture. */
export function preloadFirebase() {
  if (!firebaseConfigured) return;
  load()
    .then(() => import('firebase/auth'))
    .catch(() => {});
}

const toUser = (u: User | null): CloudUser | null => (u ? { uid: u.uid, email: u.email, name: u.displayName } : null);

export async function onUserChanged(cb: (u: CloudUser | null) => void) {
  const { auth } = await load();
  const { onAuthStateChanged } = await import('firebase/auth');
  onAuthStateChanged(auth, (u) => cb(toUser(u)));
}

export async function signInWithGoogle(): Promise<CloudUser> {
  const { auth } = await load();
  const a = await import('firebase/auth');
  if (isNative) {
    // Native Google account picker, then hand the ID token to the JS SDK.
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const r = await FirebaseAuthentication.signInWithGoogle();
    const idToken = r.credential?.idToken;
    if (!idToken) throw new Error('Google 로그인 토큰을 받지 못했어요');
    const cred = a.GoogleAuthProvider.credential(idToken);
    return toUser((await a.signInWithCredential(auth, cred)).user)!;
  }
  const provider = new a.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return toUser((await a.signInWithPopup(auth, provider)).user)!;
}

/** Test-only: sign in against the Auth emulator with a fake Google identity. */
export async function signInEmulatorGoogle(sub: string, email: string): Promise<CloudUser> {
  if (!useEmulator) throw new Error('emulator only');
  const { auth } = await load();
  const a = await import('firebase/auth');
  const cred = a.GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true }));
  return toUser((await a.signInWithCredential(auth, cred)).user)!;
}

export async function signOutUser() {
  const { auth } = await load();
  const a = await import('firebase/auth');
  if (isNative) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await FirebaseAuthentication.signOut();
    } catch {
      /* native session may already be gone */
    }
  }
  await a.signOut(auth);
}

function saveRef(db: Firestore, uid: string, fs: typeof import('firebase/firestore')) {
  return fs.doc(db, 'saves', uid);
}

export async function readCloudSave(uid: string): Promise<CloudSave | null> {
  const { db } = await load();
  const fs = await import('firebase/firestore');
  const snap = await fs.getDoc(saveRef(db, uid, fs));
  return snap.exists() ? (snap.data() as CloudSave) : null;
}

export async function writeCloudSave(uid: string, save: CloudSave) {
  const { db } = await load();
  const fs = await import('firebase/firestore');
  await fs.setDoc(saveRef(db, uid, fs), { ...save, updatedAt: fs.serverTimestamp() });
}

/**
 * Deletes the cloud save and the Firebase account. Firebase requires a recent login for deletion;
 * the caller re-authenticates and retries when this throws 'auth/requires-recent-login'.
 */
export async function deleteAccount() {
  const { auth, db } = await load();
  const fs = await import('firebase/firestore');
  const a = await import('firebase/auth');
  const u = auth.currentUser;
  if (!u) throw new Error('로그인 상태가 아니에요');
  await fs.deleteDoc(saveRef(db, u.uid, fs));
  await a.deleteUser(u);
  if (isNative) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await FirebaseAuthentication.signOut();
    } catch {
      /* ignore */
    }
  }
}

/** Test-only (emulator): attempt a raw write to any document, returning the error code or 'ok'. */
export async function emulatorRawWrite(path: string, data: Record<string, unknown>): Promise<string> {
  if (!useEmulator) throw new Error('emulator only');
  const { db } = await load();
  const fs = await import('firebase/firestore');
  try {
    await fs.setDoc(fs.doc(db, path), data);
    return 'ok';
  } catch (e: any) {
    return e?.code ?? String(e);
  }
}
