import { useState } from 'react';
import { Megaphone, Pin, Plus, Users, Building2, Globe } from 'lucide-react';
import { formatAppDateTime } from '../../../utils/date';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useAnnouncementStream } from '../hooks/useAnnouncementStream';
import { togglePin, deleteAnnouncement } from '../services/announcement.service';
import { CreateAnnouncementModal } from './CreateAnnouncementModal';

export function AnnouncementsDashboard() {
  const { announcements, loading } = useAnnouncementStream();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleTogglePin = async (id: string, currentPinned: boolean) => {
    try {
      await togglePin(id, !currentPinned);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      try {
        await deleteAnnouncement(id);
      } catch (err) {
        console.error('Failed to delete announcement:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Announcements</h2>
          <p className="text-gray-500 text-sm">Create and manage campus-wide announcements</p>
        </div>
        <Button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-gradient-to-r from-[#001A4D] to-[#83358E] hover:from-[#001A4D]/90 hover:to-[#83358E]/90 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Post Announcement
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#001A4D]" />
        </div>
      ) : (
        <>
          {/* Announcements Feed */}
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <Card 
                key={announcement.id} 
                className={`border-[#E0E0E0] hover:shadow-md transition-shadow ${
                  announcement.pinned ? "border-t-2 border-t-[#FFC107]" : ""
                }`}
              >
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-[#001A4D] rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ring-2 ring-[#FFC107]">
                      SAO
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {announcement.pinned && (
                              <Pin className="w-4 h-4 text-[#FFC107] fill-[#FFC107]" />
                            )}
                            <h3 className="font-bold text-[#001A4D] text-lg">{announcement.title}</h3>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="font-medium">{announcement.authorName}</span>
                            <span>•</span>
                            <span>
                              {formatAppDateTime(announcement.createdAt, 'Just now', ' at ')}
                            </span>
                          </div>
                        </div>

                        {/* Priority Badge */}
                        <div>
                          {announcement.priority === "Urgent" && (
                            <Badge className="bg-gradient-to-r from-[#EF4444] to-[#F97316] text-white border-0">
                              Urgent
                            </Badge>
                          )}
                          {announcement.priority === "Important" && (
                            <Badge className="bg-[#FFC107] text-[#001A4D] hover:bg-[#FFC107]">
                              Important
                            </Badge>
                          )}
                          {announcement.priority === "Normal" && (
                            <Badge variant="outline" className="border-gray-300 text-gray-600">
                              Normal
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <p className="text-gray-700 mb-4 leading-relaxed whitespace-pre-wrap">
                        {announcement.content}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-4">
                        {/* Audience */}
                        <div className="flex items-center gap-2">
                          {announcement.audience === "campus-wide" ? (
                            <>
                              <Globe className="w-4 h-4 text-[#0E4EBD]" />
                              <Badge className="bg-[#001A4D] text-white hover:bg-[#001A4D]">
                                Campus-Wide
                              </Badge>
                            </>
                          ) : announcement.audience === "all-organizations" ? (
                            <>
                              <Building2 className="w-4 h-4 text-[#0E4EBD]" />
                              <Badge className="bg-[#0E4EBD] text-white hover:bg-[#0E4EBD]">
                                All Organizations
                              </Badge>
                            </>
                          ) : (
                            <>
                              <Users className="w-4 h-4 text-[#1E70E8]" />
                              <div className="flex flex-wrap gap-1">
                                {announcement.targetOrgNames.slice(0, 3).map((name, i) => (
                                  <Badge key={i} className="bg-[#1E70E8] text-white hover:bg-[#1E70E8] truncate max-w-[150px]">
                                    {name}
                                  </Badge>
                                ))}
                                {announcement.targetOrgNames.length > 3 && (
                                  <Badge className="bg-[#1E70E8] text-white hover:bg-[#1E70E8]">
                                    +{announcement.targetOrgNames.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleTogglePin(announcement.id, announcement.pinned)}
                            className="text-[#FFC107] hover:text-[#FFD54F] hover:bg-[#FFC107]/10"
                          >
                            <Pin className="w-4 h-4 mr-1" />
                            {announcement.pinned ? 'Unpin' : 'Pin'}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleDelete(announcement.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {announcements.length === 0 && (
            <Card className="border-[#E0E0E0]">
              <CardContent className="p-12 text-center">
                <Megaphone className="w-16 h-16 text-[#0E4EBD] mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-[#001A4D] mb-2">No Announcements Yet</h3>
                <p className="text-gray-500 mb-4">Create your first announcement to notify students and organizations.</p>
                <Button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-[#001A4D] hover:bg-[#0E4EBD] text-white"
                >
                  <Plus className="w-4 h-4 mr-2 text-[#FFC107]" />
                  Post Announcement
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <CreateAnnouncementModal onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}
