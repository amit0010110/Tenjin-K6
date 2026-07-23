import type { BlockTypeDefinition, BlockType } from '../types';

export const ftp: Partial<Record<BlockType, BlockTypeDefinition>> = {
  'ftp': {
    type: 'ftp',
    label: 'FTP / SFTP',
    icon: 'FolderSync',
    description: 'Upload, download, or list files over FTP/SFTP using xk6-ftp',
    color: 'sky',
    canHaveChildren: true,
    defaultProperties: {
      operation: 'upload',
      protocol: 'ftp',
      host: 'ftp.example.com',
      port: '21',
      username: 'anonymous',
      password: '',
      remotePath: '/pub/loadtest.txt',
      localContent: 'Hello from k6 FTP load test payload!',
    },
    fields: [
      {
        key: 'operation', label: 'Operation', type: 'select', required: true,
        options: [
          { label: 'Upload File (PUT)', value: 'upload' },
          { label: 'Download File (GET)', value: 'download' },
          { label: 'List Directory (LIST)', value: 'list' },
        ],
      },
      {
        key: 'protocol', label: 'Protocol', type: 'select', required: true,
        options: [
          { label: 'FTP (Standard - Port 21)', value: 'ftp' },
          { label: 'SFTP (SSH Secure - Port 22)', value: 'sftp' },
        ],
      },
      { key: 'host', label: 'Server Host', type: 'string', placeholder: 'ftp.example.com', required: true, defaultValue: 'ftp.example.com' },
      { key: 'port', label: 'Server Port', type: 'string', placeholder: '21', defaultValue: '21' },
      { key: 'username', label: 'Username', type: 'string', placeholder: 'anonymous', defaultValue: 'anonymous' },
      { key: 'password', label: 'Password', type: 'string', placeholder: 'Optional password', defaultValue: '' },
      { key: 'remotePath', label: 'Remote File or Directory Path', type: 'string', placeholder: '/pub/loadtest.txt', required: true, defaultValue: '/pub/loadtest.txt' },
      { key: 'localContent', label: 'Upload Content / Data Payload', type: 'code', placeholder: 'File payload to upload...', defaultValue: 'Hello from k6 FTP load test payload!', showIf: { key: 'operation', value: 'upload' } },
    ],
  },
};
