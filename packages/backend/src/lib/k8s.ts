import { logger } from './logger.js';

interface K8sConfig {
  namespace: string;
  image: string;
  imagePullPolicy: string;
  kubeconfigContext?: string;
}

interface WorkerPodInfo {
  podName: string;
  namespace: string;
}

export class K8sManager {
  private kc: any = null;
  private coreV1: any = null;
  private batchV1: any = null;
  private initialized = false;

  async init(config?: K8sConfig): Promise<void> {
    if (this.initialized) return;

    try {
      const k8s = await import('@kubernetes/client-node');
      this.kc = new k8s.KubeConfig();

      if (config?.kubeconfigContext) {
        this.kc.loadFromOptions({
          clusters: [{ name: 'cluster', server: '' }],
          users: [{ name: 'user' }],
          contexts: [{ name: 'context', cluster: 'cluster', user: 'user' }],
          currentContext: 'context',
        });
        // Load from default kubeconfig but use specified context
        this.kc.loadFromDefault();
        this.kc.setCurrentContext(config.kubeconfigContext);
      } else {
        this.kc.loadFromDefault();
      }

      this.coreV1 = this.kc.makeApiClient(k8s.CoreV1Api);
      this.batchV1 = this.kc.makeApiClient(k8s.BatchV1Api);
      this.initialized = true;
      logger.info('Kubernetes client initialized');
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize Kubernetes client — K8s features disabled');
    }
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  async launchWorker(
    workerName: string,
    port: number,
    centralApiUrl: string,
    config: K8sConfig,
  ): Promise<WorkerPodInfo> {
    if (!this.initialized) throw new Error('Kubernetes client not initialized');

    const ns = config.namespace || 'default';
    const image = config.image || 'tenjint6/worker-agent:latest';
    const podName = `worker-${workerName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

    // Delete existing pod with same name if it exists
    try {
      await this.coreV1.deleteNamespacedPod(podName, ns);
      // Wait for deletion
      await new Promise((r) => setTimeout(r, 3000));
    } catch { /* pod didn't exist */ }

    const podManifest = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: podName,
        labels: {
          app: 'tenjint6-worker',
          worker: workerName,
        },
      },
      spec: {
        restartPolicy: 'OnFailure',
        containers: [
          {
            name: 'worker-agent',
            image,
            imagePullPolicy: config.imagePullPolicy || 'Always',
            ports: [{ containerPort: port, name: 'agent' }],
            env: [
              { name: 'AGENT_NAME', value: workerName },
              { name: 'AGENT_PORT', value: String(port) },
              { name: 'CENTRAL_API_URL', value: centralApiUrl },
            ],
          },
        ],
      },
    };

    await this.coreV1.createNamespacedPod(ns, podManifest);
    logger.info({ podName, namespace: ns, worker: workerName }, 'K8s worker pod created');

    return { podName, namespace: ns };
  }

  async stopWorker(workerName: string, namespace: string): Promise<void> {
    if (!this.initialized) return;

    const podName = `worker-${workerName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    try {
      await this.coreV1.deleteNamespacedPod(podName, namespace);
      logger.info({ podName, namespace }, 'K8s worker pod deleted');
    } catch (err: any) {
      logger.warn({ err, podName }, 'Failed to delete K8s worker pod (may not exist)');
    }
  }

  async getPodStatus(workerName: string, namespace: string): Promise<string | null> {
    if (!this.initialized) return null;

    const podName = `worker-${workerName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    try {
      const res = await this.coreV1.readNamespacedPod(podName, namespace);
      return res.body?.status?.phase || null;
    } catch {
      return null;
    }
  }

  async listWorkerPods(namespace: string): Promise<any[]> {
    if (!this.initialized) return [];

    try {
      const res = await this.coreV1.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, 'app=tenjint6-worker');
      return res.body?.items || [];
    } catch {
      return [];
    }
  }
}

export const k8sManager = new K8sManager();
