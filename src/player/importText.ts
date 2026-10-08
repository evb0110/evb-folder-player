import type { IImport } from './types';

function archiveNote(job: IImport) {
  if (job.archive === 'deleted') return 'The archive was deleted.';
  if (job.source === 'telegram') {
    return 'Telegram keeps its own copy of the archive. Clear it in Telegram under Settings › Data and Storage › Storage Usage.';
  }
  if (job.source === 'downloads') return 'The downloaded archive is still in Downloads. You can delete it there.';
  return 'The original archive was kept. Delete it in the app you opened it from.';
}

/** Banner wording for each import state. */
export function importSummary(job: IImport) {
  switch (job.state) {
    case 'running': {
      const progress = job.progress ?? -1;
      return {
        title: `Importing ${job.name}`,
        text: progress >= 0 ? `${Math.round(progress * 100)}% unpacked` : 'Unpacking…',
      };
    }
    case 'done':
      return {
        title: `${job.folder} added`,
        text: `Saved in ${job.destination}. ${archiveNote(job)}`,
      };
    case 'failed':
      return { title: `Could not import ${job.name}`, text: job.message || 'The archive could not be imported.' };
    case 'cancelled':
      return { title: 'Import cancelled', text: `${job.name} was not added. Nothing was saved.` };
  }
}
