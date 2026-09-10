'use client';

import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Plus, Tag as TagIcon, Sparkles } from 'lucide-react';

export interface PrintTagItem {
  tag: string;
  name: string;
  category: string;
  description: string;
  isItemScoped?: boolean;
}

export interface TagCategoryGroup {
  key: string;
  title: string;
  tags: PrintTagItem[];
}

interface TagSelectorPanelProps {
  categories: TagCategoryGroup[];
  onInsertTag: (tag: string) => void;
}

export const TagSelectorPanel: React.FC<TagSelectorPanelProps> = ({ categories, onInsertTag }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (key: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const filteredCategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return categories;

    return categories
      .map((cat) => {
        const matchingTags = cat.tags.filter(
          (t) =>
            t.tag.toLowerCase().includes(term) ||
            t.name.toLowerCase().includes(term) ||
            t.description.toLowerCase().includes(term),
        );
        return {
          ...cat,
          tags: matchingTags,
        };
      })
      .filter((cat) => cat.tags.length > 0);
  }, [categories, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Header & Search */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <TagIcon className="w-4 h-4 text-red-600" />
            <span>Thẻ dữ liệu động</span>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-100">
            Click để chèn
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm mã thẻ (vd: [Ten_Chi_Nhanh], [Tong_Cong])..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-red-500 focus:outline-none placeholder:text-slate-400 font-medium"
          />
        </div>
      </div>

      {/* Danh sách các nhóm thẻ */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filteredCategories.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            Không tìm thấy thẻ dữ liệu nào phù hợp với từ khóa &ldquo;{searchTerm}&rdquo;
          </div>
        ) : (
          filteredCategories.map((group) => {
            const isCollapsed = Boolean(collapsedCategories[group.key]) && !searchTerm;

            return (
              <div
                key={group.key}
                className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs"
              >
                {/* Tiêu đề nhóm */}
                <button
                  type="button"
                  onClick={() => toggleCategory(group.key)}
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 text-left flex items-center justify-between transition-colors"
                >
                  <span className="text-xs font-bold text-slate-700">
                    {group.title} ({group.tags.length})
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {/* Danh sách thẻ trong nhóm */}
                {!isCollapsed && (
                  <div className="p-1.5 divide-y divide-slate-100">
                    {group.tags.map((tagItem) => (
                      <div
                        key={tagItem.tag}
                        className="p-2 hover:bg-slate-50 rounded-lg flex items-center justify-between gap-2 transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 group-hover:border-red-200 group-hover:text-red-700 transition-colors">
                              {tagItem.tag}
                            </span>
                            {tagItem.isItemScoped && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-50 text-amber-700 rounded border border-amber-200">
                                Trong {'{{#items}}'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-medium text-slate-700 mt-1 truncate">
                            {tagItem.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {tagItem.description}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onInsertTag(tagItem.tag)}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-red-600 hover:text-white hover:border-red-600 shadow-2xs transition-all active:scale-95"
                          title={`Chèn ${tagItem.tag} vào vị trí con trỏ`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>Chèn</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer lưu ý */}
      <div className="p-2.5 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span>Thẻ món ăn chỉ hoạt động trong khối {'{{#items}}...{{/items}}'}.</span>
      </div>
    </div>
  );
};
