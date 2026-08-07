import { useState } from "react";
import { Award, Plus, ChevronRight } from "lucide-react";
import { CertificateDashboard, TemplateLibrary, TemplateEditor, GenerateCertificates } from "../../modules/certificates";
import { useOfficerProfile } from "../../auth/hooks/useOfficerProfile";

type Screen = "dashboard" | "template-library" | "template-editor" | "generate";

export default function OfficerCertificates() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [activeEventId, setActiveEventId] = useState<string>("");
  const [editTemplateId, setEditTemplateId] = useState<string>("");

  const { profile } = useOfficerProfile();
  const activeOrgId = profile?.activeOrganizationId || profile?.organizationId || "";

  const handleGenerate = (eventId: string) => {
    setActiveEventId(eventId);
    setScreen("generate");
  };

  const handleEditTemplate = (id: string) => {
    setEditTemplateId(id);
    setScreen("template-editor");
  };

  const breadcrumbs: Record<Screen, string[]> = {
    "dashboard": ["Certificates"],
    "template-library": ["Certificates", "Template Library"],
    "template-editor": ["Certificates", "Template Library", "Configure Template"],
    "generate": ["Certificates", "Generate Certificates"],
  };

  const screenTitles: Record<Screen, string> = {
    "dashboard": "Certificates",
    "template-library": "Certificate Templates",
    "template-editor": "Configure Certificate Template",
    "generate": "Generate Certificates",
  };

  return (
    <div className="p-6 space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[#001A4D] font-bold text-2xl">{screenTitles[screen]}</h1>
          <nav className="flex items-center gap-1.5 mt-1">
            {breadcrumbs[screen].map((crumb, i, arr) => (
              <span key={crumb} className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    if (i === 0) setScreen("dashboard");
                    if (i === 1 && arr.length > 2) setScreen("template-library");
                  }}
                  className={`text-xs transition-colors ${i === arr.length - 1 ? "text-[#001A4D] font-semibold" : "text-[#9E9E9E] hover:text-[#001A4D]"}`}
                >
                  {crumb}
                </button>
                {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-[#9E9E9E]" />}
              </span>
            ))}
          </nav>
        </div>
        {screen !== "template-editor" && (
          <button
            onClick={() => { setEditTemplateId(""); setScreen("template-editor"); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#83358E] text-white font-semibold text-sm rounded-xl hover:bg-[#5B1F6B] transition-colors"
          >
            <Award className="w-4 h-4" />
            <Plus className="w-3.5 h-3.5" />
            Create Certificate
          </button>
        )}
      </div>

      {screen === "dashboard" && (
        <CertificateDashboard
          isAdmin={false}
          organizationId={activeOrgId}
          onGenerate={handleGenerate}
          onOpenTemplateLibrary={() => setScreen("template-library")}
          onOpenEditor={() => { setEditTemplateId(""); setScreen("template-editor"); }}
        />
      )}
      {screen === "template-library" && (
        <TemplateLibrary
          isAdmin={false}
          organizationId={activeOrgId}
          onEditTemplate={handleEditTemplate}
          onUploadNew={() => { setEditTemplateId(""); setScreen("template-editor"); }}
        />
      )}
      {screen === "template-editor" && (
        <TemplateEditor
          isAdmin={false}
          organizationId={activeOrgId}
          templateId={editTemplateId}
          onSave={() => setScreen("template-library")}
        />
      )}
      {screen === "generate" && (
        <GenerateCertificates
          isAdmin={false}
          organizationId={activeOrgId}
          eventId={activeEventId}
          onBack={() => setScreen("dashboard")}
        />
      )}
    </div>
  );
}
