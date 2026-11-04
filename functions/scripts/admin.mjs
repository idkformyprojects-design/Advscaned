/** Admin SDK handle for scripts and the app e2e test (resolves firebase-admin from functions/). */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function adminDb(projectId = process.env.GCLOUD_PROJECT ?? 'demo-bazaar') {
  if (!getApps().length) initializeApp({ projectId });
  return getFirestore();
}
