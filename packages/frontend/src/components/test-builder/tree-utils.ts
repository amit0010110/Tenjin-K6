import { TestBlock, BlockType, BLOCK_REGISTRY, createBlock, SAMPLER_TYPES, POST_PROCESSOR_TYPES } from '../../lib/test-builder/types';

export function findBlock(list: TestBlock[], id: string): TestBlock | undefined {
  for (const b of list) {
    if (b.id === id) return b;
    if (b.children.length > 0) {
      const found = findBlock(b.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function findParent(list: TestBlock[], id: string): TestBlock | undefined {
  for (const b of list) {
    if (b.children.some(c => c.id === id)) return b;
    if (b.children.length > 0) {
      const found = findParent(b.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function findAndUpdate(list: TestBlock[], id: string, updater: (b: TestBlock) => TestBlock): TestBlock[] {
  return list.map(b => {
    if (b.id === id) return updater(b);
    if (b.children.length > 0) return { ...b, children: findAndUpdate(b.children, id, updater) };
    return b;
  });
}

export function findAndDelete(list: TestBlock[], id: string): TestBlock[] {
  return list.filter(b => {
    if (b.id === id) return false;
    if (b.children.length > 0) b.children = findAndDelete(b.children, id);
    return true;
  });
}

export function moveBlockById(list: TestBlock[], id: string, direction: 'up' | 'down'): TestBlock[] {
  const idx = list.findIndex(b => b.id === id);
  if (idx >= 0) {
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return list;
    const result = [...list];
    const temp = result[idx];
    result[idx] = result[swapIdx];
    result[swapIdx] = temp;
    return result;
  }
  return list.map(b => ({
    ...b,
    children: b.children.length > 0 ? moveBlockById(b.children, id, direction) : b.children,
  }));
}

export function unwrapBlock(list: TestBlock[], id: string): TestBlock[] {
  const idx = list.findIndex(b => b.id === id);
  if (idx >= 0) {
    const block = list[idx];
    const children = block.children.map(c => JSON.parse(JSON.stringify(c)));
    return [...list.slice(0, idx), ...children, ...list.slice(idx + 1)];
  }
  return list.map(b => ({
    ...b,
    children: b.children.length > 0 ? unwrapBlock(b.children, id) : b.children,
  }));
}

export function insertInList(list: TestBlock[], targetId: string, newBlock: TestBlock, offset: number): TestBlock[] {
  const idx = list.findIndex(b => b.id === targetId);
  if (idx >= 0) {
    const result = [...list];
    result.splice(idx + offset, 0, newBlock);
    return result;
  }
  return list.map(b => ({
    ...b,
    children: b.children.length > 0 ? insertInList(b.children, targetId, newBlock, offset) : b.children,
  }));
}

export function addChildToList(list: TestBlock[], targetId: string, newBlock: TestBlock): TestBlock[] {
  return list.map(b => {
    if (b.id === targetId) return { ...b, children: [...b.children, newBlock] };
    if (b.children.length > 0) return { ...b, children: addChildToList(b.children, targetId, newBlock) };
    return b;
  });
}

export function dupBlock(list: TestBlock[], id: string): TestBlock[] {
  const idx = list.findIndex(b => b.id === id);
  if (idx >= 0) {
    const dup = JSON.parse(JSON.stringify(list[idx]));
    dup.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    dup.label = dup.label + ' (copy)';
    const result = [...list];
    result.splice(idx + 1, 0, dup);
    return result;
  }
  return list.map(b => {
    if (b.children.length > 0) return { ...b, children: dupBlock(b.children, id) };
    return b;
  });
}

export function wrapFromHere(list: TestBlock[], targetId: string, parentType: BlockType): TestBlock[] {
  const idx = list.findIndex(b => b.id === targetId);
  if (idx >= 0) {
    const children = list.slice(idx);
    const parent = createBlock(parentType);
    parent.children = children.map(c => JSON.parse(JSON.stringify(c)));
    return [...list.slice(0, idx), parent];
  }
  return list.map(b => ({
    ...b,
    children: b.children.length > 0 ? wrapFromHere(b.children, targetId, parentType) : b.children,
  }));
}

export function wrapAllInRoot(list: TestBlock[], parentType: BlockType): TestBlock[] {
  if (list.length === 0) return list;
  const parent = createBlock(parentType);
  parent.children = list.map(c => JSON.parse(JSON.stringify(c)));
  return [parent];
}

export function isInsideSampler(list: TestBlock[], blockId: string): boolean {
  const walk = (items: TestBlock[]): boolean => items.some(b =>
    b.children.some(c => c.id === blockId) ? SAMPLER_TYPES.has(b.type) :
    b.children.length > 0 ? walk(b.children) : false
  );
  return walk(list);
}

export function filterChildTypes(t: { type: BlockType; label: string }, allowRootOnly: boolean, restrictTo: 'any' | 'post-processor'): boolean {
  if (!allowRootOnly && BLOCK_REGISTRY[t.type]?.rootOnly) return false;
  if (restrictTo === 'post-processor' && !POST_PROCESSOR_TYPES.has(t.type)) return false;
  return true;
}

export function addToContainer(list: TestBlock[], containerId: string, newBlock: TestBlock): TestBlock[] {
  return list.map(b => {
    if (b.id === containerId) return { ...b, children: [...b.children, newBlock] };
    if (b.children.length > 0) return { ...b, children: addToContainer(b.children, containerId, newBlock) };
    return b;
  });
}
