import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TestBlock, BlockType, BLOCK_REGISTRY, createBlock, SAMPLER_TYPES } from '../../lib/test-builder/types';
import { BLOCK_CATEGORIES, getIcon } from './tree-defs';
import { findAndUpdate, findAndDelete, moveBlockById, unwrapBlock, insertInList, addChildToList, dupBlock, wrapFromHere, wrapAllInRoot, addToContainer } from './tree-utils';
import TreeNode from './TreeNode';
import ContextMenu from './ContextMenu';
import { Plus, FolderTree } from 'lucide-react';

interface VisualTreeProps {
  blocks: TestBlock[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (blocks: TestBlock[]) => void;
}

export default function VisualTree({ blocks, selectedId, onSelect, onChange }: VisualTreeProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; blockId: string } | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<'before' | 'after' | 'child' | 'wrap' | 'wrap-all' | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => { setContextMenu(null); setActiveSubmenu(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  const handleMoveUp = useCallback((id: string) => {
    onChange(moveBlockById(blocks, id, 'up'));
  }, [blocks, onChange]);

  const handleMoveDown = useCallback((id: string) => {
    onChange(moveBlockById(blocks, id, 'down'));
  }, [blocks, onChange]);

  const handleContextMenu = useCallback((e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, blockId });
    setActiveSubmenu(null);
  }, []);

  const isRootBlock = (id: string): boolean => blocks.some(b => b.id === id);

  const handleInsert = useCallback((type: BlockType, offset: number) => {
    if (!contextMenu) return;
    const dragDef = BLOCK_REGISTRY[type];
    if (dragDef?.rootOnly && !isRootBlock(contextMenu.blockId)) return;
    const newBlock = createBlock(type);
    onChange(insertInList(blocks, contextMenu.blockId, newBlock, offset));
    onSelect(newBlock.id);
    setContextMenu(null);
    setActiveSubmenu(null);
  }, [contextMenu, blocks, onChange, onSelect]);

  const handleAddChild = useCallback((type: BlockType) => {
    if (!contextMenu) return;
    const dragDef = BLOCK_REGISTRY[type];
    if (dragDef?.rootOnly) return;
    const newBlock = createBlock(type);
    onChange(addChildToList(blocks, contextMenu.blockId, newBlock));
    onSelect(newBlock.id);
    setContextMenu(null);
    setActiveSubmenu(null);
  }, [contextMenu, blocks, onChange, onSelect]);

  const handleWrapFromHere = useCallback((parentType: BlockType) => {
    if (!contextMenu) return;
    const newBlocks = wrapFromHere(blocks, contextMenu.blockId, parentType);
    onChange(newBlocks);
    setContextMenu(null);
    setActiveSubmenu(null);
  }, [contextMenu, blocks, onChange]);

  const handleWrapAll = useCallback((parentType: BlockType) => {
    const newBlocks = wrapAllInRoot(blocks, parentType);
    onChange(newBlocks);
  }, [blocks, onChange]);

  const handleUpdate = (updated: TestBlock) => {
    onChange(findAndUpdate(blocks, updated.id, () => updated));
  };

  const handleDelete = (id: string) => {
    onChange(findAndDelete(blocks, id));
    if (selectedId === id) onSelect(null);
  };

  const handleUnwrap = (id: string) => {
    onChange(unwrapBlock(blocks, id));
  };

  const handleDuplicate = (id: string) => {
    onChange(dupBlock(blocks, id));
  };

  const handleAddToContainer = (containerId: string, type: BlockType) => {
    const newBlock = createBlock(type);
    onChange(addToContainer(blocks, containerId, newBlock));
    onSelect(newBlock.id);
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-3 relative">
      {blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500">
          <div className="text-4xl mb-3 opacity-30">+</div>
          <p className="text-sm font-medium">No test steps yet</p>
          <p className="text-xs mt-1">Drag blocks from the palette or click to add</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {blocks.map((block, idx) => (
            <TreeNode
              key={block.id}
              block={block}
              selectedId={selectedId}
              depth={0}
              siblingIndex={idx}
              siblingCount={blocks.length}
              onSelect={onSelect}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onUnwrap={handleUnwrap}
              onDuplicate={handleDuplicate}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onAddToContainer={handleAddToContainer}
              onContextMenu={handleContextMenu}
            />
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => {
            const newBlock = createBlock('http-request');
            onChange([...blocks, newBlock]);
            onSelect(newBlock.id);
          }}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-500 px-2 py-1.5 rounded transition-colors flex-1 justify-center border border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-400"
        >
          <Plus className="w-3.5 h-3.5" /> Add Step
        </button>
        <div className="relative">
          <button
            onClick={() => setActiveSubmenu(activeSubmenu === 'wrap-all' ? null : 'wrap-all')}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-500 px-2 py-1.5 rounded transition-colors border border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-400"
          >
            <FolderTree className="w-3.5 h-3.5" /> Wrap All
          </button>
          {activeSubmenu === 'wrap-all' && (
            <div className="absolute bottom-full mb-1 right-0 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 py-1 text-xs min-w-[180px]">
              {BLOCK_CATEGORIES.map(cat => (
                <div key={cat.name}>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold px-3 pt-2 pb-0.5">{cat.name}</div>
                  {cat.types.filter(t => {
                    const def = BLOCK_REGISTRY[t.type];
                    return def?.canHaveChildren && !SAMPLER_TYPES.has(t.type);
                  }).map(({ type, label }) => (
                    <button
                      key={type}
                      className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center gap-2"
                      onClick={(e) => { e.stopPropagation(); handleWrapAll(type); setActiveSubmenu(null); }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ContextMenu
        contextMenu={contextMenu}
        activeSubmenu={activeSubmenu}
        blocks={blocks}
        ctxRef={ctxRef}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onInsert={handleInsert}
        onAddChild={handleAddChild}
        onWrapFromHere={handleWrapFromHere}
        onUnwrap={handleUnwrap}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onSetSubmenu={setActiveSubmenu}
        onClose={() => { setContextMenu(null); setActiveSubmenu(null); }}
      />
    </div>
  );
}
