import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const outputProfilesRouter = Router({ mergeParams: true });

// Get all output profiles for a project
outputProfilesRouter.get('/projects/:projectId/output-profiles', async (req, res) => {
  try {
    const { projectId } = req.params;
    const profiles = await prisma.outputProfile.findMany({
      where: { projectId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(profiles);
  } catch (err: any) {
    console.error('Error fetching output profiles:', err);
    res.status(500).json({ message: 'Failed to fetch output profiles' });
  }
});

// Create a new output profile
outputProfilesRouter.post('/projects/:projectId/output-profiles', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, outputType, configJson, isDefault } = req.body;

    if (!name || !outputType) {
      return res.status(400).json({ message: 'Name and outputType are required' });
    }

    if (isDefault) {
      await prisma.outputProfile.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const profile = await prisma.outputProfile.create({
      data: {
        projectId,
        name,
        outputType,
        configJson: typeof configJson === 'string' ? configJson : JSON.stringify(configJson || {}),
        isDefault: !!isDefault,
      },
    });

    res.status(201).json(profile);
  } catch (err: any) {
    console.error('Error creating output profile:', err);
    res.status(500).json({ message: 'Failed to create output profile' });
  }
});

// Get a single output profile by ID
outputProfilesRouter.get('/output-profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await prisma.outputProfile.findUnique({
      where: { id },
    });
    if (!profile) {
      return res.status(404).json({ message: 'Output profile not found' });
    }
    res.json(profile);
  } catch (err: any) {
    console.error('Error fetching output profile:', err);
    res.status(500).json({ message: 'Failed to fetch output profile' });
  }
});

// Update an output profile
outputProfilesRouter.put('/output-profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, outputType, configJson, isDefault } = req.body;

    const existing = await prisma.outputProfile.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Output profile not found' });
    }

    if (isDefault) {
      await prisma.outputProfile.updateMany({
        where: { projectId: existing.projectId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.outputProfile.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(outputType !== undefined && { outputType }),
        ...(configJson !== undefined && {
          configJson: typeof configJson === 'string' ? configJson : JSON.stringify(configJson || {}),
        }),
        ...(isDefault !== undefined && { isDefault: !!isDefault }),
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error('Error updating output profile:', err);
    res.status(500).json({ message: 'Failed to update output profile' });
  }
});

// Delete an output profile
outputProfilesRouter.delete('/output-profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.outputProfile.delete({
      where: { id },
    });
    res.json({ message: 'Output profile deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting output profile:', err);
    res.status(500).json({ message: 'Failed to delete output profile' });
  }
});

// Test connection for an output profile
outputProfilesRouter.post('/output-profiles/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await prisma.outputProfile.findUnique({ where: { id } });
    if (!profile) {
      return res.status(404).json({ message: 'Output profile not found' });
    }

    let parsedConfig: Record<string, string> = {};
    try {
      parsedConfig = JSON.parse(profile.configJson);
    } catch {
      return res.status(400).json({ status: 'failed', message: 'Invalid JSON configuration in output profile.' });
    }

    if (profile.outputType === 'influxdb' || profile.outputType === 'influxdb-v2') {
      const url = parsedConfig.url || parsedConfig.host;
      if (!url) {
        return res.json({ status: 'failed', message: 'Missing InfluxDB URL in profile configuration.' });
      }
      try {
        const pingUrl = url.replace(/\/+$/, '') + '/ping';
        const pingRes = await fetch(pingUrl, {
          method: 'GET',
          headers: parsedConfig.token ? { Authorization: `Token ${parsedConfig.token}` } : {},
          signal: AbortSignal.timeout(5000),
        });
        if (pingRes.ok || pingRes.status === 204) {
          return res.json({ status: 'success', message: `Connected to InfluxDB at ${url} successfully!` });
        }
        return res.json({ status: 'failed', message: `InfluxDB responded with HTTP ${pingRes.status}` });
      } catch (err: any) {
        return res.json({ status: 'failed', message: `Failed to connect to InfluxDB at ${url}: ${err.message || err}` });
      }
    } else if (profile.outputType === 'elasticsearch') {
      const url = parsedConfig.url;
      if (!url) {
        return res.json({ status: 'failed', message: 'Missing Elasticsearch URL.' });
      }
      try {
        const pingRes = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (pingRes.ok) {
          return res.json({ status: 'success', message: `Connected to Elasticsearch node successfully!` });
        }
        return res.json({ status: 'failed', message: `Elasticsearch responded with HTTP ${pingRes.status}` });
      } catch (err: any) {
        return res.json({ status: 'failed', message: `Failed to connect to Elasticsearch: ${err.message || err}` });
      }
    }

    // Default test response for other protocols
    res.json({ status: 'success', message: `Profile syntax validated (${profile.outputType}). Ready for test runs!` });
  } catch (err: any) {
    console.error('Error testing output profile:', err);
    res.status(500).json({ status: 'failed', message: 'Failed to test connection' });
  }
});
