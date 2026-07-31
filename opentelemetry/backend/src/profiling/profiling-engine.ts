import type { FlamegraphNode, ProfileDiffFunction, ProfileDiffReport } from '@telemetry/types';
import type { ProfileRecord, Repositories } from '../repositories/interfaces';

export class ProfilingEngine {
  constructor(private repos: Repositories) {}

  /**
   * Converte um texto no formato "collapsed stack traces" (ex: "root;service;fn 100") em uma árvore FlamegraphNode
   */
  parseCollapsedStacks(collapsedText: string, rootName = 'root'): FlamegraphNode {
    const root: FlamegraphNode = { name: rootName, value: 0, children: [] };
    const lines = collapsedText.trim().split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const spaceIndex = trimmed.lastIndexOf(' ');
      if (spaceIndex === -1) continue;

      const stackStr = trimmed.substring(0, spaceIndex);
      const count = Number.parseInt(trimmed.substring(spaceIndex + 1), 10) || 0;

      if (count <= 0) continue;

      root.value += count;
      const frames = stackStr.split(';');

      let currentNode = root;
      for (const frameName of frames) {
        if (!frameName) continue;
        if (!currentNode.children) currentNode.children = [];

        let childNode = currentNode.children.find((c) => c.name === frameName);
        if (!childNode) {
          childNode = { name: frameName, value: 0, children: [] };
          currentNode.children.push(childNode);
        }

        childNode.value += count;
        currentNode = childNode;
      }
    }

    return root;
  }

  /**
   * Ingesta e persiste um novo perfil no repositório
   */
  async ingestProfile(profile: ProfileRecord): Promise<void> {
    await this.repos.profiles.insertProfile(profile);
  }

  /**
   * Obtém a árvore de Flamegraph parseada de um perfil existente
   */
  async getFlamegraphTree(profileId: string): Promise<FlamegraphNode | null> {
    const profile = await this.repos.profiles.getFlamegraph(profileId);
    if (!profile) return null;

    try {
      if (profile.flamegraphDataJson.startsWith('{')) {
        return JSON.parse(profile.flamegraphDataJson) as FlamegraphNode;
      }
      return this.parseCollapsedStacks(profile.flamegraphDataJson, profile.serviceName);
    } catch {
      return this.parseCollapsedStacks(profile.flamegraphDataJson, profile.serviceName);
    }
  }
}

export class FlamegraphDiffEngine {
  /**
   * Compara dois perfis (Perfil A vs Perfil B) e identifica regressões e melhorias estatísticas
   */
  compareProfiles(
    profileA: ProfileRecord,
    profileB: ProfileRecord,
    treeA: FlamegraphNode,
    treeB: FlamegraphNode,
  ): ProfileDiffReport {
    const mapA = new Map<string, number>();
    const mapB = new Map<string, number>();

    const flatten = (node: FlamegraphNode, map: Map<string, number>) => {
      map.set(node.name, (map.get(node.name) || 0) + node.value);
      if (node.children) {
        for (const child of node.children) {
          flatten(child, map);
        }
      }
    };

    flatten(treeA, mapA);
    flatten(treeB, mapB);

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
    const regressedFunctions: ProfileDiffFunction[] = [];
    const improvedFunctions: ProfileDiffFunction[] = [];

    for (const name of allKeys) {
      if (name === treeA.name || name === treeB.name) continue;

      const valA = mapA.get(name) || 0;
      const valB = mapB.get(name) || 0;
      const deltaMs = valB - valA;
      const deltaPercent = valA === 0 ? (valB > 0 ? 100 : 0) : Math.round((deltaMs / valA) * 100);

      if (deltaMs > 0) {
        regressedFunctions.push({ name, valueA: valA, valueB: valB, deltaMs, deltaPercent });
      } else if (deltaMs < 0) {
        improvedFunctions.push({
          name,
          valueA: valA,
          valueB: valB,
          deltaMs,
          deltaPercent: Math.abs(deltaPercent),
        });
      }
    }

    regressedFunctions.sort((a, b) => b.deltaMs - a.deltaMs);
    improvedFunctions.sort((a, b) => a.deltaMs - b.deltaMs);

    const totalDeltaMs = profileB.durationMs - profileA.durationMs;
    const totalDeltaPercent =
      profileA.durationMs === 0
        ? 0
        : Math.round(((profileB.durationMs - profileA.durationMs) / profileA.durationMs) * 100);

    return {
      profileAId: profileA.id,
      profileBId: profileB.id,
      serviceName: profileA.serviceName,
      profileType: profileA.profileType,
      totalDeltaMs,
      totalDeltaPercent,
      regressedFunctions,
      improvedFunctions,
    };
  }
}
