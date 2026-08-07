import { Award, Eye, Edit2, Trash2, CheckCircle, Search, Plus } from "lucide-react";
import { useState } from "react";
import { useCertificateTemplatesStream } from "../hooks/useCertificateStream";

interface Props {
  isAdmin: boolean;
  organizationId?: string;
  onEditTemplate: (id: string) => void;
  onUploadNew: () => void;
}

export default function TemplateLibrary({ isAdmin, organizationId, onEditTemplate, onUploadNew }: Props) {
  const { templates, loading } = useCertificateTemplatesStream(organizationId, isAdmin);
  const [search, setSearch] = useState("");

  const filtered = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888780]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            className={`w-full pl-9 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none ${isAdmin ? "focus:border-[#1E70E8]" : "focus:border-[#83358E] focus:ring-2 focus:ring-[#83358E]/20"}`}
          />
        </div>
        <button
          onClick={onUploadNew}
          className={`ml-auto text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${isAdmin ? "bg-[#001A4D] hover:bg-[#0E4EBD]" : "bg-[#83358E] hover:bg-[#6D2A78]"}`}
        >
          <Plus className="w-4 h-4" /> Upload New Template
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-500 text-sm">Loading certificate templates...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-[#E0E0E0]">
          <Award className={`w-16 h-16 ${isAdmin ? "text-[#0E4EBD]" : "text-[#83358E]"} mb-4`} />
          <p className="text-[#001A4D] font-bold text-lg">No templates saved yet</p>
          <p className="text-[#888780] text-sm mt-1 mb-5">Upload your first certificate template background to get started.</p>
          <button onClick={onUploadNew} className={`${isAdmin ? "bg-[#001A4D] hover:bg-[#0E4EBD]" : "bg-[#83358E] hover:bg-[#6D2A78]"} text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors`}>
            + Upload Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {filtered.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Thumbnail */}
              <div className="relative w-full h-44 bg-[#F8F8F8] flex items-center justify-center rounded-t-2xl overflow-hidden">
                {t.isDefault && (
                  <span className="absolute top-3 left-3 bg-[#FFD41C] text-[#001A4D] text-[10px] font-bold px-2 py-0.5 rounded-full z-10">DEFAULT</span>
                )}
                {t.imageUrl ? (
                  <img src={t.imageUrl} alt={t.name} className="w-full h-full object-cover" />
                ) : (
                  <Award className="w-12 h-12 text-[#888780]" />
                )}
              </div>

              {/* Body */}
              <div className="p-4 space-y-2">
                <p className="text-[#001A4D] font-bold text-[15px]">{t.name}</p>
                <p className="text-[#888780] text-xs">A4 Landscape (297×210mm)</p>

                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span className="text-[#22C55E] text-xs">Name position configured</span>
                </div>

                <p className="text-[#888780] text-xs font-medium">
                  {t.namePosition?.fontFamily || 'Arial'} · {t.namePosition?.fontSizePt || 32}pt · {t.namePosition?.textColor || '#001A4D'}
                </p>
              </div>

              {/* Action Row */}
              <div className="px-4 pb-4 flex items-center gap-2">
                <button
                  onClick={() => onEditTemplate(t.id)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isAdmin
                      ? "bg-[#001A4D] text-white hover:bg-[#0E4EBD]"
                      : "bg-[#83358E] text-white hover:bg-[#6D2A78]"
                  }`}
                >
                  Configure Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
