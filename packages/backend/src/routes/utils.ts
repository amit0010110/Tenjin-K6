import { prisma } from '../lib/prisma.js';

export async function extractCsvFiles(scriptContent: string): Promise<{ name: string; filename: string; content: string }[]> {
  const dataRefs = scriptContent.match(/open\('\.\/data\/([a-f0-9-]+)\.csv'\)/g);
  if (!dataRefs) return [];
  const fileIds = [...new Set(dataRefs.map(r => r.match(/data\/([a-f0-9-]+)\.csv/)?.[1]).filter((id): id is string => !!id))];
  const csvRecords = await prisma.csvFile.findMany({ where: { id: { in: fileIds } } });
  return csvRecords.map(csv => ({ name: csv.name, filename: `data/${csv.id}.csv`, content: csv.content }));
}