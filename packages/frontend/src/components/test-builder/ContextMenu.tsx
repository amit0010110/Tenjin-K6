import React from 'react';
import { TestBlock, BlockType, BLOCK_REGISTRY, SAMPLER_TYPES, POST_PROCESSOR_TYPES } from '../../lib/test-builder/types';
import { BLOCK_CATEGORIES, getIcon } from './tree-defs';
import { findBlock, findParent, isInsideSampler, filterChildTypes } from './tree-utils';
import { Plus, MoveUp, MoveDown, WrapText, ArrowUpFromLine, Copy, Trash2 } from 'lucide-react';

interface ContextMenuProps {
  contextMenu: { x: number; y: number; blockId: string } | null;
  activeSubmenu: 'before' | 'after' | 'child' | 'wrap' | 'wrap-all' | null;
  blocks: TestBlock[];
  ctxRef: React.Ref<HTMLDivElement>;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onInsert: (type: BlockType, offset: number) => void;
  onAddChild: (type: BlockType) => void;
  onWrapFromHere: (parentType: BlockType) => void;
  onUnwrap: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onSetSubmenu: (sub: 'before' | 'after' | 'child' | 'wrap' | 'wrap-all' | null) => void;
  onClose: () => void;
}

export default function ContextMenu({
  contextMenu,
  activeSubmenu,
  blocks,
  ctxRef,
  onMoveUp,
  onMoveDown,
  onInsert,
  onAddChild,
  onWrapFromHere,
  onUnwrap,
  onDuplicate,
  onDelete,
  onSetSubmenu,
  onClose,
}: ContextMenuProps) {
  if (!contextMenu) return null;

  const contextBlock = findBlock(blocks, contextMenu.blockId);
  const targetCanHaveChildren = contextBlock ? (BLOCK_REGISTRY[contextBlock.type]?.canHaveChildren || false) : false;
  const targetIsRoot = blocks.some(b => b.id === contextMenu.blockId);
  const targetIsSampler = contextBlock ? SAMPLER_TYPES.has(contextBlock.type) : false;
  const targetInsideSampler = isInsideSampler(blocks, contextMenu.blockId);

  return (
    <div
      ref={ctxRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 py-1 text-xs min-w-[180px]"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Move Up / Down */}
      <div className="flex">
        <button
          className="flex-1 text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2 disabled:opacity-30"
          disabled={(findBlock(blocks, contextMenu.blockId) === undefined) || (() => {
            const parent = findParent(blocks, contextMenu.blockId);
            if (!parent) {
              const idx = blocks.findIndex(b => b.id === contextMenu.blockId);
              return idx <= 0;
            }
            const idx = parent.children.findIndex(c => c.id === contextMenu.blockId);
            return idx <= 0;
          })()}
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp(contextMenu.blockId);
            onClose();
          }}
        >
          <MoveUp className="w-3 h-3" /> Move Up
        </button>
        <button
          className="flex-1 text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2 disabled:opacity-30"
          disabled={(findBlock(blocks, contextMenu.blockId) === undefined) || (() => {
            const parent = findParent(blocks, contextMenu.blockId);
            if (!parent) {
              const idx = blocks.findIndex(b => b.id === contextMenu.blockId);
              return idx >= blocks.length - 1;
            }
            const idx = parent.children.findIndex(c => c.id === contextMenu.blockId);
            return idx >= parent.children.length - 1;
          })()}
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown(contextMenu.blockId);
            onClose();
          }}
        >
          <MoveDown className="w-3 h-3" /> Move Down
        </button>
      </div>
      <div className="border-t dark:border-gray-700 my-1" />

      {/* Insert Before */}
      <button
        className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"
        onClick={(e) => { e.stopPropagation(); onSetSubmenu(activeSubmenu === 'before' ? null : 'before'); }}
      >
        <Plus className="w-3 h-3" /> Insert Before
      </button>
      {activeSubmenu === 'before' && (
        <div className="pl-4 border-t dark:border-gray-700 max-h-64 overflow-y-auto">
          {BLOCK_CATEGORIES.map(cat => (
            <div key={cat.name}>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold px-3 pt-2 pb-0.5">{cat.name}</div>
              {cat.types.filter(t => filterChildTypes(t, targetIsRoot, targetInsideSampler ? 'post-processor' : 'any')).map(({ type, label }) => (
                <button
                  key={type}
                  className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center gap-2"
                  onClick={(e) => { e.stopPropagation(); onInsert(type, 0); }}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Insert After */}
      <button
        className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"
        onClick={(e) => { e.stopPropagation(); onSetSubmenu(activeSubmenu === 'after' ? null : 'after'); }}
      >
        <Plus className="w-3 h-3" /> Insert After
      </button>
      {activeSubmenu === 'after' && (
        <div className="pl-4 border-t dark:border-gray-700 max-h-64 overflow-y-auto">
          {BLOCK_CATEGORIES.map(cat => (
            <div key={cat.name}>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold px-3 pt-2 pb-0.5">{cat.name}</div>
              {cat.types.filter(t => filterChildTypes(t, targetIsRoot, targetInsideSampler ? 'post-processor' : 'any')).map(({ type, label }) => (
                <button
                  key={type}
                  className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center gap-2"
                  onClick={(e) => { e.stopPropagation(); onInsert(type, 1); }}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Add as Child (only for containers) */}
      {targetCanHaveChildren && (
        <>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"
            onClick={(e) => { e.stopPropagation(); onSetSubmenu(activeSubmenu === 'child' ? null : 'child'); }}
          >
            <Plus className="w-3 h-3" /> Add Child
          </button>
          {activeSubmenu === 'child' && (
            <div className="pl-4 border-t dark:border-gray-700 max-h-64 overflow-y-auto">
              {BLOCK_CATEGORIES.map(cat => (
                <div key={cat.name}>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold px-3 pt-2 pb-0.5">{cat.name}</div>
                  {cat.types.filter(t => filterChildTypes(t, false, targetIsSampler ? 'post-processor' : 'any')).map(({ type, label }) => (
                    <button
                      key={type}
                      className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center gap-2"
                      onClick={(e) => { e.stopPropagation(); onAddChild(type); }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Wrap from Here */}
      <button
        className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"
        onClick={(e) => { e.stopPropagation(); onSetSubmenu(activeSubmenu === 'wrap' ? null : 'wrap'); }}
      >
        <WrapText className="w-3 h-3" /> Wrap from Here
      </button>
      {activeSubmenu === 'wrap' && (
        <div className="pl-4 border-t dark:border-gray-700 max-h-64 overflow-y-auto">
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
                  onClick={(e) => { e.stopPropagation(); onWrapFromHere(type); }}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Unwrap (remove container, keep children) */}
      {contextBlock && BLOCK_REGISTRY[contextBlock.type]?.canHaveChildren && contextBlock.children.length > 0 && (
        <button
          className="w-full text-left px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400 flex items-center gap-2"
          onClick={(e) => { e.stopPropagation(); onUnwrap(contextMenu.blockId); onClose(); }}
        >
          <ArrowUpFromLine className="w-3 h-3" /> Unwrap (keep children)
        </button>
      )}

      <button
        className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"
        onClick={(e) => { e.stopPropagation(); onDuplicate(contextMenu.blockId); onClose(); }}
      >
        <Copy className="w-3 h-3" /> Duplicate
      </button>
      <button
        className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center gap-2"
        onClick={(e) => { e.stopPropagation(); onDelete(contextMenu.blockId); onClose(); }}
      >
        <Trash2 className="w-3 h-3" /> Delete
      </button>
    </div>
  );
}
