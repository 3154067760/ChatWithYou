/**
 * 使用 Edge 语音合成下载拼音参考音（需联网）
 * 运行: npm run generate:audio
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { collectAudioTasks } from '../client/src/data/pinyin.ts';
import { collectStoryAudioTasks } from '../client/src/data/stories.ts';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'client', 'public', 'audio');
const VOICE = 'zh-CN-XiaoyiNeural';

async function ensureEdgeTts(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('python', ['-m', 'edge_tts', '--version'], {
      windowsHide: true,
    });
    console.log('edge-tts', stdout.trim());
    return 'python';
  } catch {
    try {
      await execFileAsync('edge-tts', ['--version'], { windowsHide: true });
      return 'edge-tts';
    } catch {
      console.log('正在安装 edge-tts (pip)...');
      await execFileAsync('python', ['-m', 'pip', 'install', 'edge-tts'], { windowsHide: true });
      return 'python';
    }
  }
}

async function synthesize(runner: string, text: string, file: string) {
  if (fs.existsSync(file)) {
    return 'skip';
  }
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });

  if (runner === 'python') {
    await execFileAsync(
      'python',
      ['-m', 'edge_tts', '--voice', VOICE, '--text', text, '--write-media', file],
      { windowsHide: true, timeout: 60000 }
    );
  } else {
    await execFileAsync(
      'edge-tts',
      ['--voice', VOICE, '--text', text, '--write-media', file],
      { windowsHide: true, timeout: 60000 }
    );
  }
  return 'ok';
}

async function main() {
  const runner = await ensureEdgeTts();
  const tasks = [...collectAudioTasks(), ...collectStoryAudioTasks()];
  console.log(`共 ${tasks.length} 个音频，输出目录: ${outDir}`);

  let ok = 0;
  let skip = 0;
  for (const task of tasks) {
    const file = path.join(outDir, task.outFile);
    process.stdout.write(`${task.outFile} (${task.text}) ... `);
    try {
      const status = await synthesize(runner, task.text, file);
      if (status === 'skip') {
        skip++;
        console.log('已存在');
      } else {
        ok++;
        console.log('完成');
      }
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      console.log('失败', e);
    }
  }
  console.log(`\n新建 ${ok}，跳过 ${skip}，总计 ${tasks.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
