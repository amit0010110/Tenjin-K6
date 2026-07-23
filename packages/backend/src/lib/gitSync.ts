import path from 'path';
import os from 'os';
import fs from 'fs';
import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { simpleGit } from 'simple-git';

export async function pushScriptToGit(scriptId: string): Promise<string | null> {
  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    include: { project: { include: { gitRepos: true } } },
  });
  if (!script) return 'Script not found';

  for (const repo of script.project.gitRepos) {
    const error = await pushToRepo(repo, script);
    if (error) logger.error({ error, repoId: repo.id }, 'Git push failed');
  }
  return null;
}

export async function pullScriptsFromGit(projectId: string): Promise<string | null> {
  const repos = await prisma.gitRepo.findMany({ where: { projectId } });
  if (repos.length === 0) return 'No git repos configured';

  for (const repo of repos) {
    const error = await pullFromRepo(repo, projectId);
    if (error) {
      logger.error({ error, repoId: repo.id }, 'Git pull failed');
      return error;
    }
  }
  return null;
}

async function pushToRepo(repo: any, script: any): Promise<string | null> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-push-'));
  try {
    const git = simpleGit(workDir);
    const repoUrl = repo.authToken
      ? repo.repoUrl.replace('https://', `https://${repo.authToken}@`)
      : repo.repoUrl;

    await git.clone(repoUrl, workDir, ['--branch', repo.branch, '--single-branch', '--depth', '1']);

    const scriptsDir = path.join(workDir, 'scripts');
    if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true });

    const filePath = path.join(scriptsDir, `${script.name.replace(/\s+/g, '_')}.js`);
    fs.writeFileSync(filePath, script.content, 'utf-8');

    await git.add('.');
    const status = await git.status();
    if (status.staged.length === 0 && status.modified.length === 0) return null;

    await git.commit(`Update script: ${script.name}`);
    await git.push('origin', repo.branch);

    await prisma.gitRepo.update({
      where: { id: repo.id },
      data: { lastSyncedAt: new Date() },
    });

    logger.info({ repoId: repo.id, scriptId: script.id }, 'Script pushed to git');
    return null;
  } catch (err: any) {
    return err.message || 'Git push failed';
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function pullFromRepo(repo: any, projectId: string): Promise<string | null> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-pull-'));
  try {
    const git = simpleGit(workDir);
    const repoUrl = repo.authToken
      ? repo.repoUrl.replace('https://', `https://${repo.authToken}@`)
      : repo.repoUrl;

    await git.clone(repoUrl, workDir, ['--branch', repo.branch, '--single-branch', '--depth', '1']);

    const scriptsDir = path.join(workDir, 'scripts');
    if (!fs.existsSync(scriptsDir)) return null;

    const files = fs.readdirSync(scriptsDir).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(scriptsDir, file), 'utf-8');
      const name = file.replace('.js', '').replace(/_/g, ' ');

      const existing = await prisma.script.findFirst({
        where: { projectId, name },
        orderBy: { version: 'desc' },
      });

      if (existing) {
        if (existing.content !== content) {
          await prisma.script.create({
            data: {
              projectId,
              name,
              content,
              version: existing.version + 1,
            },
          });
        }
      } else {
        await prisma.script.create({
          data: { projectId, name, content },
        });
      }
    }

    await prisma.gitRepo.update({
      where: { id: repo.id },
      data: { lastSyncedAt: new Date() },
    });

    logger.info({ repoId: repo.id, files: files.length }, 'Scripts pulled from git');
    return null;
  } catch (err: any) {
    return err.message || 'Git pull failed';
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
