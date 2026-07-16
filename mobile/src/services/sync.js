import { chargerScansEnAttente, marquerToutSynchronise } from './stockage';
import { api } from './api';

// Synchronise les scans en attente. Retourne le nombre de scans synchronisés.
export async function synchroniserScansEnAttente() {
  const pending = await chargerScansEnAttente();
  if (pending.length === 0) return 0;
  await api.synchroniserScans(pending);
  await marquerToutSynchronise();
  return pending.length;
}
