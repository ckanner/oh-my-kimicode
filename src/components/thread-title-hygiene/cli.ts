import { writeHookOutput } from '../../shared/serialize.js';

export function runThreadTitleHygiene(): void {
  writeHookOutput({
    message: 'Thread created. Use a descriptive, task-specific thread title so future sessions can identify this work.',
  });
}

if (process.argv[2] === 'hook' && process.argv[3] === 'post-tool-use') {
  runThreadTitleHygiene();
}
