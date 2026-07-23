import { TestBlock } from '../types';

export function genFtp(block: TestBlock, indent: number, ctx: any, genBlock: (b: TestBlock, i: number, c: any) => string): string {
  const pad = '  '.repeat(indent);
  const p = block.properties as Record<string, any>;
  const lines: string[] = [];
  const operation = p.operation || 'upload';
  const protocol = p.protocol || 'ftp';
  const host = p.host || 'ftp.example.com';
  const port = p.port || (protocol === 'sftp' ? '22' : '21');
  const user = p.username || 'anonymous';
  const password = p.password || '';
  const remotePath = p.remotePath || '/pub/loadtest.txt';
  const localContent = p.localContent || '';

  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');

  lines.push(`${pad}// FTP/SFTP Operation (${operation.toUpperCase()}) over ${protocol.toUpperCase()}`);
  lines.push(`${pad}var ftpClient = new ftp.Client({`);
  lines.push(`${pad}  host: '${host}',`);
  lines.push(`${pad}  port: ${parseInt(port, 10) || (protocol === 'sftp' ? 22 : 21)},`);
  lines.push(`${pad}  user: '${user}',`);
  if (password) lines.push(`${pad}  password: '${password}',`);
  lines.push(`${pad}});`);
  lines.push(`${pad}var startTime = Date.now();`);
  lines.push(`${pad}var status = 200;`);
  lines.push(`${pad}try {`);
  lines.push(`${pad}  ftpClient.connect();`);
  if (operation === 'upload') {
    lines.push(`${pad}  ftpClient.upload('${remotePath}', \`${esc(localContent)}\`);`);
  } else if (operation === 'download') {
    lines.push(`${pad}  var downloadedContent = ftpClient.download('${remotePath}');`);
  } else {
    lines.push(`${pad}  var fileList = ftpClient.list('${remotePath}');`);
  }
  lines.push(`${pad}} catch (err) {`);
  lines.push(`${pad}  status = 500;`);
  lines.push(`${pad}  console.error('FTP ${operation} failed: ' + err);`);
  lines.push(`${pad}} finally {`);
  lines.push(`${pad}  try { ftpClient.close(); } catch (e) {}`);
  lines.push(`${pad}}`);
  lines.push(`${pad}if (typeof __logRequest !== 'undefined') __logRequest("FTP-${operation.toUpperCase()}", '${host}:${port}${remotePath}', status, '${operation === 'upload' ? esc(localContent.slice(0, 100)) : ''}', '{}', Date.now() - startTime);`);

  for (const child of block.children.filter(c => c.enabled)) {
    const childCode = genBlock(child, indent + 1, ctx);
    if (childCode) lines.push(childCode);
  }
  return lines.join('\n');
}
