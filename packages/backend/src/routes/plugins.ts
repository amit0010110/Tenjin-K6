import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export const pluginRoutes = Router();

pluginRoutes.get('/projects/:pid/plugins', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const plugins = await prisma.plugin.findMany({ where: { projectId: pid }, orderBy: { installedAt: 'desc' } });
  res.json(plugins);
});

pluginRoutes.post('/projects/:pid/plugins', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const { name, description, repoUrl, version } = req.body;
  const plugin = await prisma.plugin.create({
    data: { projectId: pid, name, description, repoUrl, version: version || 'latest', enabled: true },
  });
  res.status(201).json(plugin);
});

pluginRoutes.patch('/plugins/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const plugin = await prisma.plugin.update({ where: { id }, data: req.body });
  res.json(plugin);
});

pluginRoutes.delete('/plugins/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.plugin.delete({ where: { id } });
  res.json({ message: 'Plugin removed' });
});

pluginRoutes.post('/projects/:pid/plugins/build', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  try {
    const enabledPlugins = await prisma.plugin.findMany({ where: { projectId: pid, enabled: true } });
    if (enabledPlugins.length === 0) {
      res.status(400).json({ error: 'No enabled plugins to build with' }); return;
    }

    const cwd = process.cwd();
    const rootDir = cwd.includes('/packages/') ? cwd.substring(0, cwd.indexOf('/packages/')) : cwd;
    const buildDir = join(rootDir, '.k6-build');
    if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true });

    const binaryName = `k6-${pid.slice(0, 8)}`;
    const binaryPath = join(buildDir, binaryName);

    // Go module paths cannot contain https:// or .git prefix/suffix
    const cleanModulePath = (url: string) => url.replace(/^(https?|git):\/\//, '').replace(/\.git$/, '').trim();

    const withFlags = enabledPlugins
      .map(p => `--with ${cleanModulePath(p.repoUrl)}${p.version && p.version !== 'latest' ? `@${p.version}` : ''}`)
      .join(' ');

    // Resolve xk6 binary from environment or GOPATH/bin
    let xk6Bin = process.env.XK6_BINARY_PATH || 'xk6';
    if (xk6Bin === 'xk6') {
      const goPath = process.env.GOPATH || join(process.env.HOME || '', 'go');
      const xk6InGo = join(goPath, 'bin', 'xk6');
      if (existsSync(xk6InGo)) xk6Bin = xk6InGo;
    }

    const goPath = process.env.GOPATH || join(process.env.HOME || '', 'go');
    const goBinPath = join(goPath, 'bin');
    const augmentedPath = [goBinPath, '/usr/local/bin', '/usr/bin', '/bin', process.env.PATH].filter(Boolean).join(':');

    const cmd = `"${xk6Bin}" build ${withFlags} --output "${binaryPath}"`;

    execSync(cmd, {
      cwd: buildDir,
      stdio: 'pipe',
      timeout: 300000,
      env: {
        ...process.env,
        PATH: augmentedPath,
        GOPATH: goPath,
      },
    });

    res.json({ binaryPath, binaryName, plugins: enabledPlugins.length, status: 'built' });
  } catch (err: any) {
    let output = err?.stderr?.toString() || err?.stdout?.toString() || err?.message || String(err);
    if (output.includes('exit status 128') || output.includes('could not read Username') || output.includes('404')) {
      output = `Extension repository not found or archived (${output.split('\n').find((l: string) => l.includes('require ') || l.includes('fatal:') || l.includes('404')) || 'Git clone failed'}). Note: Obsolete plugins like xk6-output-prometheus and xk6-crypto have been merged into core k6 and should be deleted from installed plugins.`;
    } else if (output.includes('ERR resolving dependency') || output.includes('exit status 1')) {
      output = `Extension version incompatibility between selected plugins (Go module conflict between k6 v1.x modules like xk6-output-influxdb/xk6-output-timescaledb and k6 v2.x modules like xk6-sql/xk6-output-elasticsearch). Please disable incompatible or unused plugins in the list below and build only the extensions required by your current test script. Details: ${output.split('\n').find((l: string) => l.includes('ERR') || l.includes('exit status 1')) || output}`;
    }
    res.status(500).json({ error: `Build failed: ${output}` });
  }
});
