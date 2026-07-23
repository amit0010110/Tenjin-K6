import React, { useState } from 'react';
import { TestBlock, BlockType, BLOCK_REGISTRY, createBlock, SAMPLER_TYPES, POST_PROCESSOR_TYPES, validateBlock } from '../../lib/test-builder/types';
import { COLOR_MAP, getIcon, INDENT, PADDING_LEFT } from './tree-defs';
import { ChevronRight, AlertTriangle, MoveUp, MoveDown, ArrowUpFromLine, Copy, Trash2, Plus } from 'lucide-react';

interface TreeNodeProps {
  block: TestBlock;
  selectedId: string | null;
  depth: number;
  siblingIndex: number;
  siblingCount: number;
  onSelect: (id: string) => void;
  onUpdate: (updated: TestBlock) => void;
  onDelete: (id: string) => void;
  onUnwrap: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onAddToContainer: (containerId: string, type: BlockType) => void;
  onContextMenu: (e: React.MouseEvent, blockId: string) => void;
}

export default function TreeNode({
  block,
  selectedId,
  depth,
  siblingIndex,
  siblingCount,
  onSelect,
  onUpdate,
  onDelete,
  onUnwrap,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onAddToContainer,
  onContextMenu,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const def = BLOCK_REGISTRY[block.type];
  const Icon = getIcon(def?.icon || 'Box');
  const colorClass = COLOR_MAP[def?.color || 'gray'] || 'border-gray-300 bg-gray-50 dark:bg-gray-800';
  const canHaveChildren = def?.canHaveChildren || false;
  const isSelected = selectedId === block.id;
  const blockErrors = validateBlock(block);
  const hasErrors = blockErrors.length > 0;

  const labelPreview = (() => {
    const p = block.properties as Record<string, any>;
    if (block.type === 'http-request') return `${p.method || 'GET'} ${p.url || ''}`;
    if (block.type === 'group') return p.name || 'group';
    if (block.type === 'sleep') return `${p.duration || 1}s`;
    if (block.type === 'loop') return `${p.count || 1}x`;
    if (block.type === 'condition') return p.expression || '';
    if (block.type === 'check') return `${(p.checks || []).length} check(s)`;
    if (block.type === 'json-assertion') return p.jsonPath || '';
    if (block.type === 'header-manager') return `${(p.headers || []).length} header(s)`;
    if (block.type === 'cookie-manager') return `${(p.cookies || []).filter((c: any) => c.key).length} cookie(s)`;
    if (block.type === 'cache-manager') return p.mode === 'disabled' ? 'Caching disabled' : p.mode === 'force-reload' ? 'Force reload' : 'Caching default';
    if (block.type === 'synchronizing-timer') return `${p.vuCount || 5} VUs`;
    if (block.type === 'pre-processor' || block.type === 'post-processor') return `${(p.code || '').slice(0, 30)}`;
    if (block.type === 'dummy-sampler') return `→ ${p.statusCode || 200}`;
    if (block.type === 'scenario') return `${p.vus || 1} VUs, ${p.duration || '30s'}`;
    if (block.type === 'stages-scenario') return `${(p.stages || []).length} stages`;
    if (block.type === 'arrivals-scenario') return `${p.executor || 'constant-arrival-rate'}`;
    return '';
  })();

  const handleNodeClick = () => {
    onSelect(block.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dragType = e.dataTransfer.getData('block-type') as BlockType;
    if (!dragType || !canHaveChildren) return;
    const dragDef = BLOCK_REGISTRY[dragType];
    if (dragDef?.rootOnly) return;
    if (SAMPLER_TYPES.has(block.type) && !POST_PROCESSOR_TYPES.has(dragType)) return;
    const newBlock = createBlock(dragType);
    const updated = { ...block, children: [...block.children, newBlock] };
    onUpdate(updated);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (canHaveChildren) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleChildUpdate = (child: TestBlock) => {
    const updated = { ...block, children: block.children.map(c => c.id === child.id ? child : c) };
    onUpdate(updated);
  };

  const handleChildDelete = (childId: string) => {
    const updated = { ...block, children: block.children.filter(c => c.id !== childId) };
    onUpdate(updated);
  };

  const handleChildUnwrap = (childId: string) => {
    const idx = block.children.findIndex(c => c.id === childId);
    if (idx < 0) return;
    const child = block.children[idx];
    const grandChildren = child.children.map(c => JSON.parse(JSON.stringify(c)));
    const newChildren = [...block.children.slice(0, idx), ...grandChildren, ...block.children.slice(idx + 1)];
    onUpdate({ ...block, children: newChildren });
  };

  const handleChildDuplicate = (childId: string) => {
    const idx = block.children.findIndex(c => c.id === childId);
    if (idx < 0) return;
    const dup = JSON.parse(JSON.stringify(block.children[idx]));
    dup.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    dup.label = dup.label + ' (copy)';
    const newChildren = [...block.children];
    newChildren.splice(idx + 1, 0, dup);
    onUpdate({ ...block, children: newChildren });
  };

  return (
    <div className="relative">
      <div className="relative flex items-stretch" style={{ paddingLeft: depth * INDENT + PADDING_LEFT }}>
        {depth > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-600"
            style={{ left: `${depth * INDENT}` }}
          />
        )}
        <div
          onClick={handleNodeClick}
          onContextMenu={(e) => onContextMenu(e, block.id)}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', block.id);
          }}
          className={`group flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs cursor-pointer border-l-2 transition-all ${
            isSelected ? 'ring-2 ring-brand-500 border-brand-500 bg-brand-50 dark:bg-brand-950/30' : colorClass + ' hover:shadow-sm'
          }`}
        >
          {canHaveChildren && block.children.length > 0 ? (
            <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded">
              <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="w-4" />
          )}
          <Icon className="w-3.5 h-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
          <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[120px]">
            {block.label}
          </span>
          {hasErrors && (
            <span className="shrink-0" title={blockErrors.map(e => e.message).join('\n')}>
              <AlertTriangle className="w-3 h-3 text-amber-500" />
            </span>
          )}
          {labelPreview && (
            <span className="text-gray-400 dark:text-gray-500 truncate max-w-[100px] hidden lg:inline">
              {labelPreview}
            </span>
          )}
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {siblingIndex > 0 && (
              <button onClick={(e) => { e.stopPropagation(); onMoveUp(block.id); }}
                className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <MoveUp className="w-3 h-3" />
              </button>
            )}
            {siblingIndex < siblingCount - 1 && (
              <button onClick={(e) => { e.stopPropagation(); onMoveDown(block.id); }}
                className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <MoveDown className="w-3 h-3" />
              </button>
            )}
            {canHaveChildren && block.children.length > 0 && (
              <button onClick={(e) => { e.stopPropagation(); onUnwrap(block.id); }}
                className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded text-gray-400 hover:text-amber-600 dark:hover:text-amber-400">
                <ArrowUpFromLine className="w-3 h-3" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onDuplicate(block.id); }}
              className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <Copy className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(block.id); }}
              className="p-0.5 hover:bg-red-100 dark:hover:bg-red-950/50 rounded text-gray-400 hover:text-red-500">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {canHaveChildren && expanded && (
        <div className="relative">
          {block.children.map((child, idx) => (
            <TreeNode
              key={child.id}
              block={child}
              selectedId={selectedId}
              depth={depth + 1}
              siblingIndex={idx}
              siblingCount={block.children.length}
              onSelect={onSelect}
              onUpdate={handleChildUpdate}
              onDelete={handleChildDelete}
              onUnwrap={handleChildUnwrap}
              onDuplicate={handleChildDuplicate}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onAddToContainer={onAddToContainer}
              onContextMenu={onContextMenu}
            />
          ))}
          <div
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-500 px-2 py-1 rounded transition-colors cursor-pointer"
            style={{ paddingLeft: `${(depth + 1) * INDENT + PADDING_LEFT + 4}px` }}
            onClick={() => {
              onAddToContainer(block.id, 'http-request');
            }}
          >
            <Plus className="w-2.5 h-2.5" /> Add step
          </div>
        </div>
      )}
    </div>
  );
}
